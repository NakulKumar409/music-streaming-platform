import { Router } from "express";
import { pool } from "../../common/db";
import { checkContentAccess } from "../../common/accessControl";

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

router.get("/", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.removeHeader('ETag');

  (async () => {
    try {
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
      const rows = await pool.query(
        `SELECT id,
          name,
          COALESCE(is_verified, verified, false) as is_verified,
          profile_image_url,
          COALESCE(status, 'ACTIVE') as status,
          COALESCE(subscription_price, 0) as subscription_price,
          COALESCE(genre, '') as genre
         FROM users
         WHERE id = $1
           AND UPPER(role) = 'ARTIST'
         LIMIT 1`,
        [artistId]
      );

      if (!rows.rows?.length) {
        return res.status(404).json({ success: false, message: "Artist not found" });
      }

      const row: any = rows.rows[0];
      return res.json({
        success: true,
        artist: {
          id: row.id,
          name: row.name ?? null,
          isVerified: Boolean(row.is_verified),
          profileImageUrl: toAbsoluteUrl(req, row.profile_image_url),
          coverImageUrl: toAbsoluteUrl(req, row.profile_image_url),
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
      
      const rows = await pool.query(
        `SELECT id, title, type, thumbnail_url, media_url, created_at, subscription_required
         FROM content_items
         WHERE artist_id = $1
           AND COALESCE(is_approved, false) = true
           AND UPPER(COALESCE(lifecycle_state, '')) = 'PUBLISHED'
         ORDER BY created_at DESC
         LIMIT 500`,
        [artistId]
      );

      const content = await Promise.all((rows.rows ?? []).map(async (r: any) => {
        const { isLocked } = await checkContentAccess(userId, r.id);
        const type = (r.type ?? '').toString().toLowerCase();
        const mediaType = type === 'video' ? 'video' : 'audio';
        const unlockedMediaUrl = toAbsoluteUrl(req, r.media_url);
        const finalMediaUrl = isLocked ? restrictedMediaUrl(req, mediaType) : unlockedMediaUrl;
        
        return {
          id: r.id,
          title: r.title,
          type,
          artwork: toAbsoluteUrl(req, r.thumbnail_url),
          thumbnailUrl: toAbsoluteUrl(req, r.thumbnail_url),
          mediaUrl: finalMediaUrl,
          subscriptionRequired: Boolean(r.subscription_required),
          isLocked,
          createdAt: r.created_at,
        };
      }));

      return res.json({ success: true, content });
    } catch {
      return res.status(500).json({ success: false, message: "Failed to fetch artist content" });
    }
  })();
});

export default router;
