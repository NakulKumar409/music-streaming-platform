import { Router } from "express";
import { pool } from "../../common/db";
import { fetchWithCache } from "../../common/cache";
import { checkContentAccess } from "../../common/accessControl";
import { optionalAuth } from "../../common/auth/requireAuth";
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

router.get("/", optionalAuth, (req, res) => {
  // Allow short-lived caching (30s) and conditional GET (304) so repeat
  // loads are near-instant for clients that already have the response.
  res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

  (async () => {
    try {
      const userId = req.user?.id ? Number(req.user.id) : null;
      const isDev = process.env.NODE_ENV !== 'production';
      
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      // Cursor-based pagination: ?cursor=<ISO timestamp> overrides offset
      const cursorRaw = req.query.cursor ? String(req.query.cursor) : null;
      const cursor = cursorRaw ? new Date(cursorRaw) : null;
      const useCursor = cursor instanceof Date && !isNaN(cursor.getTime());

      const cacheKey = useCursor
        ? `home_content_feed_rows_${isDev ? 'dev' : 'prod'}:cursor:${cursorRaw}:${limit}`
        : `home_content_feed_rows_${isDev ? 'dev' : 'prod'}:${limit}:${offset}`;

      let queryRows: any = await fetchWithCache(cacheKey, async () => {
        let rows: any;
        const baseWhere = `${isDev ? "true" : "COALESCE(c.is_approved, false) = true"}
             AND COALESCE(u.is_deleted, false) = false
             AND UPPER(COALESCE(c.status, 'APPROVED')) IN ('APPROVED', 'PUBLISHED'${isDev ? ", 'PROCESSING', 'READY'" : ", 'READY'"})
             AND UPPER(COALESCE(c.lifecycle_state, '')) IN ('PUBLISHED', 'READY'${isDev ? ", 'PENDING', 'PROCESSING'" : ""})`;

        const querySql = `
          SELECT
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
             c.storage_provider,
             c.created_at,
             c.artist_id,
             c.subscription_required,
             COALESCE(NULLIF(u.name, ''), NULLIF(split_part(u.email, '@', 1), ''), u.email) as artist_name,
             u.profile_image_url as artist_profile_image_url,
             (SELECT COUNT(*)::int FROM content_plays WHERE content_id = c.id) as view_count,
             (SELECT COUNT(*)::int FROM content_reactions WHERE content_id = c.id AND reaction = 'like') as like_count,
             (SELECT COUNT(*)::int FROM content_reactions WHERE content_id = c.id AND reaction = 'dislike') as dislike_count
           FROM content_items c
           LEFT JOIN users u ON u.id = c.artist_id
           WHERE ${baseWhere}
             ${useCursor ? "AND c.created_at < $1" : ""}
           ORDER BY c.created_at DESC
           LIMIT ${useCursor ? "$2" : "$1"} ${useCursor ? "" : "OFFSET $2"}`;

        const params = useCursor ? [cursor, limit] : [limit, offset];
        rows = await pool.query(querySql, params);
        return rows.rows;
      }, 120);

      // Post-cache enrichment for user-specific data (reactions, subscription status)
      if (userId && queryRows && queryRows.length > 0) {
        const contentIds = queryRows.map((r: any) => r.id);
        const artistIds = Array.from(new Set(queryRows.map((r: any) => r.artist_id))).filter(id => id !== null);

        const [reactions, subscriptions] = await Promise.all([
          pool.query(
            `SELECT content_id, reaction FROM content_reactions WHERE user_id = $1 AND content_id = ANY($2::int[])`,
            [userId, contentIds]
          ),
          pool.query(
            `SELECT artist_id, type FROM subscriptions 
             WHERE user_id = $1 
               AND (type = 'PLATFORM' OR (type = 'ARTIST' AND artist_id = ANY($2::int[])))
               AND UPPER(COALESCE(status, '')) IN ('ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'GRACE')
               AND (next_billing_date IS NULL OR next_billing_date > now())`,
            [userId, artistIds]
          )
        ]);

        const reactionMap = new Map(reactions.rows.map((rr: any) => [rr.content_id, rr.reaction]));
        const hasPlatformSub = subscriptions.rows.some((ss: any) => ss.type === 'PLATFORM');
        const artistSubSet = new Set(subscriptions.rows.filter((ss: any) => ss.type === 'ARTIST').map((ss: any) => ss.artist_id));

        queryRows = queryRows.map((r: any) => ({
          ...r,
          user_reaction: reactionMap.get(r.id) || null,
          has_subscription: hasPlatformSub || artistSubSet.has(r.artist_id)
        }));
      } else {
        queryRows = (queryRows ?? []).map((r: any) => ({
          ...r,
          user_reaction: null,
          has_subscription: false
        }));
      }

      const mediaCfg = getMediaConfig();
      const streamRoute = (mediaCfg.localPrivateStreamRoute || "media/stream").replace(/^\//, "");
      const baseUrlFull = `${req.protocol}://${req.get("host")}`;
      const issueStreamUrl = (contentId: number, kind: "audio" | "video") => {
        const token = createPlaybackToken(contentId, userId ?? 0, mediaCfg.mediaUrlTtlSeconds);
        return `${baseUrlFull}/${streamRoute}/${contentId}?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(
          kind
        )}`;
      };

      const items = (queryRows ?? []).map((r: any) => {
        const subscriptionRequired = Boolean(r.subscription_required);
        const isLocked = subscriptionRequired && !r.has_subscription;
        
        const typeRaw = (r.type ?? '').toString().toLowerCase();
        const hasAudio = Boolean(r.storage_key || r.audio_url || r.media_url);
        const hasVideo = Boolean(r.video_storage_key || r.video_url);

        const isAudioVideo = typeRaw === 'audio_video' || typeRaw === 'audiovideo' || typeRaw === 'audio+video';
        const mediaType = (isAudioVideo ? 'audio_video' : (typeRaw.includes('video') || hasVideo ? 'video' : 'audio')) as 'audio' | 'video' | 'audio_video';

        const hasNewAudioStorage = Boolean(r.storage_key);
        const hasNewVideoStorage = Boolean(r.video_storage_key || (typeRaw === "video" && r.storage_key));

        const legacyAudioUrlRaw = r.audio_url ?? r.media_url;
        const legacyVideoUrlRaw = r.video_url ?? r.media_url;

        const streamAudioUrl = hasNewAudioStorage && !isLocked ? issueStreamUrl(r.id, "audio") : null;
        const streamVideoUrl = hasNewVideoStorage && !isLocked ? issueStreamUrl(r.id, "video") : null;

        const unlockedAudioUrl = streamAudioUrl || (!hasNewAudioStorage ? toAbsoluteUrl(req, legacyAudioUrlRaw) : null);
        const unlockedVideoUrl = streamVideoUrl || (!hasNewVideoStorage ? toAbsoluteUrl(req, legacyVideoUrlRaw) : null);

        const finalAudioUrl = hasAudio ? (isLocked ? restrictedMediaUrl(req, "audio") : unlockedAudioUrl) : null;
        const finalVideoUrl = hasVideo ? (isLocked ? restrictedMediaUrl(req, "video") : unlockedVideoUrl) : null;

        const finalMediaUrl = mediaType === "video" ? finalVideoUrl : finalAudioUrl;
        const useStreamAccess = Boolean((hasNewAudioStorage || hasNewVideoStorage) && !isLocked);

        const isAuthenticatedCloudinaryUrl = (url: string | null) =>
          !!(url && (url.includes('/authenticated/') || url.includes('res.cloudinary.com')));

        // For Cloudinary content, thumbnail_url holds an authenticated CDN URL which
        // cannot be rendered by the mobile app. Route those through /stream/thumbnail/
        // which generates a proper publicly-accessible Cloudinary URL.
        const thumbnailUrl = r.thumbnail_storage_key
          ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
          : (r.thumbnail_url && !isAuthenticatedCloudinaryUrl(r.thumbnail_url))
            ? toAbsoluteUrl(req, r.thumbnail_url)
            : r.thumbnail_url
              ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
              : null;

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
          videoUrl: finalVideoUrl,
          storageKey: r.storage_key ?? null,
          storage_provider: r.storage_provider ?? 'local',
          useStreamAccess,
          createdAt: r.created_at,
          artistName: r.artist_name ?? null,
          artistId: r.artist_id,
          artistProfileImage: r.artist_profile_image_url ? toAbsoluteUrl(req, r.artist_profile_image_url) : null,
          subscriptionRequired,
          isLocked,
          viewCount: r.view_count,
          likeCount: r.like_count,
          dislikeCount: r.dislike_count,
          userReaction: r.user_reaction ?? null
        };
      });

      const meta = items.reduce(
        (acc: any, it: any) => {
          acc.total += 1;
          const mt = it?.mediaType;
          if (mt === 'video' || mt === 'audio_video') acc.video += 1;
          if (mt === 'audio' || mt === 'audio_video') acc.audio += 1;
          return acc;
        },
        { total: 0, audio: 0, video: 0 }
      );

      const lastItem = items[items.length - 1];
      const nextCursor = lastItem?.createdAt
        ? new Date(lastItem.createdAt).toISOString()
        : null;

      console.log('[fan/content] audio items found', {
        total: meta.total,
        audio: meta.audio,
        video: meta.video
      });

      return res.json({ success: true, items, meta, nextCursor });
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
      const userId = req.user?.id ? Number(req.user.id) : null;
      const isDev = process.env.NODE_ENV !== 'production';
      
      const querySql = `
        SELECT c.id,
                c.title,
                c.type,
                c.thumbnail_url,
                c.media_url,
                c.audio_url,
                c.video_url,
                c.storage_key,
                c.video_storage_key,
                c.thumbnail_storage_key,
                c.storage_provider,
                c.created_at,
                c.subscription_required,
                (SELECT COUNT(*)::int FROM content_plays WHERE content_id = c.id) as view_count,
                (SELECT COUNT(*)::int FROM content_reactions WHERE content_id = c.id AND reaction = 'like') as like_count,
                (SELECT COUNT(*)::int FROM content_reactions WHERE content_id = c.id AND reaction = 'dislike') as dislike_count,
                (CASE WHEN $2::int IS NULL THEN NULL ELSE (SELECT reaction FROM content_reactions WHERE content_id = c.id AND user_id = $2 LIMIT 1) END) as user_reaction,
                                (CASE 
                  WHEN $2::int IS NULL THEN false
                  ELSE EXISTS (
                    SELECT 1 FROM subscriptions s 
                    WHERE s.user_id = $2 
                      AND (
                        (s.type = 'ARTIST' AND s.artist_id = c.artist_id)
                        OR (s.type = 'PLATFORM')
                      )
                      AND UPPER(COALESCE(s.status, '')) IN ('ACTIVE', 'GRACE_PERIOD')
                      AND (COALESCE(s.grace_ends_at, s.next_billing_date) IS NULL OR COALESCE(s.grace_ends_at, s.next_billing_date) > now())
                  )
                END) as has_subscription
         FROM content_items c
         LEFT JOIN users u ON u.id = c.artist_id
         WHERE c.artist_id = $1
           AND COALESCE(u.is_deleted, false) = false
           AND ${isDev ? "true" : "COALESCE(c.is_approved, false) = true"}
           AND ${
             isDev
               ? "UPPER(COALESCE(c.status, 'APPROVED')) IN ('APPROVED', 'PENDING', 'PROCESSING', 'READY', 'PUBLISHED')"
               : "UPPER(COALESCE(c.status, 'APPROVED')) IN ('APPROVED', 'READY', 'PUBLISHED')"
           }
           AND UPPER(COALESCE(c.lifecycle_state, '')) IN ('PUBLISHED', 'READY'${isDev ? ", 'PENDING', 'PROCESSING'" : ""})
         ORDER BY c.created_at DESC
         LIMIT 500`;

      const rows = await pool.query(querySql, [artistId, userId]);

      const mediaCfg = getMediaConfig();
      const streamRoute = (mediaCfg.localPrivateStreamRoute || "media/stream").replace(/^\//, "");
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const issueStreamUrl = (contentId: number, kind: "audio" | "video") => {
        const token = createPlaybackToken(contentId, userId ?? 0, mediaCfg.mediaUrlTtlSeconds);
        return `${baseUrl}/${streamRoute}/${contentId}?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(
          kind
        )}`;
      };

      const items = (rows.rows ?? []).map((r: any) => {
        const subscriptionRequired = Boolean(r.subscription_required);
        const isLocked = subscriptionRequired && !r.has_subscription;
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

        const isAuthenticatedCloudinaryUrl2 = (url: string | null) =>
          !!(url && (url.includes('/authenticated/') || url.includes('res.cloudinary.com')));

        const thumbnailUrl = r.thumbnail_storage_key
          ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
          : (r.thumbnail_url && !isAuthenticatedCloudinaryUrl2(r.thumbnail_url))
            ? toAbsoluteUrl(req, r.thumbnail_url)
            : r.thumbnail_url
              ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
              : null;

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
          storage_provider: r.storage_provider ?? 'local',
          useStreamAccess,
          subscriptionRequired,
          isLocked,
          createdAt: r.created_at,
          viewCount: r.view_count,
          likeCount: r.like_count,
          dislikeCount: r.dislike_count,
          userReaction: r.user_reaction ?? null
        };
      });

      if (process.env.NODE_ENV !== 'production') {
        const meta = items.reduce(
          (acc: any, it: any) => {
            acc.total += 1;
            const mt = it?.mediaType;
            if (mt === 'video' || mt === 'audio_video') acc.video += 1;
            if (mt === 'audio' || mt === 'audio_video') acc.audio += 1;
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
             c.storage_provider,
             c.subscription_required,
             c.artist_id,
             COALESCE(NULLIF(u.name, ''), NULLIF(split_part(u.email, '@', 1), ''), u.email) as artist_name,
             (CASE WHEN $2::int IS NULL THEN NULL ELSE (SELECT reaction FROM content_reactions WHERE content_id = c.id AND user_id = $2 LIMIT 1) END) as user_reaction
           FROM content_items c
           LEFT JOIN users u ON u.id = c.artist_id
           WHERE c.id = $1
             AND COALESCE(c.is_approved, false) = true
             AND UPPER(COALESCE(c.lifecycle_state, '')) = 'PUBLISHED'
           LIMIT 1`,
          [id, userId]
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
               c.storage_provider,
               c.subscription_required,
               c.artist_id,
               COALESCE(NULLIF(u.name, ''), NULLIF(split_part(u.email, '@', 1), ''), u.email) as artist_name,
               (CASE WHEN $2::int IS NULL THEN NULL ELSE (SELECT reaction FROM content_reactions WHERE content_id = c.id AND user_id = $2 LIMIT 1) END) as user_reaction
             FROM content_items c
             LEFT JOIN users u ON u.id = c.artist_id
             WHERE c.id = $1
               AND COALESCE(c.is_approved, false) = true
               AND UPPER(COALESCE(c.lifecycle_state, '')) = 'PUBLISHED'
             LIMIT 1`,
            [id, userId]
          );
        } else {
          throw err;
        }
      }

      if (!rows.rows?.length) {
        return res.status(404).json({ success: false, message: "Content not found" });
      }

      const mediaCfg = getMediaConfig();
      const streamRoute = (mediaCfg.localPrivateStreamRoute || "media/stream").replace(/^\//, "");
      const baseUrlFull = `${req.protocol}://${req.get("host")}`;
      const issueStreamUrl = (contentId: number, kind: "audio" | "video") => {
        const token = createPlaybackToken(contentId, userId ?? 0, mediaCfg.mediaUrlTtlSeconds);
        return `${baseUrlFull}/${streamRoute}/${contentId}?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(
          kind
        )}`;
      };

      const r: any = rows.rows[0];
      const { isLocked } = await checkContentAccess(userId, r.id);
      const typeRaw = (r.type ?? '').toString().toLowerCase();
      
      const hasAudio = Boolean(r.storage_key || r.audio_url || r.media_url);
      const hasVideo = Boolean(r.video_storage_key || r.video_url);

      const isAudioVideo = typeRaw === 'audio_video' || typeRaw === 'audiovideo' || typeRaw === 'audio+video';
      const mediaType = (isAudioVideo ? 'audio_video' : (typeRaw.includes('video') || hasVideo ? 'video' : 'audio')) as 'audio' | 'video' | 'audio_video';

      const hasNewAudioStorage = Boolean(r.storage_key);
      const hasNewVideoStorage = Boolean(r.video_storage_key || (typeRaw === "video" && r.storage_key));

      const legacyAudioUrlRaw = r.audio_url ?? r.media_url;
      const legacyVideoUrlRaw = r.video_url ?? r.media_url;

      const streamAudioUrl = hasNewAudioStorage && !isLocked ? issueStreamUrl(r.id, "audio") : null;
      const streamVideoUrl = hasNewVideoStorage && !isLocked ? issueStreamUrl(r.id, "video") : null;

      const unlockedAudioUrl = streamAudioUrl || (!hasNewAudioStorage ? toAbsoluteUrl(req, legacyAudioUrlRaw) : null);
      const unlockedVideoUrl = streamVideoUrl || (!hasNewVideoStorage ? toAbsoluteUrl(req, legacyVideoUrlRaw) : null);

      const finalAudioUrl = hasAudio ? (isLocked ? restrictedMediaUrl(req, "audio") : unlockedAudioUrl) : null;
      const finalVideoUrl = hasVideo ? (isLocked ? restrictedMediaUrl(req, "video") : unlockedVideoUrl) : null;

      const finalMediaUrl = mediaType === "video" ? finalVideoUrl : finalAudioUrl;
      const useStreamAccess = Boolean((hasNewAudioStorage || hasNewVideoStorage) && !isLocked);

      const isAuthenticatedCloudinaryUrl3 = (url: string | null) =>
        !!(url && (url.includes('/authenticated/') || url.includes('res.cloudinary.com')));

      const thumbnailUrl = r.thumbnail_storage_key
        ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
        : (r.thumbnail_url && !isAuthenticatedCloudinaryUrl3(r.thumbnail_url))
          ? toAbsoluteUrl(req, r.thumbnail_url)
          : r.thumbnail_url
            ? toAbsoluteUrl(req, `/api/v1/fan/stream/thumbnail/${r.id}`)
            : null;
      
      return res.json({
        success: true,
        content: {
          id: r.id,
          title: r.title,
          type: r.type,
          mediaType,
          isLocked,
          subscriptionRequired: Boolean(r.subscription_required),
          artistId: r.artist_id,
          artistName: r.artist_name ?? null,
          artwork: thumbnailUrl,
          thumbnailUrl,
          mediaUrl: finalMediaUrl,
          fileUrl: finalMediaUrl,
          audioUrl: finalAudioUrl,
          videoUrl: finalVideoUrl,
          storage_provider: r.storage_provider ?? 'local',
          useStreamAccess,
          userReaction: r.user_reaction ?? null,
        }
      });
    } catch (err: any) {
      console.error("[fan/content] GET /:id error", { id }, err);
      return res.status(500).json({ success: false, message: "Failed to fetch content" });
    }
  })();
});

export default router;
