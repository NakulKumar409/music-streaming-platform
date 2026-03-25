import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireAuth } from "../common/auth/requireAuth";
import { pool } from "../common/db";
import { uploadLimiter } from "../common/security/rateLimit";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const requireArtist = (req: any, res: any, next: any) => {
  const role = (req.user?.role || "").toUpperCase();
  if (role !== "ARTIST") {
    return res.status(403).json({
      success: false,
      message: "Forbidden"
    });

  }
  return next();
};

const EARLY_ACCESS_DAYS = 7;

const ensureUploadsDir = () => {
  const dir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadsDir());
    } catch (e: any) {
      cb(e, ensureUploadsDir());
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}${ext}`);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 1024 * 1024 * 10
  }
});

router.post("/onboard", uploadLimiter, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {
    const {
      email,
      password,
      artistName,
      bio,
      portfolioLinks,
      phone
    } = req.body as {
      email?: string;
      password?: string;
      artistName?: string;
      bio?: string;
      portfolioLinks?: any;
      phone?: string;
    };

    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedPassword = (password || "").toString();
    const trimmedName = (artistName || "").trim();
    const trimmedBio = (bio || "").trim();

    const links = Array.isArray(portfolioLinks)
      ? portfolioLinks
          .map((x) => (x ?? "").toString().trim())
          .filter(Boolean)
          .slice(0, 20)
      : typeof portfolioLinks === "string"
        ? portfolioLinks
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

    if (!trimmedEmail) {
      return res.status(400).json({ success: false, message: "email is required", correlationId });
    }
    if (!trimmedPassword || trimmedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "password is required (min 6 chars)",
        correlationId
      });
    }
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: "artistName is required", correlationId });
    }
    if (!trimmedBio) {
      return res.status(400).json({ success: false, message: "bio is required", correlationId });
    }
    if (!links.length) {
      return res.status(400).json({
        success: false,
        message: "portfolioLinks is required",
        correlationId
      });
    }

    const existing = await safeRows<any>(
      "SELECT id, role FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [trimmedEmail],
      []
    );

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    let userId: number | null = null;
    if (!existing.length) {
      const inserted = await pool.query(
        `INSERT INTO users (email, password, name, role, status, is_verified, verified, phone, artist_status, artist_bio, portfolio_links, onboarded_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'ARTIST', 'ACTIVE', false, false, $4, 'PENDING', $5, $6, now(), now(), now())
         RETURNING id`,
        [trimmedEmail, hashedPassword, trimmedName, phone ?? null, trimmedBio, links]
      );
      userId = Number(inserted.rows?.[0]?.id ?? 0) || null;
    } else {
      const r = (existing[0]?.role ?? "").toString().toUpperCase();
      if (r && r !== "ARTIST" && r !== "FAN") {
        return res.status(409).json({ success: false, message: "Email already in use", correlationId });
      }

      const updated = await pool.query(
        `UPDATE users
         SET password = $2,
             name = $3,
             role = 'ARTIST',
             status = COALESCE(status, 'ACTIVE'),
             is_verified = false,
             verified = false,
             phone = COALESCE($4, phone),
             artist_status = 'PENDING',
             artist_bio = $5,
             portfolio_links = $6,
             onboarded_at = now(),
             updated_at = now()
         WHERE LOWER(email) = $1
         RETURNING id`,
        [trimmedEmail, hashedPassword, trimmedName, phone ?? null, trimmedBio, links]
      );
      userId = Number(updated.rows?.[0]?.id ?? 0) || null;
    }

    if (!userId) {
      return res.status(500).json({ success: false, message: "Failed to onboard artist", correlationId });
    }

    const token = jwt.sign(
      { id: userId, email: trimmedEmail, role: "ARTIST" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );

    console.log(
      `[AUDIT] ${JSON.stringify({
        event: "artist_onboard_submitted",
        correlationId,
        userId,
        email: trimmedEmail,
        artistStatus: "PENDING"
      })}`
    );

    return res.status(201).json({
      success: true,
      token,
      pendingApproval: true,
      user: {
        id: userId,
        email: trimmedEmail,
        role: "ARTIST",
        isVerified: false,
        status: "ACTIVE"
      },
      correlationId
    });
  } catch (err: any) {
    console.error("[artist/onboard] error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to submit application", correlationId });
  }
});

router.patch("/onboard", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const { artistName, bio, portfolioLinks, phone } = req.body as {
      artistName?: string;
      bio?: string;
      portfolioLinks?: any;
      phone?: string;
    };

    const trimmedName = (artistName || "").trim();
    const trimmedBio = (bio || "").trim();

    const links = Array.isArray(portfolioLinks)
      ? portfolioLinks
          .map((x) => (x ?? "").toString().trim())
          .filter(Boolean)
          .slice(0, 20)
      : typeof portfolioLinks === "string"
        ? portfolioLinks
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

    if (!trimmedName) {
      return res.status(400).json({ success: false, message: "artistName is required", correlationId });
    }
    if (!trimmedBio) {
      return res.status(400).json({ success: false, message: "bio is required", correlationId });
    }
    if (!links.length) {
      return res.status(400).json({ success: false, message: "portfolioLinks is required", correlationId });
    }

    await pool.query(
      `UPDATE users
       SET name = $2,
           phone = COALESCE($3, phone),
           artist_bio = $4,
           portfolio_links = $5,
           artist_status = 'PENDING',
           onboarded_at = now(),
           updated_at = now()
       WHERE id = $1 AND UPPER(role) = 'ARTIST'`,
      [artistUserId, trimmedName, phone ?? null, trimmedBio, links]
    );

    audit(req, { event: "artist_onboard_resubmitted", outcome: "success" });
    return res.json({ success: true, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_onboard_resubmitted", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to resubmit application", correlationId });
  }
});

router.patch("/appeal", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const { message } = req.body as { message?: string };
    const msg = (message ?? "").toString().trim();
    if (!msg) {
      return res.status(400).json({ success: false, message: "message is required", correlationId });
    }

    await pool.query(
      "UPDATE users SET artist_appeal_message = $2, updated_at = now() WHERE id = $1 AND UPPER(role) = 'ARTIST'",
      [artistUserId, msg]
    );

    audit(req, { event: "artist_appeal_submitted", outcome: "success" });
    return res.json({ success: true, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_appeal_submitted", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to submit appeal", correlationId });
  }
});

const safeScalarNumber = async (
  query: string,
  params: any[],
  fallback = 0
): Promise<number> => {
  try {
    const r = await pool.query(query, params);
    const v = r.rows?.[0]?.value ?? r.rows?.[0]?.c ?? r.rows?.[0]?.count;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
};

const safeRows = async <T = any>(query: string, params: any[], fallback: T[] = []): Promise<T[]> => {
  try {
    const r = await pool.query(query, params);
    return (r.rows as T[]) ?? fallback;
  } catch {
    return fallback;
  }
};

const audit = (req: any, payload: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req?.user?.id ?? null;
  console.log(
    `[AUDIT] ${JSON.stringify({
      role: "ARTIST",
      correlationId,
      artistUserId,
      ...payload
    })}`
  );
};

router.post(
  "/uploads/image",
  uploadLimiter,
  requireAuth,
  requireArtist,
  uploadImage.single("image"),
  async (req: any, res: any) => {
    const correlationId = req?.correlationId || "-";

    try {

      const kindRaw = (req.body?.kind ?? "").toString().trim().toLowerCase();
      const kind = kindRaw === "banner" ? "banner" : kindRaw === "profile" ? "profile" : "";

      if (!kind) {
        return res.status(400).json({
          success: false,
          message: "kind must be 'profile' or 'banner'",
          correlationId
        });
      }

      const file = req.file as any;
      if (!file?.filename) {
        return res.status(400).json({
          success: false,
          message: "image file is required",
          correlationId
        });
      }

      const url = `/uploads/${file.filename}`;

      const artistUserId = req.user?.id;
      const column = kind === "profile" ? "profile_image_url" : "banner_image_url";

      await pool.query(
        `UPDATE users SET ${column} = $2 WHERE id = $1 AND UPPER(role) = 'ARTIST'`,
        [artistUserId, url]
      );

      audit(req, {
        event: "artist_image_uploaded",
        outcome: "success",
        kind,
        url
      });

      return res.json({ success: true, url, correlationId });
    } catch (err: any) {
      audit(req, {
        event: "artist_image_uploaded",
        outcome: "error",
        message: err?.message || String(err)
      });
      return res.status(500).json({
        success: false,
        message: "Failed to upload image",
        correlationId
      });
    }
  }
);

router.get("/me", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const rows = await safeRows<any>(
      `SELECT id, email, name,
        COALESCE(is_verified, verified, false) as is_verified,
        COALESCE(status, 'ACTIVE') as status,
        COALESCE(artist_status, 'PENDING') as artist_status,
        profile_image_url,
        banner_image_url,
        bio,
        artist_bio,
        portfolio_links,
        onboarded_at,
        artist_appeal_message,
        accent_color,
        social_links,
        subscription_price,
        admin_remarks
       FROM users
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       LIMIT 1`,
      [artistUserId],
      []
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    const u = rows[0];
    audit(req, { event: "artist_me_fetched", outcome: "success" });
    return res.json({
      success: true,
      artist: {
        id: u.id,
        email: u.email,
        name: u.name ?? null,
        isVerified: Boolean(u.is_verified),
        status: (u.status ?? "ACTIVE").toString(),
        artistStatus: (u.artist_status ?? "PENDING").toString(),
        profileImageUrl: u.profile_image_url ?? null,
        bannerImageUrl: u.banner_image_url ?? null,
        bio: u.bio ?? "",
        artistBio: u.artist_bio ?? null,
        portfolioLinks: Array.isArray(u.portfolio_links) ? u.portfolio_links : [],
        onboardedAt: u.onboarded_at ?? null,
        appealMessage: u.artist_appeal_message ?? null,
        adminNote: u.admin_remarks ?? null,
        accentColor: u.accent_color ?? null,
        socialLinks: u.social_links ?? null,
        subscriptionPrice: Number(u.subscription_price ?? 0)
      },
      earlyAccessDays: EARLY_ACCESS_DAYS,
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_me_fetched", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch profile", correlationId });
  }
});

router.patch("/me", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const { name, bio, profileImageUrl, bannerImageUrl, accentColor, socialLinks } = req.body as {
      name?: string | null;
      bio?: string | null;
      profileImageUrl?: string | null;
      bannerImageUrl?: string | null;
      accentColor?: string | null;
      socialLinks?: Record<string, any> | null;
    };

    const socialLinksJson =
      socialLinks === undefined
        ? undefined
        : socialLinks
          ? JSON.stringify(socialLinks)
          : null;

    await pool.query(
      `UPDATE users
       SET name = COALESCE($2, name),
           bio = COALESCE($3, bio),
           profile_image_url = COALESCE($4, profile_image_url),
           banner_image_url = COALESCE($5, banner_image_url),
           accent_color = COALESCE($6, accent_color),
           social_links = COALESCE($7, social_links)
       WHERE id = $1 AND UPPER(role) = 'ARTIST'`,
      [
        artistUserId,
        name ?? null,
        bio ?? null,
        profileImageUrl ?? null,
        bannerImageUrl ?? null,
        accentColor ?? null,
        socialLinksJson as any
      ]
    );

    audit(req, {
      event: "artist_profile_updated",
      outcome: "success",
      fields: {
        name: typeof name === "string",
        bio: typeof bio === "string",
        profileImageUrl: typeof profileImageUrl === "string",
        bannerImageUrl: typeof bannerImageUrl === "string",
        accentColor: typeof accentColor === "string",
        socialLinks: socialLinks !== undefined
      }
    });

    return res.json({ success: true, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_profile_updated", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to update profile", correlationId });
  }
});

router.get("/pricing", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const rows = await safeRows<any>(
      "SELECT COALESCE(subscription_price, 0) as subscription_price FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST' LIMIT 1",
      [artistUserId],
      []
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    audit(req, { event: "artist_pricing_fetched", outcome: "success" });
    return res.json({
      success: true,
      subscriptionPrice: Number(rows[0].subscription_price ?? 0),
      earlyAccessDays: EARLY_ACCESS_DAYS,
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_pricing_fetched", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch pricing", correlationId });
  }
});

router.patch("/pricing", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const { subscriptionPrice } = req.body as { subscriptionPrice?: number | string };
    const next = Number(subscriptionPrice);
    if (!Number.isFinite(next) || next < 0) {
      return res.status(400).json({
        success: false,
        message: "subscriptionPrice must be a non-negative number",
        correlationId
      });
    }

    await pool.query(
      "UPDATE users SET subscription_price = $2 WHERE id = $1 AND UPPER(role) = 'ARTIST'",
      [artistUserId, next]
    );

    audit(req, { event: "artist_pricing_updated", outcome: "success", subscriptionPrice: next });
    return res.json({ success: true, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_pricing_updated", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to update pricing", correlationId });
  }
});

router.get("/dashboard/summary", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const subscribers = await (async () => {
      const n = await safeScalarNumber(
        "SELECT COUNT(*)::int as value FROM subscriptions WHERE artist_id = $1 AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'",
        [artistUserId],
        NaN
      );
      if (Number.isFinite(n)) return n;
      return await safeScalarNumber(
        "SELECT COALESCE(subscription_count, 0)::int as value FROM users WHERE id = $1",
        [artistUserId],
        0
      );
    })();

    const totalPlays = await (async () => {
      const n = await safeScalarNumber(
        "SELECT COUNT(*)::int as value FROM content_plays p JOIN content_items c ON c.id = p.content_id WHERE c.artist_id = $1",
        [artistUserId],
        NaN
      );
      return Number.isFinite(n) ? n : 0;
    })();

    const grossEarnings = await (async () => {
      const n = await safeScalarNumber(
        "SELECT COALESCE(SUM(amount), 0)::float as value FROM payments WHERE artist_id = $1 AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID')",
        [artistUserId],
        NaN
      );
      const gross = Number.isFinite(n) ? n : 0;
      return Number((gross * 0.9).toFixed(2));
    })();

    audit(req, { event: "artist_dashboard_summary", outcome: "success" });
    return res.json({
      success: true,
      stats: {
        subscribers,
        totalPlays,
        grossEarnings
      },
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_dashboard_summary", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch dashboard", correlationId });
  }
});

router.get("/dashboard/growth", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  const daysRequested = Number(req.query?.days ?? 30);
  const days = Number.isFinite(daysRequested) ? Math.max(1, Math.min(90, Math.floor(daysRequested))) : 30;

  try {
    const end = new Date();
    const points: { date: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - i);
      points.push({ date: d.toISOString().slice(0, 10) });
    }

    const startIso = points[0].date + "T00:00:00.000Z";
    const rows = await safeRows<{ date: string; value: number }>(
      "SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, COUNT(*)::int as value FROM subscriptions WHERE artist_id = $1 AND created_at >= $2 GROUP BY 1 ORDER BY 1 ASC",
      [artistUserId, startIso],
      []
    );

    const map = new Map<string, number>();
    for (const r of rows) map.set(r.date, Number(r.value) || 0);

    const data = points.map((p) => ({ date: p.date, value: map.get(p.date) ?? 0 }));
    audit(req, { event: "artist_subscribers_growth", outcome: "success", days });
    return res.json({ success: true, data, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_subscribers_growth", outcome: "error", message: err?.message || String(err) });
    return res.json({ success: true, data: [], correlationId });
  }
});

router.get("/dashboard/recent-activity", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const rows = await safeRows<any>(
      `SELECT s.id, s.created_at,
        COALESCE(u.name, u.email) as fan_name,
        u.profile_image_url
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.artist_id = $1
       ORDER BY s.created_at DESC
       LIMIT 10`,
      [artistUserId],
      []
    );

    const items = rows.map((r: any) => ({
      id: r.id,
      fanName: r.fan_name ?? "",
      fanAvatarUrl: r.profile_image_url ?? null,
      createdAt: r.created_at
    }));

    audit(req, { event: "artist_recent_activity", outcome: "success" });
    return res.json({ success: true, items, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_recent_activity", outcome: "error", message: err?.message || String(err) });
    return res.json({ success: true, items: [], correlationId });
  }
});

router.get("/dashboard/new-plays", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const rows = await safeRows<any>(
      `SELECT c.id, c.title, c.thumbnail_url, COUNT(p.id)::int as plays
       FROM content_items c
       LEFT JOIN content_plays p ON p.content_id = c.id
       WHERE c.artist_id = $1
       GROUP BY c.id
       ORDER BY plays DESC, c.created_at DESC
       LIMIT 5`,
      [artistUserId],
      []
    );

    const items = rows.map((r: any) => ({
      contentId: r.id,
      title: r.title,
      artwork: r.thumbnail_url ?? null,
      plays: Number(r.plays ?? 0)
    }));

    audit(req, { event: "artist_new_plays", outcome: "success" });
    return res.json({ success: true, items, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_new_plays", outcome: "error", message: err?.message || String(err) });
    return res.json({ success: true, items: [], correlationId });
  }
});

router.get(
  "/analytics/content-performance",
  requireAuth,
  requireArtist,
  async (req: any, res: any) => {
    const correlationId = req?.correlationId || "-";
    const artistUserId = req.user?.id;

    const daysRequested = Number(req.query?.days ?? 30);
    const days = Number.isFinite(daysRequested) ? Math.max(1, Math.min(365, Math.floor(daysRequested))) : 30;

    try {

      const start = new Date();
      start.setUTCDate(start.getUTCDate() - days);

      const rows = await safeRows<any>(
        `SELECT c.id, c.title, c.thumbnail_url, COUNT(p.id)::int as plays
         FROM content_items c
         LEFT JOIN content_plays p ON p.content_id = c.id AND p.created_at >= $2
         WHERE c.artist_id = $1
         GROUP BY c.id
         ORDER BY plays DESC, c.created_at DESC
         LIMIT 7`,
        [artistUserId, start.toISOString()],
        []
      );

      const items = rows.map((r: any) => ({
        contentId: r.id,
        title: r.title,
        thumbnailUrl: r.thumbnail_url ?? null,
        plays: Number(r.plays ?? 0)
      }));

      audit(req, { event: "artist_content_performance", outcome: "success", days });
      return res.json({ success: true, days, items, correlationId });
    } catch (err: any) {
      audit(req, { event: "artist_content_performance", outcome: "error", message: err?.message || String(err) });
      return res.status(500).json({ success: false, message: "Failed to fetch content performance", correlationId });
    }
  }
);

router.get("/analytics/summary", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 30);

    const gross = await safeScalarNumber(
      "SELECT COALESCE(SUM(amount), 0)::float as value FROM payments WHERE artist_id = $1 AND created_at >= $2 AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID')",
      [artistUserId, start.toISOString()],
      0
    );

    audit(req, { event: "artist_analytics_summary", outcome: "success" });
    return res.json({
      success: true,
      last30Days: {
        grossEarnings: Number((Number(gross || 0) * 0.9).toFixed(2))
      },
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_analytics_summary", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch analytics summary", correlationId });
  }
});

router.get("/channel-preview", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const artistRows = await safeRows<any>(
      `SELECT id, email, name,
        profile_image_url,
        banner_image_url,
        COALESCE(bio, '') as bio
       FROM users
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       LIMIT 1`,
      [artistUserId],
      []
    );

    if (!artistRows.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    const now = new Date();

    const contentRows = await safeRows<any>(
      `SELECT id, title, type, thumbnail_url, created_at,
        published_at,
        COALESCE(subscription_required, false) as subscription_required,
        COALESCE(is_approved, false) as is_approved,
        COALESCE(lifecycle_state, 'DRAFT') as lifecycle_state
       FROM content_items
       WHERE artist_id = $1
         AND COALESCE(is_approved, false) = true
       ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
       LIMIT 200`,
      [artistUserId],
      []
    );

    const items = contentRows.map((r: any) => {
      const publishedAt = r.published_at ? new Date(r.published_at) : null;
      const subscriptionRequired = Boolean(r.subscription_required);
      const isEarlyAccess = Boolean(subscriptionRequired && publishedAt && publishedAt.getTime() > now.getTime());

      return {
        id: r.id,
        title: r.title,
        type: (r.type ?? "").toString(),
        thumbnailUrl: r.thumbnail_url ?? null,
        subscriptionRequired,
        publishedAt: r.published_at ?? null,
        isEarlyAccess
      };
    });

    const a = artistRows[0];
    audit(req, { event: "artist_channel_preview", outcome: "success", items: items.length });
    return res.json({
      success: true,
      artist: {
        id: a.id,
        name: a.name ?? null,
        email: a.email,
        profileImageUrl: a.profile_image_url ?? null,
        bannerImageUrl: a.banner_image_url ?? null,
        bio: a.bio ?? ""
      },
      items,
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_channel_preview", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch channel preview", correlationId });
  }
});

router.patch("/update-password", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "currentPassword and newPassword are required",
        correlationId
      });
    }

    const userId = req.user?.id;

    const result = await pool.query(
      "SELECT id, password FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST'",
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
        correlationId
      });
    }

    const user = result.rows[0] as any;
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
        correlationId
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password = $2 WHERE id = $1", [user.id, hashedPassword]);

    audit(req, { event: "artist_password_updated", outcome: "success" });

    return res.json({
      success: true,
      message: "Password updated successfully",
      correlationId
    });
  } catch (err: any) {
    audit(req, {
      event: "artist_password_updated",
      outcome: "error",
      message: err?.message || String(err)
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update password",
      correlationId
    });
  }
});

export default router;

