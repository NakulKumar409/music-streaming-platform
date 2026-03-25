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
    } catch (err: any) {
      // Fallback if status or is_verified columns are missing
      const r = await pool.query(
        `SELECT id,
          name,
          profile_image_url,
          COALESCE(subscription_price, 0) as subscription_price,
          COALESCE(genre, '') as genre
         FROM users
         WHERE UPPER(role) = 'ARTIST'
           AND COALESCE(is_deleted, false) = false
         ORDER BY id DESC
         LIMIT 100`
      );

      const artists = (r.rows ?? []).map((row: any) => ({
        id: row.id,
        name: row.name ?? null,
        isVerified: true, // Default to true for fallback
        profileImageUrl: toAbsoluteUrl(req, row.profile_image_url),
        status: 'ACTIVE',
        subscriptionPrice: Number(row.subscription_price ?? 0),
        genre: (row.genre ?? '').toString(),
      }));

      return res.json({ success: true, artists });
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
    } catch (err: any) {
      // Fallback if status or is_verified columns are missing
      const rows = await pool.query(
        `SELECT id,
          name,
          profile_image_url,
          bio,
          artist_bio,
          social_links,
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
      const bio = (row.bio || row.artist_bio || '').toString().trim();

      return res.json({
        success: true,
        artist: {
          id: row.id,
          name: row.name ?? null,
          isVerified: true,
          profileImageUrl: toAbsoluteUrl(req, row.profile_image_url),
          coverImageUrl: toAbsoluteUrl(req, row.profile_image_url),
          bio,
          socialLinks: socialLinks ?? null,
          spotifyUrl,
          youtubeUrl,
          instagramUrl,
          status: 'ACTIVE',
          subscriptionPrice: Number(row.subscription_price ?? 0),
          genre: (row.genre ?? '').toString(),
        },
      });
    }
  })();
});

router.get("/:artistId/content", (req, res) => {
  const artistId = req.params.artistId;
  console.log(`[DEBUG] GET /artists/${artistId}/content - START`);
  (async () => {
    const artistIdNum = Number(artistId);
    if (!Number.isFinite(artistIdNum) || artistIdNum <= 0) {
      console.log(`[DEBUG] GET /artists/${artistId}/content - INVALID ID`);
      return res.status(400).json({ success: false, message: "Invalid artistId" });
    }

    const userId = (req as any).user?.id ? Number((req as any).user.id) : null;
    try {
      const isDev = process.env.NODE_ENV !== "production";
      
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

      console.log(`[DEBUG] GET /artists/${artistIdNum}/content - QUERY SUCCESS, mapping ${rows.rows?.length} rows`);
      try {
        const content = await Promise.all((rows.rows ?? []).map(async (r: any) => {
          try {
            const { isLocked } = await checkContentAccess(userId, r.id);
            const type = (r.type ?? '').toString().toLowerCase();
            const artwork = toAbsoluteUrl(req, r.thumbnail_url);
            
            return {
              id: r.id,
              title: r.title ?? 'Untitled',
              type,
              mediaType: type.includes('video') ? 'video' : 'audio',
              artwork,
              thumbnailUrl: artwork,
              mediaUrl: null, // Stream on demand
              useStreamAccess: !isLocked,
              subscriptionRequired: Boolean(r.subscription_required),
              isLocked,
              createdAt: r.created_at,
            };
          } catch (mErr) {
            console.error(`[DEBUG] Mapping error for artist content row ${r?.id}:`, mErr);
            return null;
          }
        }));
        console.log(`[DEBUG] GET /artists/${artistIdNum}/content - MAPPING SUCCESS`);
        return res.json({ success: true, content: content.filter(Boolean) });
      } catch (mapErr) {
        console.error(`[DEBUG] Critical mapping error:`, mapErr);
        throw mapErr;
      }
    } catch (err: any) {
      console.log(`[DEBUG] GET /artists/${artistIdNum}/content - PRIMARY FAILED, trying fallback`, err.message);
      // Fallback if is_approved or lifecycle_state are missing
      const rows = await pool.query(
        `SELECT c.id, c.title, c.type, c.thumbnail_url, c.media_url, c.audio_url, c.video_url, c.storage_key, c.video_storage_key, c.created_at, c.subscription_required
         FROM content_items c
         LEFT JOIN users u ON u.id = c.artist_id
         WHERE c.artist_id = $1
           AND COALESCE(u.is_deleted, false) = false
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

      try {
        const content = await Promise.all((rows.rows ?? []).map(async (r: any) => {
          try {
            const { isLocked } = await checkContentAccess(userId, r.id);
            const type = (r.type ?? '').toString().toLowerCase();
            const artwork = toAbsoluteUrl(req, r.thumbnail_url);
            
            return {
              id: r.id,
              title: r.title ?? 'Untitled',
              type,
              mediaType: type.includes('video') ? 'video' : 'audio',
              artwork,
              thumbnailUrl: artwork,
              mediaUrl: null, // Stream on demand
              useStreamAccess: !isLocked,
              subscriptionRequired: Boolean(r.subscription_required),
              isLocked,
              createdAt: r.created_at,
            };
          } catch (mErr) {
            console.error(`[DEBUG] Fallback mapping error for row ${r?.id}:`, mErr);
            return null;
          }
        }));
        return res.json({ success: true, content: content.filter(Boolean) });
      } catch (fMapErr) {
        console.error(`[DEBUG] Critical fallback mapping error:`, fMapErr);
        return res.status(500).json({ success: false, message: "Failed to process content fallback" });
      }
    }
  })();
});

export default router;
