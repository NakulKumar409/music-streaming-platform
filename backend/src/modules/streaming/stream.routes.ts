/**
 * POST /api/v1/fan/stream/access - request playback URL via MediaAccessService.
 */

import { Router } from "express";
import { pool } from "../../common/db";
import { requestPlaybackAccess } from "../../modules/media/media-access.service";
import { getStorageService } from "../../shared/storage/services/storage.service";
import { getMediaConfig } from "../../config/media.config";
import {
  MediaNotFoundException,
  MediaNotReadyException,
  MediaAccessDeniedException,
  MediaInvalidTokenException
} from "../../shared/exceptions/media.exception";

const router = Router();

router.post("/access", async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const contentId = Number(req.body?.contentId);
  const kindRaw = (req.body?.kind ?? "").toString().toLowerCase();
  const kind = kindRaw === "video" ? "video" : kindRaw === "audio" ? "audio" : undefined;

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
      kind
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
    if (err instanceof MediaNotFoundException) {
      return res.status(404).json({ success: false, message: "Content not found", correlationId });
    }
    if (err instanceof MediaNotReadyException) {
      return res.status(403).json({ success: false, message: err.message, correlationId });
    }
    if (err instanceof MediaAccessDeniedException) {
      return res.status(403).json({ success: false, message: err.message, correlationId });
    }
    if (err instanceof MediaInvalidTokenException) {
      return res.status(401).json({ success: false, message: err.message, correlationId });
    }
    console.error("[stream/access] error", err);
    return res.status(500).json({
      success: false,
      message: "Failed to get playback access",
      correlationId
    });
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
      `SELECT thumbnail_storage_key
       FROM content_items
       WHERE id = $1
       LIMIT 1`,
      [contentId]
    );
    const row = result.rows?.[0];
    const storageKey = (row?.thumbnail_storage_key as string | null) ?? null;

    if (!storageKey) {
      return res.status(404).json({ success: false, message: "Thumbnail not found", correlationId });
    }

    const storage = getStorageService();
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
  } catch (err: any) {
    console.error("[stream/thumbnail] error", { contentId, correlationId }, err);
    return res.status(500).json({ success: false, message: "Failed to load thumbnail", correlationId });
  }
});

export default router;
