/**
 * GET /media/stream/:mediaId?token=...
 * Validates signed token, streams file with Range support (Accept-Ranges, Content-Range).
 * Section 21: seekable playback for local/private stream.
 */

import { Router, Request, Response } from "express";
import { verifyPlaybackToken } from "../../shared/security/signed-media-token.service";
import { getContentForAccess } from "../../shared/security/media-authz.service";
import { getStorageService } from "../../shared/storage/services/storage.service";
import { getStorageProviderByName } from "../../shared/storage/factory/storage-provider.factory";
import { getStorageConfig } from "../../config/storage.config";
import { generatePlaybackAccess } from "../../shared/delivery/services/media-delivery.service";
import { MediaInvalidTokenException } from "../../shared/exceptions/media.exception";
import { MediaNotFoundException } from "../../shared/exceptions/media.exception";

const router = Router();

function inferContentTypeFromKey(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return null;
}

router.get("/:mediaId", async (req: Request, res: Response) => {
  const mediaId = Number(req.params.mediaId);
  const token = (req.query.token as string)?.trim();
  const kind = ((req.query.kind as string) || "audio").toString().toLowerCase();

  if (!token) {
    console.warn("[media/stream] missing token", { mediaId, kind });
    return res.status(401).json({ success: false, message: "Token required" });
  }
  if (!Number.isFinite(mediaId) || mediaId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid media id" });
  }

  let payload: { mediaId: number; userId: number };
  try {
    payload = verifyPlaybackToken(token);
  } catch (err: any) {
    if (err instanceof MediaInvalidTokenException) {
      console.warn("[media/stream] invalid token", { mediaId, kind, error: err?.message });
      return res.status(401).json({ success: false, message: err.message });
    }
    console.warn("[media/stream] token verification failed", { mediaId, kind, error: err?.message });
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  if (payload.mediaId !== mediaId) {
    console.warn("[media/stream] token media mismatch", {
      mediaId,
      payloadMediaId: payload.mediaId,
      kind
    });
    return res.status(403).json({ success: false, message: "Token does not match media" });
  }

  const content = await getContentForAccess(mediaId);
  if (!content) {
    return res.status(404).json({ success: false, message: "Media not found" });
  }

  const storageKey = kind === "video" ? content.video_storage_key : content.storage_key;
  const storageProvider = (content.storage_provider || "local").toString().toLowerCase();

  if (!storageKey) {
    return res.status(404).json({ success: false, message: "Media not available for stream" });
  }

  // For Cloudinary, generate a signed URL and redirect
  // Only use Cloudinary if the row explicitly has storage_provider='cloudinary'
  // Old content with storage_provider='local' or NULL will use streaming below
  if (storageProvider === "cloudinary") {
    try {
      const accessResult = await generatePlaybackAccess({
        mediaId,
        storageProvider: "cloudinary",
        storageKey,
        contentType: content.mime_type || undefined,
        contentLength: content.file_size_bytes || undefined,
        visibility: (content.visibility || "PROTECTED") as any,
        userId: payload.userId,
        expiresInSeconds: 300,
        token
      });
      
      if (accessResult?.playbackUrl) {
        return res.redirect(302, accessResult.playbackUrl);
      }
    } catch (err: any) {
      console.error("[media/stream] Cloudinary playback error", { mediaId, error: err?.message });
      // Fallback to local stream if Cloudinary fails (for hybrid scenarios)
      // Continue to local stream logic below
    }
  }

  // For local storage (old content), stream directly
  // This ensures backward compatibility with old local files
  if (storageProvider !== "local" && storageProvider !== "cloudinary") {
    return res.status(400).json({
      success: false,
      message: "This endpoint is for local stream only; use the playback URL from /stream/access"
    });
  }

  // Use the per-row provider for local storage, not the global one
  const storage = storageProvider === "local"
    ? getStorageProviderByName("local")
    : getStorageService();
  let totalLength: number;
  let contentType: string;

  try {
    const meta = await storage.getObjectMetadata(storageKey);
    if (!meta) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    totalLength = meta.contentLength ?? 0;
    const inferred = inferContentTypeFromKey(storageKey);
    const fromMeta = meta.contentType || "";
    contentType = fromMeta && fromMeta !== "application/octet-stream" ? fromMeta : inferred || "application/octet-stream";
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to get media" });
  }

  const rangeHeader = req.headers.range;
  let start = 0;
  let end = totalLength - 1;
  let statusCode = 200;

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      start = match[1] ? parseInt(match[1], 10) : 0;
      end = match[2] ? parseInt(match[2], 10) : totalLength - 1;
      if (end >= totalLength) end = totalLength - 1;
      statusCode = 206;
    }
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("Content-Disposition", "inline");

  if (statusCode === 206) {
    const contentLength = end - start + 1;
    res.setHeader("Content-Length", contentLength);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${totalLength}`);
    res.status(206);
  } else {
    res.setHeader("Content-Length", totalLength);
  }

  try {
    const { stream } = await storage.openReadStream({ storageKey, start, end });
    stream.pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Stream failed" });
    }
  }
});

export default router;
