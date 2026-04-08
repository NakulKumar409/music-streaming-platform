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
    const limit = Number(req.query.limit) || 10;
    const offset = Number(req.query.offset) || 0;
    const cacheKey = `featured_artists:${limit}:${offset}`;
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
         LIMIT $1 OFFSET $2`,
         [limit, offset]
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
    const limit = Number(req.query.limit) || 10;
    const offset = Number(req.query.offset) || 0;
    // Cursor mode: sort by name DESC, use last returned name as cursor
    const cursorRaw = req.query.cursor ? String(req.query.cursor) : null;
    const useCursor = Boolean(cursorRaw);

    // Validation: require at least 2 characters
    if (query.length < 2) {
      return res.json({ success: true, artists: [], nextCursor: null });
    }

    // Case-insensitive search with partial match
    const searchPattern = `%${query}%`;
    const cacheKey = useCursor
      ? `artist_search:${query.toLowerCase()}:cursor:${cursorRaw}:${limit}`
      : `artist_search:${query.toLowerCase()}:${limit}:${offset}`;

    const responseData = await fetchWithCache(cacheKey, async () => {
      let result: any;
      if (useCursor) {
        result = await pool.query(
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
             AND LOWER(name) > LOWER($2)
           ORDER BY name ASC
           LIMIT $3`,
          [searchPattern, cursorRaw, limit]
        );
      } else {
        result = await pool.query(
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
           LIMIT $2 OFFSET $3`,
          [searchPattern, limit, offset]
        );
      }

      const artists = (result.rows || []).map((row: any) => ({
        id: row.id,
        name: row.name ?? null,
        isVerified: Boolean(row.is_verified),
        profileImageUrl: toAbsoluteUrl(req, row.profile_image_url),
        status: (row.status ?? 'ACTIVE').toString(),
        subscriptionPrice: Number(row.subscription_price ?? 0),
        genre: (row.genre ?? '').toString(),
      }));

      const lastArtist = artists[artists.length - 1];
      const nextCursor = lastArtist?.name ?? null;

      return { success: true, artists, nextCursor };
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
      const limit = Number(req.query.limit) || 10;
      const offset = Number(req.query.offset) || 0;

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
         LIMIT $1 OFFSET $2`,
        [limit, offset]
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
      const limit = Number(req.query.limit) || 10;
      const offset = Number(req.query.offset) || 0;

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
         LIMIT $1 OFFSET $2`,
        [limit, offset]
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
          COALESCE(subscription_features, '[]'::jsonb) as subscription_features,
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
          subscriptionFeatures: Array.isArray(row.subscription_features) ? row.subscription_features : [],
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
          COALESCE(subscription_features, '[]'::jsonb) as subscription_features,
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
          subscriptionFeatures: Array.isArray(row.subscription_features) ? row.subscription_features : [],
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

    const limit = Number(req.query.limit) || 10;
    const offset = Number(req.query.offset) || 0;
    // Cursor mode: ?cursor=<ISO timestamp>
    const cursorRaw = req.query.cursor ? String(req.query.cursor) : null;
    const cursor = cursorRaw ? new Date(cursorRaw) : null;
    const useCursor = cursor instanceof Date && !isNaN(cursor.getTime());

    const userId = (req as any).user?.id ? Number((req as any).user.id) : null;
    try {
      const isDev = process.env.NODE_ENV !== "production";
      
      const querySql = `
        SELECT c.id, c.title, c.type, c.thumbnail_url, c.media_url, c.audio_url, c.video_url, c.storage_key, c.video_storage_key, c.created_at, c.subscription_required,
               (SELECT COUNT(*)::int FROM content_plays WHERE content_id = c.id) as view_count,
               (SELECT COUNT(*)::int FROM content_reactions WHERE content_id = c.id AND reaction = 'like') as like_count,
               (SELECT COUNT(*)::int FROM content_reactions WHERE content_id = c.id AND reaction = 'dislike') as dislike_count,
               (CASE 
                  WHEN $userId::int IS NULL THEN false
                  ELSE EXISTS (
                    SELECT 1 FROM subscriptions s 
                    WHERE s.user_id = $userId 
                      AND s.artist_id = c.artist_id 
                      AND UPPER(COALESCE(s.status, '')) = 'ACTIVE'
                      AND (s.next_billing_date IS NULL OR s.next_billing_date > now() - interval '2 days')
                  )
                END) as has_subscription
        FROM content_items c
        LEFT JOIN users u ON u.id = c.artist_id
        WHERE c.artist_id = $artistId
          AND COALESCE(u.is_deleted, false) = false
          AND ${isDev ? "true" : "COALESCE(c.is_approved, false) = true"}
          AND UPPER(COALESCE(c.lifecycle_state, '')) IN ('PUBLISHED', 'READY'${isDev ? ", 'PENDING', 'PROCESSING'" : ""})
          ${useCursor ? "AND c.created_at < $cursor" : ""}
        ORDER BY c.created_at DESC
        LIMIT $limit ${useCursor ? "" : "OFFSET $offset"}`.replace(/\$userId/g, "$1").replace(/\$artistId/g, "$2").replace(/\$cursor/g, "$3").replace(/\$limit/g, "$4").replace(/\$offset/g, "$5");

      const params = useCursor ? [userId, artistIdNum, cursor, limit] : [userId, artistIdNum, limit, offset];
      const rows = await pool.query(querySql, params);

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
      const content = (rows.rows ?? []).map((r: any) => {
        const subscriptionRequired = Boolean(r.subscription_required);
        const isLocked = subscriptionRequired && !r.has_subscription;
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
          subscriptionRequired,
          isLocked,
          createdAt: r.created_at,
          viewCount: r.view_count,
          likeCount: r.like_count,
          dislikeCount: r.dislike_count
        };
      });
      const lastItem = content[content.length - 1] as any;
      const nextCursor = lastItem?.createdAt
        ? new Date(lastItem.createdAt).toISOString()
        : null;
      console.log(`[DEBUG] GET /artists/${artistIdNum}/content - MAPPING SUCCESS`);
      return res.json({ success: true, content, nextCursor });
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
         LIMIT $2 OFFSET $3`,
        [artistIdNum, limit, offset]
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
