import { Router } from "express";
import { pool } from "../../common/db";
import { checkContentAccess } from "../../common/accessControl";
import { getMediaConfig } from "../../config/media.config";
import { createPlaybackToken } from "../../shared/security/signed-media-token.service";

const router = Router();

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

const ensureFanArtistProfileSchema = async () => {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_bio TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false").catch(() => undefined);
  await pool.query("ALTER TABLE users ALTER COLUMN is_deleted SET DEFAULT false").catch(() => undefined);
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
      storage_key TEXT,
      video_storage_key TEXT,
      thumbnail_storage_key TEXT,
      genre VARCHAR(80),
      lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
      is_approved BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) DEFAULT 'APPROVED',
      subscription_required BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => undefined);

  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS title VARCHAR(255)").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS type VARCHAR(20)").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS artist_id INT").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS media_url TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS audio_url TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS video_url TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS storage_key TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS video_storage_key TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_storage_key TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS genre VARCHAR(80)").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'APPROVED'").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS subscription_required BOOLEAN NOT NULL DEFAULT false").catch(() => undefined);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()").catch(() => undefined);
};

router.get("/", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.removeHeader('ETag');

  (async () => {
    try {
      await ensureFanArtistProfileSchema();
      const r = await pool.query(
        `SELECT id,
          name,
          COALESCE(is_verified, verified, false) as is_verified,
          profile_image_url,
          COALESCE(status, 'ACTIVE') as status,
          COALESCE(subscription_price, 0) as subscription_price,
          COALESCE(genre, '') as genre
         FROM users
         WHERE UPPER(role) = 'ARTIST'
           AND COALESCE(is_deleted, false) = false
           AND COALESCE(is_verified, verified, false) = true
           AND COALESCE(status, 'ACTIVE') = 'ACTIVE'
         ORDER BY id DESC
         LIMIT 100`
      );

      const artists = (r.rows ?? []).map((row: any) => ({
        id: row.id,
        name: row.name ?? null,
        isVerified: Boolean(row.is_verified),
        profileImageUrl: toAbsoluteUrl(req, row.profile_image_url),
        status: (row.status ?? 'ACTIVE').toString(),
        subscriptionPrice: Number(row.subscription_price ?? 0),
        genre: (row.genre ?? '').toString(),
      }));

      return res.json({ success: true, artists });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to fetch artists" });
    }
  })();
});

router.get("/:artistId", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.removeHeader('ETag');

  (async () => {
    const artistId = Number(req.params.artistId);
    if (!Number.isFinite(artistId) || artistId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid artistId" });
    }

    try {
      await ensureFanArtistProfileSchema();
      const rows = await pool.query(
        `SELECT id,
          name,
          COALESCE(is_verified, verified, false) as is_verified,
          profile_image_url,
          bio,
          artist_bio,
          social_links,
          COALESCE(status, 'ACTIVE') as status,
          COALESCE(subscription_price, 0) as subscription_price,
          COALESCE(genre, '') as genre
         FROM users
         WHERE id = $1
           AND UPPER(role) = 'ARTIST'
           AND COALESCE(is_deleted, false) = false
         LIMIT 1`,
        [artistId]
      );

      if (!rows.rows?.length) {
        return res.status(404).json({ success: false, message: "Artist not found" });
      }

      const row: any = rows.rows[0];
      const socialLinks = (row.social_links ?? null) as any;
      const spotifyUrl = (socialLinks?.spotify ?? null) ? String(socialLinks.spotify) : null;
      const youtubeUrl = (socialLinks?.youtube ?? null) ? String(socialLinks.youtube) : null;
      const instagramUrl = (socialLinks?.instagram ?? null) ? String(socialLinks.instagram) : null;
      const primaryBio = (row.bio ?? '').toString().trim();
      const fallbackBio = (row.artist_bio ?? '').toString().trim();
      const bio = primaryBio || fallbackBio;
      return res.json({
        success: true,
        artist: {
          id: row.id,
          name: row.name ?? null,
          isVerified: Boolean(row.is_verified),
          profileImageUrl: toAbsoluteUrl(req, row.profile_image_url),
          coverImageUrl: toAbsoluteUrl(req, row.profile_image_url),
          bio,
          socialLinks: socialLinks ?? null,
          spotifyUrl,
          youtubeUrl,
          instagramUrl,
          status: (row.status ?? 'ACTIVE').toString(),
          subscriptionPrice: Number(row.subscription_price ?? 0),
          genre: (row.genre ?? '').toString(),
        },
      });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to fetch artist" });
    }
  })();
});

router.get("/:artistId/content", (req, res) => {
  (async () => {
    const artistId = Number(req.params.artistId);
    if (!Number.isFinite(artistId) || artistId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid artistId" });
    }

    try {
      const userId = req.user?.id ? Number(req.user.id) : null;
      const isDev = process.env.NODE_ENV !== "production";
      await ensureFanArtistProfileSchema();
      await ensureContentSchema();
      
      const rows = await pool.query(
        `SELECT c.id, c.title, c.type, c.thumbnail_url, c.media_url, c.audio_url, c.video_url, c.storage_key, c.video_storage_key, c.created_at, c.subscription_required
         FROM content_items c
         LEFT JOIN users u ON u.id = c.artist_id
         WHERE c.artist_id = $1
           AND COALESCE(u.is_deleted, false) = false
           AND ${isDev ? "true" : "COALESCE(c.is_approved, false) = true"}
           AND UPPER(COALESCE(c.lifecycle_state, '')) IN ('PUBLISHED', 'READY'${isDev ? ", 'PENDING', 'PROCESSING'" : ""})
         ORDER BY c.created_at DESC
         LIMIT 500`,
        [artistId]
      );

      const mediaCfg = getMediaConfig();
      const streamRoute = (mediaCfg.localPrivateStreamRoute || "media/stream").replace(/^\//, "");
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const playbackUserId = userId ?? 0;
      const issueStreamUrl = (contentId: number, kind: "audio" | "video") => {
        const token = createPlaybackToken(contentId, playbackUserId, mediaCfg.mediaUrlTtlSeconds);
        return `${baseUrl}/${streamRoute}/${contentId}?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(
          kind
        )}`;
      };

      const content = await Promise.all((rows.rows ?? []).map(async (r: any) => {
        const { isLocked } = await checkContentAccess(userId, r.id);
        const type = (r.type ?? '').toString().toLowerCase();
        const hasAudio = Boolean(r.storage_key || r.audio_url || r.media_url);
        const hasVideo = Boolean(r.video_storage_key || r.video_url);

        const isAudioVideo = type === 'audio_video' || type === 'audiovideo' || type === 'audio+video';
        const mediaType = isAudioVideo ? 'audio_video' : (type.includes('video') || hasVideo ? 'video' : 'audio');
        const hasAudioStorage = Boolean(r.storage_key);
        const hasVideoStorage = Boolean(r.video_storage_key || (type === "video" && r.storage_key));

        const streamAudioUrl = hasAudioStorage && !isLocked ? issueStreamUrl(r.id, "audio") : null;
        const streamVideoUrl = hasVideoStorage && !isLocked ? issueStreamUrl(r.id, "video") : null;

        const unlockedAudioUrl = streamAudioUrl || (!hasAudioStorage ? toAbsoluteUrl(req, r.audio_url ?? r.media_url) : null);
        const unlockedVideoUrl = streamVideoUrl || (!hasVideoStorage ? toAbsoluteUrl(req, r.video_url ?? r.media_url) : null);

        const finalAudioUrl = hasAudio ? (isLocked ? restrictedMediaUrl(req, "audio") : unlockedAudioUrl) : null;
        const finalVideoUrl = hasVideo ? (isLocked ? restrictedMediaUrl(req, "video") : unlockedVideoUrl) : null;
        const finalMediaUrl = mediaType === "video" ? finalVideoUrl : finalAudioUrl;
        const useStreamAccess = Boolean((hasAudioStorage || hasVideoStorage) && !isLocked);
        
        return {
          id: r.id,
          title: r.title,
          type,
          mediaType,
          artwork: toAbsoluteUrl(req, r.thumbnail_url),
          thumbnailUrl: toAbsoluteUrl(req, r.thumbnail_url),
          mediaUrl: finalMediaUrl,
          fileUrl: finalMediaUrl,
          audioUrl: finalAudioUrl,
          videoUrl: finalVideoUrl,
          useStreamAccess,
          subscriptionRequired: Boolean(r.subscription_required),
          isLocked,
          createdAt: r.created_at,
        };
      }));

      return res.json({ success: true, content });
    } catch (err: any) {
      console.error("[/artists/:artistId/content] error:", err?.message, err?.stack);
      return res.status(500).json({ success: false, message: "Failed to fetch artist content" });
    }
  })();
});

export default router;
