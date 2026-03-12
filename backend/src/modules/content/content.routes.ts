import { Router } from "express";
import { pool } from "../../common/db";
import { checkContentAccess } from "../../common/accessControl";
import { getMediaConfig } from "../../config/media.config";
import { createPlaybackToken } from "../../shared/security/signed-media-token.service";

const router = Router();

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
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS audio_url TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS video_url TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS genre VARCHAR(80)");
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'DRAFT'"
  );
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS rejection_reason TEXT");
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );

  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ");
  await pool.query(
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS subscription_required BOOLEAN NOT NULL DEFAULT false"
  );
};

const ensurePlaysSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_plays (
      id SERIAL PRIMARY KEY,
      content_id INT NOT NULL,
      user_id INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query("ALTER TABLE content_plays ADD COLUMN IF NOT EXISTS content_id INT");
  await pool.query("ALTER TABLE content_plays ADD COLUMN IF NOT EXISTS user_id INT");
  await pool.query(
    "ALTER TABLE content_plays ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_content_plays_content_id ON content_plays(content_id)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_content_plays_created_at ON content_plays(created_at)"
  );
};

const ensureReactionsSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_reactions (
      id SERIAL PRIMARY KEY,
      content_id INT NOT NULL,
      user_id INT NOT NULL,
      reaction VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query("ALTER TABLE content_reactions ADD COLUMN IF NOT EXISTS content_id INT");
  await pool.query("ALTER TABLE content_reactions ADD COLUMN IF NOT EXISTS user_id INT");
  await pool.query("ALTER TABLE content_reactions ADD COLUMN IF NOT EXISTS reaction VARCHAR(20)");
  await pool.query(
    "ALTER TABLE content_reactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );

  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reactions_unique ON content_reactions(content_id, user_id)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_content_reactions_content_id ON content_reactions(content_id)"
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

const restrictedMediaUrl = (req: any, mediaType: 'audio' | 'video') => {
  const path = mediaType === 'video' ? '/uploads/restricted.mp4' : '/uploads/restricted.mp3';
  return toAbsoluteUrl(req, path);
};

router.get("/", (req, res) => {
  // Prevent conditional requests (ETag/If-None-Match) from returning 304 with an empty body.
  // Mobile clients rely on a JSON payload here.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.removeHeader('ETag');

  (async () => {
    try {
      await ensureContentSchema();
      await ensurePlaysSchema();
      await ensureReactionsSchema();
      const userId = req.user?.id ? Number(req.user.id) : null;
      const isDev = process.env.NODE_ENV !== 'production';
      
      let rows: any;
      try {
        rows = await pool.query(
          `SELECT
             c.id,
             c.title,
             c.type,
             c.thumbnail_url,
             c.media_url,
             c.audio_url,
             c.video_url,
             c.storage_key,
             c.video_storage_key,
             c.thumbnail_storage_key,
             c.created_at,
             c.artist_id,
             c.subscription_required,
             COALESCE(NULLIF(u.name, ''), NULLIF(u.full_name, ''), NULLIF(u.username, ''), NULLIF(split_part(u.email, '@', 1), ''), u.email) as artist_name
           FROM content_items c
           LEFT JOIN users u ON u.id = c.artist_id
           WHERE ${isDev ? "true" : "COALESCE(c.is_approved, false) = true"}
             AND UPPER(COALESCE(c.lifecycle_state, '')) IN ('PUBLISHED', 'READY'${isDev ? ", 'PENDING', 'PROCESSING'" : ""})
           ORDER BY c.created_at DESC
           LIMIT 200`,
          []
        );
      } catch (err: any) {
        if (err?.code === '42703') {
          rows = await pool.query(
            `SELECT
               c.id,
               c.title,
               c.type,
               c.thumbnail_url,
               c.media_url,
               c.audio_url,
               c.video_url,
               c.storage_key,
               c.video_storage_key,
               c.thumbnail_storage_key,
               c.created_at,
               c.artist_id,
               c.subscription_required,
               COALESCE(NULLIF(u.name, ''), NULLIF(split_part(u.email, '@', 1), ''), u.email) as artist_name
             FROM content_items c
             LEFT JOIN users u ON u.id = c.artist_id
             WHERE ${isDev ? "true" : "COALESCE(c.is_approved, false) = true"}
               AND UPPER(COALESCE(c.lifecycle_state, '')) IN ('PUBLISHED', 'READY'${isDev ? ", 'PENDING', 'PROCESSING'" : ""})
             ORDER BY c.created_at DESC
             LIMIT 200`,
            []
          );
        } else {
          throw err;
        }
      }

      const items = await Promise.all((rows.rows ?? []).map(async (r: any) => {
        const { isLocked } = await checkContentAccess(userId, r.id);
        const typeRaw = (r.type ?? '').toString().toLowerCase();
        const hasVideo = Boolean(r.video_storage_key || r.video_url);
        const mediaType = (typeRaw.includes('video') || hasVideo ? 'video' : 'audio') as 'audio' | 'video';

        const storageKeyForType = mediaType === 'video' ? (r.video_storage_key ?? r.storage_key) : r.storage_key;
        const hasNewStorage = !!storageKeyForType;

        const legacyMediaUrlRaw =
          mediaType === 'video'
            ? (r.video_url ?? r.media_url)
            : (r.audio_url ?? r.media_url);
        const unlockedMediaUrl = hasNewStorage ? null : toAbsoluteUrl(req, legacyMediaUrlRaw);
        const finalMediaUrl = isLocked ? restrictedMediaUrl(req, mediaType) : unlockedMediaUrl;

        const finalAudioUrl = mediaType === 'audio' ? finalMediaUrl : null;

        const thumbnailUrl = r.thumbnail_url
          ? toAbsoluteUrl(req, r.thumbnail_url)
          : r.thumbnail_storage_key
            ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
            : null;

        const [viewCount, likeCount, dislikeCount] = await Promise.all([
          pool
            .query('SELECT COUNT(*)::int as c FROM content_plays WHERE content_id = $1', [r.id])
            .then((x) => Number(x.rows?.[0]?.c ?? 0))
            .catch(() => 0),
          pool
            .query(
              "SELECT COUNT(*)::int as c FROM content_reactions WHERE content_id = $1 AND reaction = 'like'",
              [r.id]
            )
            .then((x) => Number(x.rows?.[0]?.c ?? 0))
            .catch(() => 0),
          pool
            .query(
              "SELECT COUNT(*)::int as c FROM content_reactions WHERE content_id = $1 AND reaction = 'dislike'",
              [r.id]
            )
            .then((x) => Number(x.rows?.[0]?.c ?? 0))
            .catch(() => 0),
        ]);
        
        return {
          id: r.id,
          title: r.title,
          type: r.type,
          mediaType,
          thumbnailUrl,
          artwork: thumbnailUrl,
          mediaUrl: finalMediaUrl,
          fileUrl: finalMediaUrl,
          audioUrl: finalAudioUrl,
          storageKey: storageKeyForType ?? null,
          useStreamAccess: hasNewStorage,
          createdAt: r.created_at,
          artistName: r.artist_name ?? null,
          artistId: r.artist_id,
          subscriptionRequired: Boolean(r.subscription_required),
          isLocked,
          viewCount,
          likeCount,
          dislikeCount
        };
      }));

      const meta = items.reduce(
        (acc: any, it: any) => {
          acc.total += 1;
          if (it?.mediaType === 'video') acc.video += 1;
          else if (it?.mediaType === 'audio') acc.audio += 1;
          return acc;
        },
        { total: 0, audio: 0, video: 0 }
      );

      console.log('[fan/content] audio items found', {
        total: meta.total,
        audio: meta.audio,
        video: meta.video
      });

      return res.json({ success: true, items, meta });
    } catch (err: any) {
      console.error("[fan/content] GET / error", err);
      return res.json({ success: true, items: [] });
    }
  })();
});

router.get("/artist/:artistId", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.removeHeader('ETag');

  (async () => {
    const artistId = Number(req.params.artistId);
    if (!Number.isFinite(artistId) || artistId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid artist id" });
    }

    try {
      await ensureContentSchema();
      const userId = req.user?.id ? Number(req.user.id) : null;
      const isDev = process.env.NODE_ENV !== 'production';
      
      const rows = await pool.query(
        `SELECT id,
                title,
                type,
                thumbnail_url,
                media_url,
                audio_url,
                video_url,
                storage_key,
                video_storage_key,
                thumbnail_storage_key,
                created_at,
                subscription_required,
                visibility,
                status,
                is_approved
         FROM content_items
         WHERE artist_id = $1
           AND ${isDev ? "true" : "COALESCE(is_approved, false) = true"}
           AND UPPER(COALESCE(lifecycle_state, '')) IN ('PUBLISHED', 'READY'${isDev ? ", 'PENDING', 'PROCESSING'" : ""})
         ORDER BY created_at DESC
         LIMIT 500`,
        [artistId]
      );

      const mediaCfg = getMediaConfig();
      const streamRoute = (mediaCfg.localPrivateStreamRoute || "media/stream").replace(/^\//, "");
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const issueStreamUrl = (contentId: number, kind: "audio" | "video") => {
        const token = createPlaybackToken(contentId, userId ?? 0, mediaCfg.mediaUrlTtlSeconds);
        return `${baseUrl}/${streamRoute}/${contentId}?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(
          kind
        )}`;
      };

      const items = await Promise.all(
        (rows.rows ?? []).map(async (r: any) => {
          const { isLocked } = await checkContentAccess(userId, r.id);
          const type = (r.type ?? "").toString().toLowerCase();

          const hasAudio = Boolean(r.storage_key || r.audio_url || r.media_url);
          const hasVideo = Boolean(r.video_storage_key || r.video_url);

          const isAudioVideo = type === 'audio_video' || type === 'audiovideo' || type === 'audio+video';
          const inferredMediaType = isAudioVideo ? 'audio_video' : (type.includes('video') || hasVideo ? 'video' : 'audio');

          const hasNewAudioStorage = Boolean(r.storage_key);
          const hasNewVideoStorage = Boolean(r.video_storage_key || (type === "video" && r.storage_key));

          const legacyAudioUrlRaw = r.audio_url ?? r.media_url;
          const legacyVideoUrlRaw = r.video_url ?? r.media_url;

          const streamAudioUrl = hasNewAudioStorage && !isLocked ? issueStreamUrl(r.id, "audio") : null;
          const streamVideoUrl = hasNewVideoStorage && !isLocked ? issueStreamUrl(r.id, "video") : null;

          const unlockedAudioUrl =
            streamAudioUrl || (!hasNewAudioStorage ? toAbsoluteUrl(req, legacyAudioUrlRaw) : null);
          const unlockedVideoUrl =
            streamVideoUrl || (!hasNewVideoStorage ? toAbsoluteUrl(req, legacyVideoUrlRaw) : null);

          const finalAudioUrl = hasAudio ? (isLocked ? restrictedMediaUrl(req, "audio") : unlockedAudioUrl) : null;
          const finalVideoUrl = hasVideo ? (isLocked ? restrictedMediaUrl(req, "video") : unlockedVideoUrl) : null;

          const finalMediaUrl = inferredMediaType === "video" ? finalVideoUrl : finalAudioUrl;
          const useStreamAccess = Boolean((hasNewAudioStorage || hasNewVideoStorage) && !isLocked);

          const thumbnailUrl = r.thumbnail_url
            ? toAbsoluteUrl(req, r.thumbnail_url)
            : r.thumbnail_storage_key
              ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
              : null;

          const [viewCount, likeCount, dislikeCount] = await Promise.all([
            pool
              .query('SELECT COUNT(*)::int as c FROM content_plays WHERE content_id = $1', [r.id])
              .then((x) => Number(x.rows?.[0]?.c ?? 0))
              .catch(() => 0),
            pool
              .query(
                "SELECT COUNT(*)::int as c FROM content_reactions WHERE content_id = $1 AND reaction = 'like'",
                [r.id]
              )
              .then((x) => Number(x.rows?.[0]?.c ?? 0))
              .catch(() => 0),
            pool
              .query(
                "SELECT COUNT(*)::int as c FROM content_reactions WHERE content_id = $1 AND reaction = 'dislike'",
                [r.id]
              )
              .then((x) => Number(x.rows?.[0]?.c ?? 0))
              .catch(() => 0),
          ]);

          return {
            id: r.id,
            title: r.title,
            type,
            mediaType: inferredMediaType,
            thumbnailUrl,
            artwork: thumbnailUrl,
            mediaUrl: finalMediaUrl,
            fileUrl: finalMediaUrl,
            audioUrl: finalAudioUrl,
            videoUrl: finalVideoUrl,
            // We return direct stream URLs, so client does not need POST /stream/access
            useStreamAccess,
            subscriptionRequired: Boolean(r.subscription_required),
            isLocked,
            createdAt: r.created_at,
            viewCount,
            likeCount,
            dislikeCount
          };
        })
      );

      if (process.env.NODE_ENV !== 'production') {
        const meta = items.reduce(
          (acc: any, it: any) => {
            acc.total += 1;
            if (it?.mediaType === 'video') acc.video += 1;
            else if (it?.mediaType === 'audio') acc.audio += 1;
            return acc;
          },
          { total: 0, audio: 0, video: 0 }
        );
        console.log('[fan/content] artist audio items found', { artistId, ...meta });
      }

      return res.json({ success: true, items });
    } catch (err: any) {
      console.error("[fan/content] GET /artist/:artistId error", { artistId }, err);
      return res.status(500).json({ success: false, message: "Failed to fetch artist content" });
    }
  })();
});

router.get("/:id", (req, res) => {
  (async () => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    try {
      await ensureContentSchema();
      const userId = req.user?.id ? Number(req.user.id) : null;
      
      let rows: any;
      try {
        rows = await pool.query(
          `SELECT
             c.id,
             c.title,
             c.type,
             c.thumbnail_url,
             c.media_url,
             c.audio_url,
             c.video_url,
             c.storage_key,
             c.video_storage_key,
             c.thumbnail_storage_key,
             c.subscription_required,
             c.artist_id,
             COALESCE(NULLIF(u.name, ''), NULLIF(u.full_name, ''), NULLIF(u.username, ''), NULLIF(split_part(u.email, '@', 1), ''), u.email) as artist_name
           FROM content_items c
           LEFT JOIN users u ON u.id = c.artist_id
           WHERE c.id = $1
             AND COALESCE(c.is_approved, false) = true
             AND UPPER(COALESCE(c.lifecycle_state, '')) = 'PUBLISHED'
           LIMIT 1`,
          [id]
        );
      } catch (err: any) {
        if (err?.code === '42703') {
          rows = await pool.query(
            `SELECT
               c.id,
               c.title,
               c.type,
               c.thumbnail_url,
               c.media_url,
               c.audio_url,
               c.video_url,
               c.storage_key,
               c.video_storage_key,
               c.thumbnail_storage_key,
               c.subscription_required,
               c.artist_id,
               COALESCE(NULLIF(u.name, ''), NULLIF(split_part(u.email, '@', 1), ''), u.email) as artist_name
             FROM content_items c
             LEFT JOIN users u ON u.id = c.artist_id
             WHERE c.id = $1
               AND COALESCE(c.is_approved, false) = true
               AND UPPER(COALESCE(c.lifecycle_state, '')) = 'PUBLISHED'
             LIMIT 1`,
            [id]
          );
        } else {
          throw err;
        }
      }

      if (!rows.rows?.length) {
        return res.status(404).json({ success: false, message: "Content not found" });
      }

      const r: any = rows.rows[0];
      const { isLocked } = await checkContentAccess(userId, r.id);
      const type = (r.type ?? '').toString().toLowerCase();
      const mediaType = type === 'video' ? 'video' : 'audio';

      const storageKeyForType = mediaType === 'video' ? (r.video_storage_key ?? r.storage_key) : r.storage_key;
      const hasNewStorage = !!storageKeyForType;

      const legacyMediaUrlRaw =
        mediaType === 'video'
          ? (r.video_url ?? r.media_url)
          : (r.audio_url ?? r.media_url);
      const unlockedMediaUrl = hasNewStorage ? null : toAbsoluteUrl(req, legacyMediaUrlRaw);
      const finalMediaUrl = isLocked ? restrictedMediaUrl(req, mediaType) : unlockedMediaUrl;

      const thumbnailUrl = r.thumbnail_url
        ? toAbsoluteUrl(req, r.thumbnail_url)
        : r.thumbnail_storage_key
          ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
          : null;
      
      return res.json({
        success: true,
        content: {
          id: r.id,
          title: r.title,
          type: r.type,
          isLocked,
          subscriptionRequired: Boolean(r.subscription_required),
          artistId: r.artist_id,
          artistName: r.artist_name ?? null,
          artwork: thumbnailUrl,
          thumbnailUrl,
          mediaUrl: finalMediaUrl,
          fileUrl: finalMediaUrl,
          useStreamAccess: hasNewStorage,
        }
      });
    } catch (err: any) {
      console.error("[fan/content] GET /:id error", { id }, err);
      return res.status(500).json({ success: false, message: "Failed to fetch content" });
    }
  })();
});

export default router;
