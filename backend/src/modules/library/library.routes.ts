import { Router } from "express";
import { requireAuth } from "../../common/auth/requireAuth";
import { pool } from "../../common/db";

const router = Router();

const ensureSubscriptionsSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      artist_id INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      plan_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
      start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      end_date TIMESTAMPTZ,
      auto_renew BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, artist_id)
    )
  `);

  await pool.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INT");
  await pool.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS artist_id INT");
  await pool.query(
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'"
  );
  await pool.query(
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY'"
  );
  await pool.query(
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
  await pool.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ");
  await pool.query(
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true"
  );
  await pool.query(
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
  await pool.query(
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_subscriptions_artist_id ON subscriptions(artist_id)"
  );
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
      genre VARCHAR(80),
      lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      is_approved BOOLEAN NOT NULL DEFAULT false,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS title VARCHAR(255)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS type VARCHAR(20)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS artist_id INT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS media_url TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ");
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS subscription_required BOOLEAN NOT NULL DEFAULT false"
  );
};

const ensurePlaybackHistorySchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS playback_history (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      content_id INT NOT NULL,
      played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, content_id)
    )
  `);

  await pool.query("ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS user_id INT");
  await pool.query("ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS content_id INT");
  await pool.query(
    "ALTER TABLE playback_history ADD COLUMN IF NOT EXISTS played_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_playback_history_user_id ON playback_history(user_id)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_playback_history_played_at ON playback_history(played_at)"
  );
};

const toAbsoluteUrl = (req: any, value: any) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  if (raw.startsWith("/")) return `${baseUrl}${raw}`;
  return `${baseUrl}/${raw}`;
};

router.get("/subscribed-artists", requireAuth, async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    await ensureSubscriptionsSchema();

    const rows = await pool.query(
      `SELECT
        u.id,
        COALESCE(u.name, u.email) as name,
        COALESCE(u.is_verified, u.verified, false) as is_verified,
        u.profile_image_url,
        COALESCE(u.status, 'ACTIVE') as status,
        COALESCE(u.genre, '') as genre
       FROM subscriptions s
       JOIN users u ON u.id = s.artist_id
       WHERE s.user_id = $1
         AND UPPER(COALESCE(s.status, 'ACTIVE')) = 'ACTIVE'
         AND (s.end_date IS NULL OR s.end_date > now())
         AND UPPER(COALESCE(u.role, '')) = 'ARTIST'
         AND COALESCE(u.status, 'ACTIVE') = 'ACTIVE'
       ORDER BY s.updated_at DESC, s.created_at DESC
       LIMIT 200`,
      [userId]
    );

    const artists = (rows.rows ?? []).map((r: any) => ({
      id: r.id,
      name: (r.name ?? "Artist").toString(),
      isVerified: Boolean(r.is_verified),
      profileImageUrl: toAbsoluteUrl(req, r.profile_image_url),
      status: (r.status ?? "ACTIVE").toString(),
      genre: (r.genre ?? "").toString(),
    }));

    return res.json({ success: true, artists });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to fetch subscribed artists" });
  }
});

router.get("/recently-played", requireAuth, async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const limitRequested = Number(req.query?.limit ?? 15);
  const limit = Number.isFinite(limitRequested)
    ? Math.max(1, Math.min(30, Math.floor(limitRequested)))
    : 15;

  try {
    await ensurePlaybackHistorySchema();
    await ensureContentSchema();

    const rows = await pool.query(
      `SELECT
        ph.content_id,
        ph.played_at,
        c.title,
        c.type,
        c.thumbnail_url,
        c.media_url,
        c.artist_id,
        COALESCE(a.name, a.email) as artist_name,
        a.profile_image_url as artist_profile_image_url
       FROM playback_history ph
       JOIN content_items c ON c.id = ph.content_id
       LEFT JOIN users a ON a.id = c.artist_id
       WHERE ph.user_id = $1
       ORDER BY ph.played_at DESC
       LIMIT ${limit}`,
      [userId]
    );

    const items = (rows.rows ?? []).map((r: any) => {
      const type = (r.type ?? "").toString().toLowerCase();
      const mediaType = type === "video" ? "video" : "audio";
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      return {
        id: r.content_id,
        title: (r.title ?? "Untitled").toString(),
        mediaType,
        artistId: r.artist_id ?? null,
        artistName: (r.artist_name ?? "Artist").toString(),
        artworkUrl: `${baseUrl}/api/v1/fan/stream/thumbnail/${r.content_id}`,
        mediaUrl: toAbsoluteUrl(req, r.media_url),
        playedAt: r.played_at,
        artistProfileImageUrl: toAbsoluteUrl(req, r.artist_profile_image_url),
      };
    });

    return res.json({ success: true, items });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to fetch recently played" });
  }
});

router.post("/playback", requireAuth, async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const songId = Number(req.body?.songId ?? req.body?.contentId ?? req.body?.id);
  if (!Number.isFinite(songId) || songId <= 0) {
    return res.status(400).json({ success: false, message: "songId is required" });
  }

  try {
    await ensurePlaybackHistorySchema();

    await pool.query(
      `INSERT INTO playback_history (user_id, content_id, played_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, content_id)
       DO UPDATE SET played_at = EXCLUDED.played_at`,
      [userId, songId]
    );

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to record playback" });
  }
});

export default router;
