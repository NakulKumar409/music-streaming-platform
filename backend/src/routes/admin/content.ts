import { Router } from "express";
import { requireAuth } from "../../common/auth/requireAuth";
import { pool } from "../../common/db";

const router = Router();

const requireAdmin = (req: any, res: any, next: any) => {
  const role = (req.user?.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Forbidden"
    });
  }
  return next();
};

const ensureContentSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_items (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL,
      artist_id INT NOT NULL,
      thumbnail_url TEXT,
      media_url TEXT,
      audio_url TEXT,
      video_url TEXT,
      genre VARCHAR(80),
      lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
      is_approved BOOLEAN NOT NULL DEFAULT true,
      rejection_reason TEXT,
      report_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS title VARCHAR(255)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS type VARCHAR(20)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS artist_id INT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS media_url TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS audio_url TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS video_url TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS genre VARCHAR(80)");
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'"
  );
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true"
  );
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS rejection_reason TEXT");
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );

  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ");
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS subscription_required BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS status VARCHAR(20)").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0").catch(() => undefined);

  await pool
    .query("ALTER TABLE content_items ALTER COLUMN lifecycle_state SET DEFAULT 'PUBLISHED'")
    .catch(() => undefined);
  await pool
    .query("ALTER TABLE content_items ALTER COLUMN is_approved SET DEFAULT true")
    .catch(() => undefined);

  await pool
    .query("ALTER TABLE content_items ALTER COLUMN status SET DEFAULT 'APPROVED'")
    .catch(() => undefined);

  await pool
    .query("ALTER TABLE content_items ALTER COLUMN report_count SET DEFAULT 0")
    .catch(() => undefined);

  // Idempotent: publish any legacy pending items.
  await pool
    .query(
      `UPDATE content_items
       SET is_approved = true,
           lifecycle_state = 'PUBLISHED',
           status = COALESCE(NULLIF(status, ''), 'APPROVED'),
           published_at = COALESCE(published_at, now()),
           rejection_reason = NULL
       WHERE COALESCE(is_approved, false) = false
         AND UPPER(COALESCE(lifecycle_state, 'DRAFT')) = 'DRAFT'`
    )
    .catch(() => undefined);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reason VARCHAR(80) NOT NULL,
      content_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason VARCHAR(80)").catch(() => undefined);
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS content_id INT").catch(() => undefined);
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS user_id INT").catch(() => undefined);
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()").catch(() => undefined);

  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_content_user ON reports(content_id, user_id)"
  ).catch(() => undefined);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_reports_content_id ON reports(content_id)").catch(() => undefined);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)").catch(() => undefined);
};

router.get("/pending", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  await ensureContentSchema();
  return res.status(404).json({
    success: false,
    message: "Content approval workflow has been removed",
    correlationId
  });
});

router.get("/flagged", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {
    await ensureContentSchema();

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const toAbsoluteUrl = (value: any) => {
      const raw = (value ?? "").toString().trim();
      if (!raw) return null;
      if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
      if (raw.startsWith("/")) return `${baseUrl}${raw}`;
      return `${baseUrl}/${raw}`;
    };

    const rows = await pool.query(
      `WITH reason_counts AS (
         SELECT content_id, reason, COUNT(*)::int as count
         FROM reports
         GROUP BY 1, 2
       )
       SELECT
         c.id,
         c.title,
         c.type,
         c.thumbnail_url,
         c.media_url,
         c.audio_url,
         c.video_url,
         c.lifecycle_state,
         c.is_approved,
         c.status,
         c.report_count,
         c.created_at,
         c.artist_id,
         COALESCE(NULLIF(u.name, ''), NULLIF(u.full_name, ''), NULLIF(u.username, ''), NULLIF(split_part(u.email, '@', 1), ''), u.email) as artist_name,
         COALESCE(
           json_agg(json_build_object('reason', rc.reason, 'count', rc.count))
             FILTER (WHERE rc.reason IS NOT NULL),
           '[]'::json
         ) as reasons
       FROM content_items c
       LEFT JOIN users u ON u.id = c.artist_id
       LEFT JOIN reason_counts rc ON rc.content_id = c.id
       WHERE UPPER(COALESCE(c.status, '')) = 'FLAGGED'
       GROUP BY c.id, u.id
       ORDER BY c.created_at DESC
       LIMIT 200`,
      []
    );

    const items = (rows.rows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      type: (r.type ?? "").toString(),
      thumbnailUrl: toAbsoluteUrl(r.thumbnail_url),
      mediaUrl: toAbsoluteUrl(r.media_url),
      fileUrl: toAbsoluteUrl(r.media_url),
      audioUrl: toAbsoluteUrl(r.audio_url),
      videoUrl: toAbsoluteUrl(r.video_url),
      status: (r.status ?? "FLAGGED").toString(),
      reportCount: Number(r.report_count ?? 0),
      reasons: r.reasons ?? [],
      artist: {
        id: r.artist_id,
        name: r.artist_name ?? null
      },
      createdAt: r.created_at,
      lifecycleState: r.lifecycle_state,
      isApproved: r.is_approved
    }));

    return res.json({ success: true, items, correlationId });
  } catch (err: any) {
    console.error("[admin/moderation] /flagged error", correlationId, err?.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch flagged content",
      correlationId
    });
  }
});

router.post("/:id/restore", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id", correlationId });
  }

  try {
    await ensureContentSchema();

    await pool.query("BEGIN");
    const updated = await pool.query(
      `UPDATE content_items
       SET status = 'APPROVED',
           report_count = 0,
           rejection_reason = NULL
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!updated.rows?.length) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Content not found", correlationId });
    }

    await pool.query("DELETE FROM reports WHERE content_id = $1", [id]);
    await pool.query("COMMIT");

    return res.json({ success: true, correlationId });
  } catch (err: any) {
    await pool.query("ROLLBACK").catch(() => undefined);
    console.error("[admin/moderation] /restore error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to restore content", correlationId });
  }
});

router.post("/:id/delete-strike", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id", correlationId });
  }

  try {
    await ensureContentSchema();

    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS strike_count INT NOT NULL DEFAULT 0").catch(() => undefined);
    await pool.query("ALTER TABLE users ALTER COLUMN strike_count SET DEFAULT 0").catch(() => undefined);

    await pool.query("BEGIN");
    const updated = await pool.query(
      `WITH target AS (
         SELECT id, artist_id
         FROM content_items
         WHERE id = $1
         LIMIT 1
       ),
       mark_deleted AS (
         UPDATE content_items
         SET status = 'DELETED'
         WHERE id IN (SELECT id FROM target)
         RETURNING id
       ),
       strike AS (
         UPDATE users
         SET strike_count = COALESCE(strike_count, 0) + 1
         WHERE id IN (SELECT artist_id FROM target)
         RETURNING id
       )
       SELECT (SELECT id FROM mark_deleted LIMIT 1) as content_id`,
      [id]
    );

    if (!updated.rows?.[0]?.content_id) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Content not found", correlationId });
    }

    await pool.query("DELETE FROM reports WHERE content_id = $1", [id]);
    await pool.query("COMMIT");

    return res.json({ success: true, correlationId });
  } catch (err: any) {
    await pool.query("ROLLBACK").catch(() => undefined);
    console.error("[admin/moderation] /delete-strike error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to delete content", correlationId });
  }
});

router.post("/artists/:artistId/ban", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistId = Number(req.params.artistId);
  if (!Number.isFinite(artistId)) {
    return res.status(400).json({ success: false, message: "Invalid artistId", correlationId });
  }

  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'").catch(() => undefined);
    const r = await pool.query(
      "UPDATE users SET status = 'BANNED' WHERE id = $1 RETURNING id",
      [artistId]
    );

    if (!r.rows?.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    return res.json({ success: true, correlationId });
  } catch (err: any) {
    console.error("[admin/moderation] /ban error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to ban artist", correlationId });
  }
});

router.patch("/:id/approve", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  await ensureContentSchema();
  return res.status(404).json({
    success: false,
    message: "Content approval workflow has been removed",
    correlationId
  });
});

router.patch("/:id/reject", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  await ensureContentSchema();
  return res.status(404).json({
    success: false,
    message: "Content approval workflow has been removed",
    correlationId
  });
});

export default router;
