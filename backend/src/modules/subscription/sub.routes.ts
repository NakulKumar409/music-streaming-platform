import { Router } from "express";
import { requireAuth } from "../../common/auth/requireAuth";
import { confirmPayment, createOrder } from "../../controllers/paymentController";
import { createSubscription, verifySubscription } from "../../controllers/subscriptionController";
import { pool } from "../../common/db";

const router = Router();

// ────────────────────────────────────────────────────────
//  Helper: resolve artistId (numeric or username string)
// ────────────────────────────────────────────────────────
async function resolveArtistId(raw: string): Promise<number | null> {
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  try {
    const r = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [raw]);
    const id = Number(r.rows?.[0]?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────
//  GET /subscriptions/me  — single artist subscription status
// ────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
  (async () => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const artistIdRaw = (req.query?.artistId as string | undefined) ?? "";
    if (!artistIdRaw)
      return res.status(400).json({ success: false, message: "artistId required" });

    const artistId = await resolveArtistId(artistIdRaw);
    if (!artistId)
      return res.status(400).json({ success: false, message: "artistId invalid" });

    try {
      const row = await pool.query(
        `SELECT user_id, artist_id, type, status, plan_type, start_date,
                next_billing_date, grace_ends_at, auto_renew, end_date
         FROM subscriptions
         WHERE user_id = $1 AND artist_id = $2 AND type = 'ARTIST'
         ORDER BY created_at DESC LIMIT 1`,
        [userId, artistId]
      );

      const s = row.rows?.[0] ?? null;
      if (!s) return res.json({ success: true, subscription: null });

      return res.json({
        success: true,
        subscription: {
          user_id: s.user_id,
          artist_id: s.artist_id,
          type: s.type,
          status: s.status,
          plan_type: s.plan_type,
          start_date: s.start_date,
          next_billing_date: s.next_billing_date,
          grace_ends_at: s.grace_ends_at,
          end_date: s.end_date ?? s.next_billing_date,
          auto_renew: s.auto_renew,
        }
      });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to fetch subscription" });
    }
  })();
});

// ────────────────────────────────────────────────────────
//  GET /subscriptions/platform  — platform subscription status
// ────────────────────────────────────────────────────────
router.get("/platform", requireAuth, (req, res) => {
  (async () => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
      const row = await pool.query(
        `SELECT id, user_id, type, status, plan_type, start_date,
                next_billing_date, grace_ends_at, auto_renew, end_date
         FROM subscriptions
         WHERE user_id = $1 AND type = 'PLATFORM'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      const s = row.rows?.[0] ?? null;
      return res.json({
        success: true,
        subscription: s
          ? {
              id: s.id,
              type: s.type,
              status: s.status,
              plan_type: s.plan_type,
              start_date: s.start_date,
              next_billing_date: s.next_billing_date,
              grace_ends_at: s.grace_ends_at,
              end_date: s.end_date ?? s.next_billing_date,
              auto_renew: s.auto_renew,
            }
          : null,
      });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to fetch platform subscription" });
    }
  })();
});

// ────────────────────────────────────────────────────────
//  GET /subscriptions/access-check  — content access gate
//  query: contentId, artistId  → { allowed, reason }
// ────────────────────────────────────────────────────────
router.get("/access-check", requireAuth, (req, res) => {
  (async () => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const contentIdRaw = (req.query?.contentId as string | undefined) ?? "";
    const artistIdRaw = (req.query?.artistId as string | undefined) ?? "";

    const contentId = Number(contentIdRaw);
    const artistIdNum = await resolveArtistId(artistIdRaw);

    if (!Number.isFinite(contentId) || contentId <= 0)
      return res.status(400).json({ success: false, message: "contentId required" });
    if (!artistIdNum)
      return res.status(400).json({ success: false, message: "artistId required" });

    try {
      // fetch content info
      const cRow = await pool.query(
        `SELECT subscription_required, artist_id FROM content_items WHERE id = $1 LIMIT 1`,
        [contentId]
      );
      const content = cRow.rows?.[0];
      if (!content) return res.status(404).json({ success: false, message: "Content not found" });

      if (!content.subscription_required) {
        return res.json({ success: true, allowed: true, reason: "FREE" });
      }

      // check artist subscription
      const subRow = await pool.query(
        `SELECT status, grace_ends_at FROM subscriptions
         WHERE user_id = $1 AND artist_id = $2 AND type = 'ARTIST'
         ORDER BY created_at DESC LIMIT 1`,
        [userId, artistIdNum]
      );
      const sub = subRow.rows?.[0];

      if (!sub) {
        return res.json({ success: true, allowed: false, reason: "NO_SUBSCRIPTION" });
      }

      const status = (sub.status ?? "").toUpperCase();
      const now = new Date();

      if (status === "ACTIVE") {
        return res.json({ success: true, allowed: true, reason: "ACTIVE" });
      }

      // Grace period
      if (status === "GRACE" || status === "PAST_DUE") {
        const graceEnd = sub.grace_ends_at ? new Date(sub.grace_ends_at) : null;
        if (graceEnd && graceEnd > now) {
          return res.json({ success: true, allowed: true, reason: "GRACE_PERIOD", graceEndsAt: graceEnd });
        }
      }

      return res.json({ success: true, allowed: false, reason: "EXPIRED" });
    } catch {
      return res.status(500).json({ success: false, message: "Access check failed" });
    }
  })();
});

// ────────────────────────────────────────────────────────
//  GET /subscriptions/quality  — what quality can user stream?
//  Returns: { quality: "HD" | "SD" }
// ────────────────────────────────────────────────────────
router.get("/quality", requireAuth, (req, res) => {
  (async () => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
      const row = await pool.query(
        `SELECT status, grace_ends_at FROM subscriptions
         WHERE user_id = $1 AND type = 'PLATFORM'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      const sub = row.rows?.[0];

      if (!sub) return res.json({ success: true, quality: "SD", maxResolution: "240p" });

      const status = (sub.status ?? "").toUpperCase();
      const now = new Date();

      if (status === "ACTIVE") {
        return res.json({ success: true, quality: "HD", maxResolution: "1080p" });
      }
      if (status === "GRACE" || status === "PAST_DUE") {
        const graceEnd = sub.grace_ends_at ? new Date(sub.grace_ends_at) : null;
        if (graceEnd && graceEnd > now) {
          return res.json({ success: true, quality: "HD", maxResolution: "720p", isGrace: true });
        }
      }
      return res.json({ success: true, quality: "SD", maxResolution: "240p" });
    } catch {
      return res.status(500).json({ success: false, message: "Quality check failed" });
    }
  })();
});

// ────────────────────────────────────────────────────────
//  GET /subscriptions/summary  — dashboard summary (all active subs)
// ────────────────────────────────────────────────────────
router.get("/summary", requireAuth, (req: any, res: any) => {
  (async () => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
      // Latest artist subscription
      const artistRow = await pool.query(
        `SELECT s.user_id, s.artist_id, s.type, s.status, s.plan_type,
                s.start_date, s.next_billing_date, s.grace_ends_at, s.end_date,
                u.full_name as artist_name, u.name as artist_display_name
         FROM subscriptions s
         LEFT JOIN users u ON s.artist_id = u.id
         WHERE s.user_id = $1 AND s.type = 'ARTIST'
           AND UPPER(COALESCE(s.status,'')) IN ('ACTIVE','GRACE','PAST_DUE')
         ORDER BY s.next_billing_date DESC NULLS LAST, s.updated_at DESC
         LIMIT 1`,
        [userId]
      );

      // Platform subscription
      const platformRow = await pool.query(
        `SELECT id, type, status, plan_type, start_date, next_billing_date, grace_ends_at, end_date
         FROM subscriptions
         WHERE user_id = $1 AND type = 'PLATFORM'
           AND UPPER(COALESCE(status,'')) IN ('ACTIVE','GRACE','PAST_DUE')
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      // All active artist subscriptions count
      const countRow = await pool.query(
        `SELECT COUNT(*)::int as c FROM subscriptions
         WHERE user_id = $1 AND type = 'ARTIST'
           AND UPPER(COALESCE(status,'')) IN ('ACTIVE','GRACE')`,
        [userId]
      );

      const artist = artistRow.rows?.[0] ?? null;
      const platform = platformRow.rows?.[0] ?? null;
      const artistSubCount = Number(countRow.rows?.[0]?.c ?? 0);

      const mapSub = (s: any, isArtist: boolean) => {
        if (!s) return null;
        const endDate = s.end_date ?? s.next_billing_date;
        const graceEndsAt = s.grace_ends_at ?? null;

        // Compute days until expiry
        const now = new Date();
        const end = endDate ? new Date(endDate) : null;
        const daysLeft = end ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 86400)) : null;
        const isExpiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

        return {
          type: s.type,
          status: s.status,
          plan_type: s.plan_type,
          start_date: s.start_date,
          end_date: endDate,
          grace_ends_at: graceEndsAt,
          next_billing_date: s.next_billing_date,
          auto_renew: s.auto_renew,
          daysLeft,
          isExpiringSoon,
          ...(isArtist
            ? {
                artist_id: s.artist_id,
                artist_name: s.artist_name || s.artist_display_name || "Artist",
              }
            : {}),
        };
      };

      return res.json({
        success: true,
        plan: mapSub(artist, true),           // legacy field for compatibility
        artistPlan: mapSub(artist, true),
        platformPlan: mapSub(platform, false),
        artistSubCount,
      });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to fetch summary" });
    }
  })();
});

// ────────────────────────────────────────────────────────
//  GET /subscriptions/all  — list all subscriptions for user
// ────────────────────────────────────────────────────────
router.get("/all", requireAuth, (req: any, res: any) => {
  (async () => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
      const rows = await pool.query(
        `SELECT s.id, s.type, s.artist_id, s.status, s.plan_type,
                s.start_date, s.next_billing_date, s.grace_ends_at, s.end_date, s.auto_renew,
                u.full_name as artist_name, u.name as artist_display_name, u.profile_image_url as artist_avatar
         FROM subscriptions s
         LEFT JOIN users u ON s.artist_id = u.id AND s.type = 'ARTIST'
         WHERE s.user_id = $1
         ORDER BY s.created_at DESC`,
        [userId]
      );
      return res.json({ success: true, subscriptions: rows.rows });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to list subscriptions" });
    }
  })();
});

// ────────────────────────────────────────────────────────
//  POST /subscriptions/  — legacy stub (kept for compat)
// ────────────────────────────────────────────────────────
router.post("/", requireAuth, (_req, res) => {
  res.json({ success: true, message: "Use /create endpoint", status: "PENDING" });
});

// ────────────────────────────────────────────────────────
//  GET /subscriptions/status  — consolidated view (platform + all artist subs)
// ────────────────────────────────────────────────────────
router.get("/status", requireAuth, (req: any, res: any) => {
  (async () => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
      const rows = await pool.query(
        `SELECT s.id, s.type, s.artist_id, s.status, s.plan_type,
                s.start_date, s.next_billing_date, s.grace_ends_at, s.end_date, s.auto_renew,
                u.full_name as artist_name, u.name as artist_display_name
         FROM subscriptions s
         LEFT JOIN users u ON s.artist_id = u.id AND s.type = 'ARTIST'
         WHERE s.user_id = $1
         AND UPPER(COALESCE(s.status,'')) NOT IN ('EXPIRED', 'CANCELLED', 'REFUNDED')
         ORDER BY s.type DESC, s.created_at DESC`,
        [userId]
      );

      const subscriptions = rows.rows.map(s => {
         const endDate = s.end_date ?? s.next_billing_date;
         const now = new Date();
         const isGrace = (s.status === 'GRACE' || s.status === 'PAST_DUE') && 
                         s.grace_ends_at && new Date(s.grace_ends_at) > now;

         return {
            id: s.id,
            type: s.type,
            artist_id: s.artist_id,
            artist_name: s.artist_name || s.artist_display_name || (s.type === 'PLATFORM' ? 'Platform' : 'Artist'),
            status: s.status,
            plan_type: s.plan_type,
            expires_at: endDate,
            grace_ends_at: s.grace_ends_at,
            is_grace: !!isGrace,
            auto_renew: s.auto_renew
         };
      });

      const platformSub = subscriptions.find(s => s.type === 'PLATFORM') || null;
      const artistSubs = subscriptions.filter(s => s.type === 'ARTIST');

      return res.json({
        success: true,
        platform: platformSub,
        artists: artistSubs,
        count: artistSubs.length
      });
    } catch (err) {
      console.error("[STATUS] Failed to fetch subscription status", err);
      return res.status(500).json({ success: false, message: "Failed to fetch subscription status" });
    }
  })();
});

// ────────────────────────────────────────────────────────
//  Payment endpoints
// ────────────────────────────────────────────────────────
router.post("/order", requireAuth, (req, res) => createOrder(req as any, res));
router.post("/confirm", requireAuth, (req, res) => confirmPayment(req as any, res));

// Razorpay Subscription Endpoints
router.post("/create", requireAuth, (req, res) => createSubscription(req as any, res));
router.post("/verify", requireAuth, (req, res) => verifySubscription(req as any, res));

// Mock endpoints (dev only)
router.post("/mock-order", requireAuth, (req, res) => createOrder(req as any, res));
router.post("/mock-verify", requireAuth, (req, res) => confirmPayment(req as any, res));

export default router;
