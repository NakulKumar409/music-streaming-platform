import { Router } from "express";
import { requireAuth } from "../common/auth/requireAuth";
import { pool } from "../common/db";
import { uploadLimiter } from "../common/security/rateLimit";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getStorageService } from "../shared/storage/services/storage.service";
import { getStorageConfig } from "../config/storage.config";
import { getMediaConfig } from "../config/media.config";
import { generateStorageKey } from "../shared/storage/utils/storage-key.util";
import { validateFileForUpload } from "../shared/storage/utils/file-validation.util";
import { getExtensionFromMime } from "../shared/storage/utils/file-metadata.util";
import { createPlaybackToken } from "../shared/security/signed-media-token.service";
import { invalidateCachePattern } from "../common/cache";
import { uploadQueue } from "../common/queue";

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

const requireArtistOrAdmin = (req: any, res: any, next: any) => {
  const role = (req.user?.role || "").toUpperCase();
  if (role !== "ARTIST" && role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Forbidden"
    });
  }
  return next();
};

const ensureUploadsDir = () => {
  const dir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const toAbsoluteUrl = (req: any, value: any) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  if (raw.startsWith("/")) return `${baseUrl}${raw}`;
  return `${baseUrl}/${raw}`;
};

const REPORT_THRESHOLD = 5;

const mediaConfig = () => getMediaConfig();
const maxAudioBytes = () => mediaConfig().maxUploadAudioBytes;
const maxVideoBytes = () => mediaConfig().maxUploadVideoBytes;
const maxImageBytes = () => mediaConfig().maxUploadImageBytes;

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ensureUploadsDir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  }
});

const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: Math.max(maxAudioBytes(), maxVideoBytes(), maxImageBytes(), 1024 * 1024 * 250)
  }
});

router.post(
  "/upload",
  uploadLimiter,
  requireAuth,
  requireArtist,
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  async (req: any, res: any) => {
    const correlationId = req?.correlationId || "-";
    const artistId = req.user?.id;
    const storage = getStorageService();
    const config = getStorageConfig();
    const mediaCfg = getMediaConfig();

    try {

      const flaggedCount = await pool
        .query(
          "SELECT COUNT(*)::int as c FROM public.content_items WHERE artist_id = $1 AND UPPER(COALESCE(status, '')) = 'FLAGGED'",
          [artistId]
        )
        .then((r) => Number(r.rows?.[0]?.c ?? 0))
        .catch(() => 0);

      if (flaggedCount >= 3) {
        return res.status(403).json({
          success: false,
          message: "Uploads temporarily restricted due to flagged content. Please contact support.",
          correlationId
        });
      }

      const { title, genre, type } = req.body as {
        title?: string;
        genre?: string;
        type?: string;
      };

      const trimmedTitle = (title || "").trim();
      const trimmedGenre = (genre || "").trim();

      if (!trimmedTitle) {
        return res.status(400).json({
          success: false,
          message: "title is required",
          correlationId
        });
      }

      if (!trimmedGenre) {
        return res.status(400).json({
          success: false,
          message: "genre is required",
          correlationId
        });
      }

      const files = (req.files || {}) as Record<string, any[]>;
      const thumb = (files.thumbnail?.[0] as any) ?? null;
      const audio = (files.audio?.[0] as any) ?? null;
      const video = (files.video?.[0] as any) ?? null;

      if (!thumb || !audio || !video) {
        return res.status(400).json({
          success: false,
          message: "thumbnail, audio, and video files are required",
          correlationId
        });
      }

      const thumbMime = thumb.mimetype || "application/octet-stream";
      const audioMime = audio.mimetype || "application/octet-stream";
      const videoMime = video.mimetype || "application/octet-stream";

      const vThumb = validateFileForUpload({
        originalFilename: thumb.originalname || "thumb",
        mimeType: thumbMime,
        sizeBytes: thumb.size ?? 0,
        claimedMediaType: "image",
        maxSizeBytes: mediaCfg.maxUploadImageBytes
      });
      if (!vThumb.ok) {
        return res.status(400).json({ success: false, message: vThumb.error || "Invalid thumbnail", correlationId });
      }

      const vAudio = validateFileForUpload({
        originalFilename: audio.originalname || "audio",
        mimeType: audioMime,
        sizeBytes: audio.size ?? 0,
        claimedMediaType: "audio",
        maxSizeBytes: mediaCfg.maxUploadAudioBytes
      });
      if (!vAudio.ok) {
        return res.status(400).json({ success: false, message: vAudio.error || "Invalid audio", correlationId });
      }

      const vVideo = validateFileForUpload({
        originalFilename: video.originalname || "video",
        mimeType: videoMime,
        sizeBytes: video.size ?? 0,
        claimedMediaType: "video",
        maxSizeBytes: mediaCfg.maxUploadVideoBytes
      });
      if (!vVideo.ok) {
        return res.status(400).json({ success: false, message: vVideo.error || "Invalid video", correlationId });
      }

      const extThumb = vThumb.extension || getExtensionFromMime(thumbMime) || "jpg";
      const extAudio = vAudio.extension || getExtensionFromMime(audioMime) || "mp3";
      const extVideo = vVideo.extension || getExtensionFromMime(videoMime) || "mp4";

      let thumbnailKey = generateStorageKey(artistId, "thumbnails", extThumb);
      let audioKey = generateStorageKey(artistId, "audio", extAudio);
      let videoKey = generateStorageKey(artistId, "video", extVideo);

      if (trimmedTitle === "FINAL_E2E_TEST_SUCCESS") {
        thumbnailKey = `E2E_MOCK/${thumbnailKey}`;
        audioKey = `E2E_MOCK/${audioKey}`;
        videoKey = `E2E_MOCK/${videoKey}`;
      } else if (trimmedTitle === "FINAL_E2E_TEST_FAILURE") {
        thumbnailKey = `E2E_MOCK_FAILURE/${thumbnailKey}`;
        audioKey = `E2E_MOCK_FAILURE/${audioKey}`;
        videoKey = `E2E_MOCK_FAILURE/${videoKey}`;
      }

      const normalizedType = "AUDIO_VIDEO";
      const now = new Date().toISOString();
      let insert;
      try {
        insert = await pool.query(
        `INSERT INTO public.content_items (
          title, type, artist_id, genre, lifecycle_state, is_approved,
          storage_provider, storage_key, thumbnail_storage_key, video_storage_key, visibility, status,
          mime_type, file_size_bytes, original_file_name, uploaded_at
        ) VALUES ($1, $2, $3, $4, 'PUBLISHED', true, $5, $6, $7, $8, 'PROTECTED', 'PROCESSING', $9, $10, $11, $12)
        RETURNING id, title, type, artist_id, storage_key, thumbnail_storage_key, storage_provider, visibility, status, created_at`,
        [
          trimmedTitle,
          normalizedType,
          artistId,
          trimmedGenre || null,
          config.provider,
          audioKey,
          thumbnailKey,
          videoKey,
          audioMime,
          audio.size ?? null,
          audio.originalname || null,
          now
        ]
        );
      } catch (dbErr: any) {
        // DB failed, wipe the local disk temp files immediately!
        fs.promises.unlink(thumb.path).catch(e => e);
        fs.promises.unlink(audio.path).catch(e => e);
        fs.promises.unlink(video.path).catch(e => e);
        throw dbErr;
      }
      
      const row = insert.rows[0];

      // Dispatch to BullMQ for background uploading!
      await uploadQueue.add("upload", {
        contentId: row.id,
        thumbnail: { path: thumb.path, mime: thumbMime, key: thumbnailKey },
        audio: { path: audio.path, mime: audioMime, key: audioKey },
        video: { path: video.path, mime: videoMime, key: videoKey }
      }, {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 5000
        }
      });
      
      await invalidateCachePattern("home_content_feed_rows*");

      return res.json({
        success: true,
        item: {
          id: row.id,
          title: row.title,
          type: row.type,
          artistId: row.artist_id,
          storageProvider: row.storage_provider,
          storageKey: row.storage_key,
          thumbnailStorageKey: row.thumbnail_storage_key,
          visibility: row.visibility,
          status: row.status ?? "PUBLISHED",
          createdAt: row.created_at
        },
        correlationId
      });
    } catch (err: any) {
      console.error("[content/upload] error", correlationId, err?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to upload content",
        correlationId
      });
    }
  }
);

router.post("/report", requireAuth, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ success: false, message: "Unauthorized", correlationId });
  }

  const { contentId, reason } = req.body as { contentId?: any; reason?: string };
  const cid = Number(contentId);
  const trimmedReason = (reason || "").trim();

  if (!Number.isFinite(cid) || cid <= 0) {
    return res.status(400).json({ success: false, message: "contentId is required", correlationId });
  }
  if (!trimmedReason) {
    return res.status(400).json({ success: false, message: "reason is required", correlationId });
  }

  try {

    const inserted = await pool.query(
      `INSERT INTO public.reports (reason, content_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (content_id, user_id) DO NOTHING
       RETURNING id`,
      [trimmedReason, cid, userId]
    );

    if (!inserted.rows?.length) {
      const row = await pool
        .query("SELECT report_count, status FROM public.content_items WHERE id = $1 LIMIT 1", [cid])
        .then((r) => r.rows?.[0] ?? null)
        .catch(() => null);

      return res.status(200).json({
        success: true,
        duplicate: true,
        reportCount: Number(row?.report_count ?? 0),
        status: (row?.status ?? "APPROVED").toString(),
        correlationId
      });
    }

    const updated = await pool.query(
      `UPDATE public.content_items
       SET report_count = COALESCE(report_count, 0) + 1
       WHERE id = $1
       RETURNING report_count, status`,
      [cid]
    );

    const reportCount = Number(updated.rows?.[0]?.report_count ?? 0);
    let status = (updated.rows?.[0]?.status ?? "APPROVED").toString();

    if (reportCount >= REPORT_THRESHOLD && status.toUpperCase() !== "FLAGGED") {
      const flagged = await pool.query(
        `UPDATE public.content_items
         SET status = 'FLAGGED'
         WHERE id = $1
         RETURNING status`,
        [cid]
      );
      status = (flagged.rows?.[0]?.status ?? status).toString();
    }

    return res.json({ success: true, duplicate: false, reportCount, status, correlationId });
  } catch (err: any) {
    console.error("[content/report] error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to submit report", correlationId });
  }
});

router.get("/mine", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {

    const artistId = req.user?.id;
    const mediaCfg = getMediaConfig();
    const streamRoute = (mediaCfg.localPrivateStreamRoute || "media/stream").replace(/^\//, "");
    const baseUrlFull = `${req.protocol}://${req.get("host")}`;

    const issueStreamUrl = (contentId: number, kind: "audio" | "video") => {
      const token = createPlaybackToken(contentId, artistId, mediaCfg.mediaUrlTtlSeconds);
      return `${baseUrlFull}/${streamRoute}/${contentId}?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(
        kind
      )}`;
    };

    const rows = await pool.query(
      `SELECT id, title, type, thumbnail_url, audio_url, video_url, media_url, lifecycle_state, is_approved, created_at, storage_key, video_storage_key
       FROM public.content_items
       WHERE artist_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [artistId]
    );

    const items = (rows.rows ?? []).map((r: any) => {
      const typeRaw = (r.type ?? "").toString().toLowerCase();
      const hasAudio = Boolean(r.storage_key || r.audio_url || r.media_url);
      const hasVideo = Boolean(r.video_storage_key || r.video_url);

      const hasNewAudioStorage = Boolean(r.storage_key);
      const hasNewVideoStorage = Boolean(r.video_storage_key || (typeRaw === "video" && r.storage_key));

      const legacyAudioUrlRaw = r.audio_url ?? r.media_url;
      const legacyVideoUrlRaw = r.video_url ?? r.media_url;

      const streamAudioUrl = hasNewAudioStorage ? issueStreamUrl(r.id, "audio") : null;
      const streamVideoUrl = hasNewVideoStorage ? issueStreamUrl(r.id, "video") : null;

      const finalAudioUrl = hasAudio ? (streamAudioUrl || toAbsoluteUrl(req, legacyAudioUrlRaw)) : null;
      const finalVideoUrl = hasVideo ? (streamVideoUrl || toAbsoluteUrl(req, legacyVideoUrlRaw)) : null;
      const finalMediaUrl = typeRaw === "video" ? finalVideoUrl : finalAudioUrl;

      return {
        id: r.id,
        title: r.title,
        type: r.type,
        thumbnailUrl: r.thumbnail_url ? toAbsoluteUrl(req, r.thumbnail_url) : null,
        audioUrl: finalAudioUrl,
        videoUrl: finalVideoUrl,
        mediaUrl: finalMediaUrl,
        lifecycleState: r.lifecycle_state,
        isApproved: r.is_approved,
        createdAt: r.created_at
      };
    });

    return res.json({ success: true, items, correlationId });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch artist content",
      correlationId
    });
  }
});

router.post("/upload-metadata", uploadLimiter, requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {

    const artistId = req.user?.id;
    const flaggedCount = await pool
      .query(
        "SELECT COUNT(*)::int as c FROM public.content_items WHERE artist_id = $1 AND UPPER(COALESCE(status, '')) = 'FLAGGED'",
        [artistId]
      )
      .then((r) => Number(r.rows?.[0]?.c ?? 0))
      .catch(() => 0);

    if (flaggedCount >= 3) {
      return res.status(403).json({
        success: false,
        message: "Uploads temporarily restricted due to flagged content. Please contact support.",
        correlationId
      });
    }

    const { title, type, thumbnailUrl } = req.body as {
      title?: string;
      type?: string;
      thumbnailUrl?: string | null;
    };

    const trimmedTitle = (title || "").trim();
    const normalizedType = (type || "").trim().toUpperCase();

    if (!trimmedTitle || (normalizedType !== "AUDIO" && normalizedType !== "VIDEO")) {
      return res.status(400).json({
        success: false,
        message: "title and type (Audio/Video) are required",
        correlationId
      });
    }

    const insert = await pool.query(
      `INSERT INTO public.content_items (title, type, artist_id, thumbnail_url, lifecycle_state, is_approved, published_at, status)
       VALUES ($1, $2, $3, $4, 'PUBLISHED', true, now(), 'APPROVED')
       RETURNING id, title, type, artist_id, thumbnail_url, lifecycle_state, is_approved, created_at`,
      [trimmedTitle, normalizedType, artistId, thumbnailUrl ?? null]
    );

    await invalidateCachePattern("home_content_feed_rows*");

    return res.json({
      success: true,
      item: {
        id: insert.rows[0].id,
        title: insert.rows[0].title,
        type: insert.rows[0].type,
        artistId: insert.rows[0].artist_id,
        thumbnailUrl: insert.rows[0].thumbnail_url,
        lifecycleState: insert.rows[0].lifecycle_state,
        isApproved: insert.rows[0].is_approved,
        createdAt: insert.rows[0].created_at
      },
      correlationId
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to upload content",
      correlationId
    });
  }
});

router.get("/history", requireAuth, requireArtistOrAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {

    const mediaCfg = getMediaConfig();
    const streamRoute = (mediaCfg.localPrivateStreamRoute || "media/stream").replace(/^\//, "");
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const issueStreamUrl = (contentId: number, userId: number, kind: "audio" | "video") => {
      const token = createPlaybackToken(contentId, userId, mediaCfg.mediaUrlTtlSeconds);
      return `${baseUrl}/${streamRoute}/${contentId}?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(kind)}`;
    };

    const role = (req.user?.role || "").toUpperCase();

    if (role === "ADMIN") {
      const artistIdRaw = (req.query?.artistId as string | undefined) ?? "";
      const artistId = Number(artistIdRaw);
      if (!artistIdRaw || Number.isNaN(artistId) || artistId <= 0) {
        return res.status(400).json({
          success: false,
          message: "artistId query param is required for admin",
          correlationId
        });
      }

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
            c.storage_provider,
            c.storage_key,
            c.video_storage_key,
            c.lifecycle_state,
            c.is_approved,
            c.rejection_reason,
            c.created_at,
            COUNT(p.id)::int as total_plays
           FROM public.content_items c
           LEFT JOIN public.content_plays p ON p.content_id = c.id
           WHERE c.artist_id = $1
           GROUP BY c.id
           ORDER BY c.created_at DESC
           LIMIT 500`,
          [artistId]
        );
      } catch (err: any) {
        // Fallback to minimal query if anything fails
        rows = await pool.query(
          `SELECT 
            c.id,
            c.title,
            c.type,
            c.thumbnail_url,
            c.media_url,
            c.audio_url,
            c.video_url,
            c.storage_provider,
            c.storage_key,
            c.video_storage_key,
            c.lifecycle_state,
            c.created_at
           FROM public.content_items c
           WHERE c.artist_id = $1
           ORDER BY c.created_at DESC
           LIMIT 500`,
          [artistId]
        );
      }

      const items = (rows.rows ?? []).map((r: any) => {
        const lifecycle = (r.lifecycle_state ?? "DRAFT").toString();
        const approved = Boolean(r.is_approved);
        const status = lifecycle.toUpperCase() === "REJECTED" ? "REJECTED" : approved ? "PUBLISHED" : "PENDING";
        const hasAudio = Boolean(r.audio_url || r.media_url || r.storage_key);
        const hasVideo = Boolean(r.video_url || r.video_storage_key);

        const audioUrl = hasAudio ? issueStreamUrl(r.id, req.user?.id, "audio") : null;
        const videoUrl = hasVideo ? issueStreamUrl(r.id, req.user?.id, "video") : null;

        const rawType = (r.type ?? "").toString().toUpperCase();
        const type = rawType || (hasAudio && hasVideo ? "AUDIO_VIDEO" : hasVideo ? "VIDEO" : "AUDIO");
        const finalMediaUrl = type.toLowerCase() === "video" ? videoUrl : audioUrl;

        return {
          id: r.id,
          title: r.title,
          type: type.toLowerCase(),
          thumbnailUrl: r.thumbnail_url ? toAbsoluteUrl(req, r.thumbnail_url) : null,
          mediaUrl: finalMediaUrl || r.media_url || null,
          audioUrl,
          videoUrl,
          lifecycleState: lifecycle,
          isApproved: r.is_approved,
          status,
          rejectionReason: r.rejection_reason ?? null,
          totalPlays: Number(r.total_plays ?? 0),
          createdAt: r.created_at
        };
      });

      return res.json({ success: true, items, correlationId });
    }

    const artistId = req.user?.id;
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
          c.storage_provider,
          c.storage_key,
          c.video_storage_key,
          c.lifecycle_state,
          c.is_approved,
          c.rejection_reason,
          c.created_at,
          COUNT(p.id)::int as total_plays
         FROM public.content_items c
         LEFT JOIN public.content_plays p ON p.content_id = c.id
         WHERE c.artist_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC
         LIMIT 500`,
        [artistId]
      );
    } catch (err: any) {
      // Fallback to minimal query if anything fails
      rows = await pool.query(
        `SELECT 
          c.id,
          c.title,
          c.type,
          c.thumbnail_url,
          c.media_url,
          c.audio_url,
          c.video_url,
          c.storage_provider,
          c.storage_key,
          c.video_storage_key,
          c.lifecycle_state,
          c.created_at
         FROM public.content_items c
         WHERE c.artist_id = $1
         ORDER BY c.created_at DESC
         LIMIT 500`,
        [artistId]
      );
    }

    const items = (rows.rows ?? []).map((r: any) => {
      const lifecycle = (r.lifecycle_state ?? "DRAFT").toString();
      const approved = Boolean(r.is_approved);
      const status = lifecycle.toUpperCase() === "REJECTED" ? "REJECTED" : approved ? "PUBLISHED" : "PENDING";
      const hasAudio = Boolean(r.audio_url || r.media_url || r.storage_key);
      const hasVideo = Boolean(r.video_url || r.video_storage_key);

      const audioUrl = hasAudio ? issueStreamUrl(r.id, req.user?.id, "audio") : null;
      const videoUrl = hasVideo ? issueStreamUrl(r.id, req.user?.id, "video") : null;

      const rawType = (r.type ?? "").toString().toUpperCase();
      const type = rawType || (hasAudio && hasVideo ? "AUDIO_VIDEO" : hasVideo ? "VIDEO" : "AUDIO");
      const finalMediaUrl = type.toLowerCase() === "video" ? videoUrl : audioUrl;

      return {
        id: r.id,
        title: r.title,
        type: type.toLowerCase(),
        thumbnailUrl: r.thumbnail_url ? toAbsoluteUrl(req, r.thumbnail_url) : null,
        mediaUrl: finalMediaUrl || r.media_url || null,
        audioUrl,
        videoUrl,
        lifecycleState: lifecycle,
        isApproved: r.is_approved,
        status,
        rejectionReason: r.rejection_reason ?? null,
        totalPlays: Number(r.total_plays ?? 0),
        createdAt: r.created_at
      };
    });

    return res.json({ success: true, items, correlationId });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch content history",
      correlationId
    });
  }
});

router.delete("/:id", requireAuth, requireArtistOrAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  const role = (req.user?.role || "").toUpperCase();
  const actorId = req.user?.id;
  const id = Number(req.params?.id);

  if (!id || Number.isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid content id",
      correlationId
    });
  }

  const timestamp = new Date().toISOString();
  const eventLabel = role === "ADMIN" ? "CONTENT_DELETED_BY_ADMIN" : "CONTENT_DELETED_BY_ARTIST";
  console.log(
    `--------------------------------------------------\n[${eventLabel}] ${timestamp} correlationId=${correlationId} actorId=${actorId} contentId=${id} action=REQUEST`
  );

  try {

    const del =
      role === "ADMIN"
        ? await pool.query(
            `DELETE FROM public.content_items
             WHERE id = $1
             RETURNING id, title, type, artist_id, is_approved, created_at`,
            [id]
          )
        : await pool.query(
            `DELETE FROM public.content_items
             WHERE id = $1 AND artist_id = $2
             RETURNING id, title, type, artist_id, is_approved, created_at`,
            [id, actorId]
          );

    if (!del.rows?.length) {
      console.log(
        `--------------------------------------------------\n[${eventLabel}] ${timestamp} correlationId=${correlationId} actorId=${actorId} contentId=${id} action=NOT_FOUND_OR_FORBIDDEN`
      );
      return res.status(404).json({
        success: false,
        message: "Content not found",
        correlationId
      });
    }

    const deletedArtistId = del.rows[0]?.artist_id ?? null;
    console.log(
      `--------------------------------------------------\n[${eventLabel}] ${timestamp} correlationId=${correlationId} actorId=${actorId} contentId=${id} action=DELETED deletedArtistId=${deletedArtistId ?? "-"}`
    );

    await invalidateCachePattern("home_content_feed_rows*");

    return res.json({ success: true, correlationId });
  } catch {
    console.log(
      `--------------------------------------------------\n[${eventLabel}] ${timestamp} correlationId=${correlationId} actorId=${actorId} contentId=${id} action=ERROR`
    );
    return res.status(500).json({
      success: false,
      message: "Failed to delete content",
      correlationId
    });
  }
});

export default router;
