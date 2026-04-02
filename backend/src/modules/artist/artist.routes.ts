import { Router } from "express";
import { pool } from "../../common/db";
import { fetchWithCache } from "../../common/cache";
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

/**
 * GET /api/v1/fan/artists/featured
 * Get admin-selected featured artists for fan app
 * Supports both existing artists (with artist_id) and manual featured artists (artist_id IS NULL)
 */
router.get("/featured", async (req, res) => {
  try {
    const cacheKey = "featured_artists";
    const responseData = await fetchWithCache(cacheKey, async () => {
      const result = await pool.query(
        `SELECT fa.id, fa.artist_id, 
          COALESCE(u.name, fa.name) as name,
          COALESCE(u.profile_image_url, fa.avatar) as avatar_url
         FROM featured_artists fa
         LEFT JOIN users u ON u.id = fa.artist_id
         WHERE fa.is_active = true
           AND (fa.artist_id IS NULL OR (u.is_deleted = false OR u.is_deleted IS NULL))
           AND (fa.artist_id IS NULL OR COALESCE(u.status, 'ACTIVE') = 'ACTIVE')
         ORDER BY fa.created_at DESC
         LIMIT 10`
      );

      const artists = (result.rows || []).map((row: any) => ({
        id: row.artist_id || row.id,
        name: row.name,
        avatar: toAbsoluteUrl(req, row.avatar_url),
      }));

      return { success: true, artists };
    }, 300);

    return res.json(responseData);
  } catch (err: any) {
    // Gracefully handle missing table - return empty array
    if (err.message?.includes('relation "featured_artists" does not exist')) {
      console.log('[Featured Artists] Table not created yet, returning empty array');
      return res.json({ success: true, artists: [] });
    }
    console.error("[Fan Featured Artists Error]", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch featured artists" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    // Validation: require at least 2 characters
    if (query.length < 2) {
      return res.json({ success: true, artists: [] });
    }

    // Case-insensitive search with partial match
    const searchPattern = `%${query}%`;
    const cacheKey = `artist_search:${query.toLowerCase()}`;

    const responseData = await fetchWithCache(cacheKey, async () => {
      const result = await pool.query(
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
           AND COALESCE(status, 'ACTIVE') = 'ACTIVE'
           AND LOWER(name) LIKE LOWER($1)
         ORDER BY name ASC
         LIMIT 10`,
        [searchPattern]
      );

      const artists = (result.rows || []).map((row: any) => ({
        id: row.id,
        name: row.name ?? null,
        isVerified: Boolean(row.is_verified),
        profileImageUrl: toAbsoluteUrl(req, row.profile_image_url),
        status: (row.status ?? 'ACTIVE').toString(),
        subscriptionPrice: Number(row.subscription_price ?? 0),
        genre: (row.genre ?? '').toString(),
      }));

      return { success: true, artists };
    }, 120);

    return res.json(responseData);
  } catch (err: any) {
    console.error("[Artist Search Error]", err.message);
    return res.status(500).json({ success: false, message: "Search failed" });
  }
});

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
