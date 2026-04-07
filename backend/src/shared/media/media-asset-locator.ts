import { extractPublicIdFromUrl, isValidPublicId, normalizePublicId } from "../utils/cloudinary.utils";

export type MediaAssetKind = "audio" | "video" | "thumbnail";

export interface ContentMediaIdentityRow {
  storage_provider?: string | null;
  type?: string | null;
  storage_key?: string | null;
  video_storage_key?: string | null;
  thumbnail_storage_key?: string | null;
  provider_asset_id?: string | null;
  audio_provider_asset_id?: string | null;
  video_provider_asset_id?: string | null;
  thumbnail_provider_asset_id?: string | null;
  media_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  file_key?: string | null;
  thumbnail_url?: string | null;
}

export interface ResolvedMediaIdentity {
  provider: string;
  internalStorageKey: string | null;
  providerAssetId: string | null;
}

function normalizeProvider(provider: string | null | undefined): string {
  return (provider || "local").toString().trim().toLowerCase();
}

function normalizeCloudinaryId(candidate: string | null | undefined): string | null {
  const raw = (candidate || "").toString().trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const extracted = extractPublicIdFromUrl(raw);
    if (!extracted) return null;
    try {
      const normalized = normalizePublicId(extracted);
      return isValidPublicId(normalized) ? normalized : null;
    } catch {
      return null;
    }
  }
  // Some rows store Cloudinary public_id with extension (e.g. foo/bar.mp4)
  // or version prefix (e.g. v123/foo/bar). Normalize to a true public_id.
  try {
    const normalized = normalizePublicId(raw);
    return isValidPublicId(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function cloudinaryFallbackFromUrl(
  row: ContentMediaIdentityRow,
  kind: MediaAssetKind
): string | null {
  if (kind === "thumbnail") {
    return normalizeCloudinaryId(row.thumbnail_url ?? null);
  }
  if (kind === "video") {
    return (
      normalizeCloudinaryId(row.video_url ?? null) ||
      normalizeCloudinaryId(row.file_key ?? null) ||
      null
    );
  }
  return (
    normalizeCloudinaryId(row.audio_url ?? null) ||
    normalizeCloudinaryId(row.media_url ?? null) ||
    normalizeCloudinaryId(row.file_key ?? null) ||
    null
  );
}

function resolveInternalStorageKey(
  row: ContentMediaIdentityRow,
  kind: MediaAssetKind
): string | null {
  if (kind === "thumbnail") {
    return row.thumbnail_storage_key ?? null;
  }
  if (kind === "video") {
    return row.video_storage_key ?? row.storage_key ?? null;
  }
  return row.storage_key ?? null;
}

function resolveCloudinaryProviderAssetId(
  row: ContentMediaIdentityRow,
  kind: MediaAssetKind
): string | null {
  const type = (row.type || "").toString().toLowerCase();
  const isVideoContent = type.includes("video");

  if (kind === "thumbnail") {
    return (
      normalizeCloudinaryId(row.thumbnail_provider_asset_id ?? null) ||
      cloudinaryFallbackFromUrl(row, "thumbnail")
    );
  }

  if (kind === "video") {
    return (
      normalizeCloudinaryId(row.video_provider_asset_id ?? null) ||
      (isVideoContent ? normalizeCloudinaryId(row.provider_asset_id ?? null) : null) ||
      cloudinaryFallbackFromUrl(row, "video")
    );
  }

  return (
    normalizeCloudinaryId(row.audio_provider_asset_id ?? null) ||
    (!isVideoContent ? normalizeCloudinaryId(row.provider_asset_id ?? null) : null) ||
    cloudinaryFallbackFromUrl(row, "audio")
  );
}

export function resolveMediaIdentity(
  row: ContentMediaIdentityRow,
  kind: MediaAssetKind
): ResolvedMediaIdentity {
  const provider = normalizeProvider(row.storage_provider ?? null);
  const internalStorageKey = resolveInternalStorageKey(row, kind);

  if (provider === "cloudinary") {
    return {
      provider,
      internalStorageKey,
      providerAssetId: resolveCloudinaryProviderAssetId(row, kind)
    };
  }

  return {
    provider,
    internalStorageKey,
    providerAssetId: null
  };
}

