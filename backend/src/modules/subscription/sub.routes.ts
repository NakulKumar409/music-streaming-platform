import { Router } from "express";
import { requireAuth } from "../../common/auth/requireAuth";
import { confirmPayment, createOrder } from "../../controllers/paymentController";
import { createSubscription, verifySubscription } from "../../controllers/subscriptionController";
import { pool } from "../../common/db";

const router = Router();

router.post("/", requireAuth, (req, res) => {
  res.json({
    success: true,
    message: "Subscription started",
    status: "PENDING"
  });
});

router.get("/status", requireAuth, (req, res) => {
  res.json({
    success: true,
    status: "ACTIVE"
  });
});

router.get("/me", requireAuth, (req, res) => {
  (async () => {
    const userId = req.user?.id;
    const artistIdRaw = (req.query?.artistId as string | undefined) ?? "";
    let artistId = Number(artistIdRaw);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!artistIdRaw) {
      return res.status(400).json({ success: false, message: "artistId required" });
    }

    if (Number.isNaN(artistId) || artistId <= 0) {
      try {
        const artistRow = await pool.query(
          `SELECT id
           FROM users
           WHERE username = $1
           LIMIT 1`,
          [artistIdRaw]
        );
        const resolved = Number(artistRow.rows?.[0]?.id);
        if (!Number.isFinite(resolved) || resolved <= 0) {
          return res.status(400).json({ success: false, message: "artistId required" });
        }
        artistId = resolved;
      } catch {
        return res.status(400).json({ success: false, message: "artistId required" });
      }
    }

    try {
      const row = await pool.query(
        `SELECT user_id, artist_id, status, plan_type, start_date, next_billing_date, auto_renew
         FROM subscriptions
         WHERE user_id = $1 AND artist_id = $2
         LIMIT 1`,
        [userId, artistId]
      );

      const s = row.rows?.[0] ?? null;
      if (!s) {
        return res.json({ success: true, subscription: null });
      }

      return res.json({
        success: true,
        subscription: {
          user_id: s.user_id,
          artist_id: s.artist_id,
          status: s.status,
          plan_type: s.plan_type,
          start_date: s.start_date,
          next_billing_date: s.next_billing_date,
          auto_renew: s.auto_renew,
        }
      });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to fetch subscription" });
    }
  })();
});

router.get("/summary", requireAuth, (req: any, res: any) => {
  (async () => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    try {
      const row = await pool.query(
        `SELECT s.user_id, s.artist_id, s.status, s.plan_type, s.start_date, s.next_billing_date, s.auto_renew,
                u.full_name as artist_name, u.name as artist_display_name
         FROM subscriptions s
         LEFT JOIN users u ON s.artist_id = u.id
         WHERE s.user_id = $1
           AND UPPER(COALESCE(s.status, '')) = 'ACTIVE'
           AND (s.next_billing_date IS NULL OR s.next_billing_date > now() - interval '2 days')
         ORDER BY s.next_billing_date DESC NULLS LAST, s.updated_at DESC, s.created_at DESC
         LIMIT 1`,
        [userId]
      );

      const s = row.rows?.[0] ?? null;

      return res.json({
        success: true,
        plan: s
            ? {
                user_id: s.user_id,
                artist_id: s.artist_id,
                artist_name: s.artist_name || s.artist_display_name || 'Artist',
                status: s.status,
                plan_type: s.plan_type,
                start_date: s.start_date,
                next_billing_date: s.next_billing_date,
                end_date: s.next_billing_date, // Map billing date to end_date for simplicity in UI
                auto_renew: s.auto_renew,
              }
          : null,
      });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to fetch plan" });
    }
  })();
});

router.post("/order", requireAuth, (req, res) => createOrder(req as any, res));
router.post("/confirm", requireAuth, (req, res) => confirmPayment(req as any, res));

// Razorpay Subscription Endpoints
router.post("/create", requireAuth, (req, res) => createSubscription(req as any, res));
router.post("/verify", requireAuth, (req, res) => verifySubscription(req as any, res));

router.post("/mock-order", requireAuth, (req, res) => createOrder(req as any, res));
router.post("/mock-verify", requireAuth, (req, res) => confirmPayment(req as any, res));

export default router;
