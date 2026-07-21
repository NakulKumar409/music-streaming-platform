/**
 * POST /api/v1/fan/stream/access - request playback URL via MediaAccessService.
 */

import { Router } from "express";
import { pool } from "../../common/db";
import { getStorageProviderByName } from "../../shared/storage/factory/storage-provider.factory";
import { requestPlaybackAccess } from "../../modules/media/media-access.service";
import { getMediaConfig } from "../../config/media.config";
import { resolveMediaIdentity } from "../../shared/media/media-asset-locator";
import { mapStreamAccessError } from "./stream-access-error";
import { logger } from "../../common/logger";
import { requireAuth } from "../../common/auth/requireAuth";

const router = Router();

router.post("/access", async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const contentId = Number(req.body?.contentId);
  const kindRaw = (req.body?.kind ?? "").toString().toLowerCase();
  const kind = kindRaw === "video" ? "video" : kindRaw === "audio" ? "audio" : undefined;
  
  const qualityRaw = (req.body?.quality ?? "").toString();
  const validQualities = ['144p', '240p', '360p', '480p', '720p', '1080p', 'Auto', 'SD', 'HD'];
  const quality = validQualities.includes(qualityRaw) ? qualityRaw : undefined;

  if (!Number.isFinite(contentId) || contentId <= 0) {
    return res.status(400).json({
      success: false,
      message: "contentId required",
      correlationId
    });
  }

  try {
    const result = await requestPlaybackAccess({
      contentId,
      userId: req.user?.id ?? null,
      kind,
      quality,
      allowPreview: Boolean(req.body?.allowPreview)
    });

    const mediaCfg = getMediaConfig();
    const configuredBase = (mediaCfg.appBaseUrl || "").replace(/\/+$/, "");
    const requestBase = `${req.protocol}://${req.get("host")}`;
    const streamRoute = (mediaCfg.localPrivateStreamRoute || "/media/stream").replace(/\/+$/, "");

    const rawUrl = (result.playbackUrl ?? "").toString();
    let playbackUrl = rawUrl;

    // 1) If the strategy used APP_BASE_URL, rewrite it to current request host/port.
    if (configuredBase && rawUrl.startsWith(configuredBase)) {
      playbackUrl = `${requestBase}${rawUrl.slice(configuredBase.length)}`;
    }

    // 2) If it's a local private stream URL, always return it rooted at request host/port.
    // This avoids cases where APP_BASE_URL defaults to localhost:3000 which is not reachable by devices.
    try {
      const u = new URL(playbackUrl);
      if (u.pathname.startsWith(streamRoute)) {
        playbackUrl = `${requestBase}${u.pathname}${u.search}`;
      }
    } catch {
      // ignore invalid URL
    }

    return res.json({
      success: true,
      mediaId: result.mediaId,
      playbackUrl,
      expiresIn: result.expiresIn,
      contentType: result.contentType,
      contentLength: result.contentLength,
      correlationId
    });
  } catch (err: any) {
    const mapped = mapStreamAccessError(err);
    if (mapped.status >= 500) {
      console.error("[stream/access] error", {
        correlationId,
        code: mapped.code,
        message: mapped.message,
        name: err?.name
      });
    } else {
      console.warn("[stream/access] rejected", {
        correlationId,
        code: mapped.code,
        message: mapped.message
      });
    }
    return res.status(mapped.status).json({
      success: false,
      code: mapped.code,
      message: mapped.message,
      correlationId
    });
  }
});

/**
 * POST /api/v1/fan/stream/heartbeat
 * Keeps a playback session alive. Client should call this every 30-60s.
 */
router.post("/heartbeat", requireAuth, async (req: any, res: any) => {
  const userId = req.user?.id;
  const contentId = Number(req.body?.contentId);
  const currentPosition = Number(req.body?.currentPosition ?? 0);
  const duration = Number(req.body?.duration ?? 0);
  const correlationId = req?.correlationId || "-";

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!Number.isFinite(contentId) || contentId <= 0) {
    return res.status(400).json({ success: false, message: "contentId required" });
  }

  try {
    // Try to update existing session first - ONLY if it's not stale (last heartbeat within 5 mins)
    const result = await pool.query(
      `UPDATE playback_sessions 
       SET heartbeat_at = now(), current_position = $3, duration = $4
       WHERE user_id = $1 AND content_id = $2 
       AND heartbeat_at > now() - INTERVAL '5 minutes'
       RETURNING id, heartbeat_at`,
      [userId, contentId, currentPosition, duration]
    );

    let lastSeen = new Date();
    // If no active session exists (or it was stale), create one
    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        `INSERT INTO playback_sessions (user_id, content_id, started_at, heartbeat_at, current_position, duration)
         VALUES ($1, $2, now(), now(), $3, $4)
         RETURNING heartbeat_at`,
        [userId, contentId, currentPosition, duration]
      );
      
      if (insertResult.rows[0]?.heartbeat_at) {
        lastSeen = insertResult.rows[0].heartbeat_at;
      }

      // Record a play for analytics (each new session = 1 play)
      await pool.query(
        `INSERT INTO content_plays (content_id, user_id, created_at)
         VALUES ($1, $2, now())`,
        [contentId, userId]
      ).then(() => {
        logger.info({ userId, contentId }, "[ANALYTICS] Play recorded successfully");
      }).catch(err => {
        logger.error({ userId, contentId, error: err.message }, "[ANALYTICS] Failed to record content play");
        // Don't fail the heartbeat if play recording fails (non-critical)
      });
    } else {
      if (result.rows[0]?.heartbeat_at) {
        lastSeen = result.rows[0].heartbeat_at;
      }
    }

    // Increment monthly listening stats (30 seconds per heartbeat)
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    try {
      await pool.query(
        `INSERT INTO user_listening_stats (user_id, year, month, total_seconds)
         VALUES ($1, $2, $3, 30)
         ON CONFLICT (user_id, year, month)
         DO UPDATE SET total_seconds = user_listening_stats.total_seconds + 30`,
        [userId, year, month]
      );
    } catch (err: any) {
      logger.error({ userId, contentId, error: err.message }, "[HEARTBEAT] Failed to update stats");
      // Don't fail the entire heartbeat if stats fails (non-critical)
    }

    return res.json({
      success: true,
      currentPosition,
      duration,
      lastSeen: lastSeen.toISOString(),
      correlationId
    });
  } catch (err: any) {
    logger.error({ userId, contentId, error: err.message, correlationId }, "[HEARTBEAT] Failed");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get("/thumbnail/:contentId", async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const contentId = Number(req.params?.contentId);

  if (!Number.isFinite(contentId) || contentId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid content id", correlationId });
  }

  try {
    const result = await pool.query(
      `SELECT thumbnail_storage_key, thumbnail_url, storage_provider, thumbnail_provider_asset_id
       FROM content_items
       WHERE id = $1
       LIMIT 1`,
      [contentId]
    ).catch(async (err: any) => {
      if (err?.code === "42703") {
        return pool.query(
          `SELECT thumbnail_storage_key, thumbnail_url, storage_provider
           FROM content_items
           WHERE id = $1
           LIMIT 1`,
          [contentId]
        );
      }
      throw err;
    });
    const row = result.rows?.[0];
    const storageProvider = (row?.storage_provider as string | null) ?? "local";
    const identity = resolveMediaIdentity(row, "thumbnail");
    const storageKey = identity.internalStorageKey;
    const providerAssetId = identity.providerAssetId;

    console.log(
      `[stream/thumbnail] contentId=${contentId}, storageProvider=${storageProvider}, storageKey=${storageKey?.substring(0, 50)}..., providerAssetId=${providerAssetId?.substring(0, 50)}...`
    );

    if (!storageKey && !providerAssetId && !row?.thumbnail_url) {
      return res.status(404).json({ success: false, message: "Thumbnail not found", correlationId });
    }

    // For local/firebase/s3 storage (or old content), stream the content
    // This ensures backward compatibility with old local files
    // Use the per-row provider, not the global one
    console.log(`[stream/thumbnail] Using provider ${storageProvider} for streaming`);
    
    try {
      const storage = getStorageProviderByName(storageProvider as any);
      
      // For Cloudinary, always use signed URLs - never stream
      if (storageProvider === "cloudinary" && providerAssetId && storage.getPublicObjectUrl) {
        const thumbnailUrl = await storage.getPublicObjectUrl({
          providerAssetId,
          mediaType: "thumbnail"
        });
        if (thumbnailUrl) {
          console.log(`[stream/thumbnail] Generated Cloudinary signed URL: ${thumbnailUrl.substring(0, 80)}...`);
          return res.redirect(302, thumbnailUrl);
        }
      }

      // For other providers, try public URL
      if (providerAssetId && storage.getPublicObjectUrl) {
        const thumbnailUrl = await storage.getPublicObjectUrl({
          providerAssetId,
          mediaType: "thumbnail"
        });
        if (thumbnailUrl) {
          console.log(`[stream/thumbnail] Generated provider thumbnail URL: ${thumbnailUrl.substring(0, 80)}...`);
          return res.redirect(302, thumbnailUrl);
        }
      }

      // If DB already stores direct URL, redirect as legacy fallback.
      const directUrl = (row?.thumbnail_url as string | null) ?? null;
      const isFullUrl = Boolean(directUrl && (directUrl.startsWith("http://") || directUrl.startsWith("https://")));
      console.log(`[stream/thumbnail] isFullUrl=${isFullUrl}, storageProvider=${storageProvider}`);
      if (isFullUrl) {
        console.log(`[stream/thumbnail] Redirecting to full URL: ${directUrl!.substring(0, 80)}...`);
        return res.redirect(302, directUrl!);
      }

      // Cloudinary should never reach here - if it does, return error
      if (storageProvider === "cloudinary") {
        return res.status(404).json({
          success: false,
          message: "Cloudinary thumbnail not available. Missing provider asset ID.",
          correlationId
        });
      }

      if (!storageKey) {
        return res.status(409).json({
          success: false,
          message: `Thumbnail mapping incomplete for provider ${storageProvider}. Repair this content row.`,
          correlationId
        });
      }

      const meta = await storage.getObjectMetadata(storageKey);
      const read = await storage.openReadStream({ storageKey });

      if (meta?.contentType) {
        res.setHeader("Content-Type", meta.contentType);
      } else if (read?.contentType) {
        res.setHeader("Content-Type", read.contentType);
      }
      if (meta?.contentLength !== undefined) {
        res.setHeader("Content-Length", String(meta.contentLength));
      } else if (read?.contentLength !== undefined) {
        res.setHeader("Content-Length", String(read.contentLength));
      }

      res.setHeader("Cache-Control", "public, max-age=300");
      read.stream.on("error", () => {
        try {
          res.end();
        } catch {
          // ignore
        }
      });
      return read.stream.pipe(res);
    } catch (streamErr: any) {
      console.error(`[stream/thumbnail] Streaming failed for ${storageProvider}:`, streamErr.message);
      // Return 404 for non-Cloudinary providers that fail (e.g., Firebase PEM errors)
      return res.status(404).json({ 
        success: false, 
        message: `Thumbnail not available from ${storageProvider} storage`, 
        correlationId 
      });
    }
  } catch (err: any) {
    const isNotFound =
      err?.message?.includes("No such object") ||
      err?.message?.includes("Not Found") ||
      err?.code === 404;
    if (isNotFound) {
      return res.status(404).json({ success: false, message: "Thumbnail not found in storage", correlationId });
    }
    console.error("[stream/thumbnail] error", { contentId, correlationId }, err);
    return res.status(500).json({ success: false, message: "Failed to load thumbnail", correlationId });
  }
});

export default router;
