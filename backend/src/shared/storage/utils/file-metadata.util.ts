/**
 * Safe MIME/extension mapping for the Phase-1 approved upload set.
 */

export const ALLOWED_AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
]);

export const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime",
]);

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type LogicalMediaType = "audio" | "video" | "image";

/**
 * Canonicalize upload/storage MIME values before validation and persistence.
 * Parameters such as an empty codecs attribute are not part of the media type
 * identity and must not leak into object metadata.
 */
export function normalizeMediaMimeType(mime: string): string {
  const base = String(mime || "")
    .trim()
    .toLowerCase()
    .split(";")[0]
    ?.trim() || "";

  if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
  if (base === "audio/mp3") return "audio/mpeg";
  if (base === "audio/x-wav") return "audio/wav";
  return base;
}

export function getExtensionFromMime(mime: string): string | null {
  return MIME_TO_EXT[normalizeMediaMimeType(mime)] ?? null;
}

export function getLogicalMediaType(mime: string): LogicalMediaType | null {
  const m = normalizeMediaMimeType(mime);
  if (ALLOWED_AUDIO_MIMES.has(m)) return "audio";
  if (ALLOWED_VIDEO_MIMES.has(m)) return "video";
  if (ALLOWED_IMAGE_MIMES.has(m)) return "image";
  return null;
}
