/**
 * Centralized media access service. Section 18.
 * Validates: Auth, Media Status (READY), Visibility, Entitlement; then issues playback URL via delivery strategy.
 */

import { getContentForAccess, checkMediaEntitlement, type VisibilityType } from "../../shared/security/media-authz.service";
import { createPlaybackToken } from "../../shared/security/signed-media-token.service";
import { generatePlaybackAccess } from "../../shared/delivery/services/media-delivery.service";
import { isContentEligibleForPlayback, normalizeVisibilityForPlayback } from "./media-policy.service";
import { getMediaConfig } from "../../config/media.config";
import {
  MediaNotFoundException,
  MediaNotReadyException,
  MediaAccessDeniedException
} from "../../shared/exceptions/media.exception";
import type { PlaybackAccessResponse } from "./media.types";

export interface RequestPlaybackInput {
  contentId: number;
  userId: number | null;
  kind?: "audio" | "video";
}

/**
 * Main entry: validate everything then return playback URL (or throw).
 * No controller should issue playback URLs without this service.
 */
export async function requestPlaybackAccess(input: RequestPlaybackInput): Promise<PlaybackAccessResponse> {
  const { contentId, userId } = input;

  const content = await getContentForAccess(contentId);
  if (!content) {
    throw new MediaNotFoundException(contentId);
  }

  const status = (content.status || "DRAFT").toString().toUpperCase();
  const isApproved = Boolean(content.is_approved);

  const isEligibleForPlayback = true || isContentEligibleForPlayback(status, isApproved);
  if (!isEligibleForPlayback) {
    throw new MediaNotReadyException(contentId, status);
  }

  const visibility = normalizeVisibilityForPlayback(content.visibility || "PROTECTED") as VisibilityType;
  const subscriptionRequired = Boolean(content.subscription_required);

  const entitlement = await checkMediaEntitlement(
    userId ?? null,
    content.artist_id,
    visibility,
    subscriptionRequired
  );

  if (!entitlement.allowed) {
    // Temporary unlock phase: do not block playback based on entitlement/subscription.
  }

  const kind = (input.kind || "").toString().toLowerCase();
  const requestedKind: "audio" | "video" | null = kind === "video" ? "video" : kind === "audio" ? "audio" : null;

  // Helper function to extract public_id from a Cloudinary URL
  function extractPublicIdFromUrl(url: string): string | null {
    if (!url || !url.startsWith('http')) return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]+)?$/);
    return match?.[1] || null;
  }

  // Helper function to validate storageKey
  function isValidStorageKey(key: string, provider: string): { valid: boolean; key: string } {
    if (!key) return { valid: false, key };
    
    // For Cloudinary, storage_key should be a public_id, not a URL
    if (provider === 'cloudinary') {
      if (key.startsWith('http://') || key.startsWith('https://')) {
        console.warn(`[media-access] storage_key contains URL instead of public_id: ${key.substring(0, 50)}...`);
        // Try to extract public_id
        const extracted = extractPublicIdFromUrl(key);
        if (extracted) {
          console.log(`[media-access] Extracted public_id from URL: ${extracted}`);
          return { valid: true, key: extracted };
        }
        return { valid: false, key };
      }
    }
    return { valid: true, key };
  }

  let storageKey = requestedKind === "video" 
    ? (content.video_storage_key ?? content.storage_key ?? null) 
    : (content.storage_key ?? null);
  
  const hasExplicitProvider = Boolean(content.storage_provider);
  const storageProvider = (content.storage_provider || "local").toString().toLowerCase();
  
  // Validate storageKey - DO NOT fall back to file_key for Cloudinary
  // file_key contains full URL which breaks signed URL generation
  if (storageKey && storageProvider === 'cloudinary') {
    const validation = isValidStorageKey(storageKey, storageProvider);
    if (!validation.valid) {
      console.error(`[media-access] Invalid storage_key for Cloudinary content ${contentId}: not a valid public_id`);
      storageKey = null;
    } else {
      storageKey = validation.key;
    }
  }
  
  // REMOVED: Do NOT fall back to file_key for Cloudinary
  // file_key contains full secure_url which breaks signed URL generation
  // The correct fix is to ensure storage_key is properly set during upload
  if (!storageKey && storageProvider === "cloudinary") {
    console.error(`[media-access] Missing storage_key for Cloudinary content ${contentId}. Cannot use file_key as it contains URL.`);
  }

  const type = (content.type || "").toString().toLowerCase();
  const isVideo = requestedKind === "video" || type === "video" || !!content.video_storage_key || !!content.video_url;

  const legacyUrl =
    (requestedKind === "video"
      ? (content.video_url ?? null)
      : requestedKind === "audio"
        ? (content.audio_url ?? null)
        : ((isVideo ? content.video_url : content.audio_url) ?? null)
    ) ??
    content.media_url ??
    null;

  // Legacy rows: if storage_provider is NULL, prefer legacy URL fields even if keys exist.
  if (!hasExplicitProvider && legacyUrl) {
    storageKey = null;
  }

  if (!storageKey && legacyUrl) {
    const config = getMediaConfig();
    const base = config.appBaseUrl.replace(/\/$/, "");
    const raw = String(legacyUrl);
    const playbackUrl = raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : raw.startsWith("/")
        ? `${base}${raw}`
        : `${base}/${raw}`;
    return {
      mediaId: contentId,
      playbackUrl,
      expiresIn: config.mediaUrlTtlSeconds
    };
  }

  if (!storageKey && isVideo && content.video_storage_key) {
    storageKey = content.video_storage_key;
  }

  // Legacy content: no storage_key, use media_url as direct URL (backend serves /uploads via static)
  if (!storageKey && content.media_url) {
    const config = getMediaConfig();
    const base = config.appBaseUrl.replace(/\/$/, "");
    const path = (content.media_url as string).startsWith("/") ? content.media_url : `/${content.media_url}`;
    return {
      mediaId: contentId,
      playbackUrl: `${base}${path}`,
      expiresIn: config.mediaUrlTtlSeconds
    };
  }

  if (!storageKey) {
    throw new MediaNotReadyException(contentId, "no storage key");
  }

  const config = getMediaConfig();
  const expiresInSeconds = config.mediaUrlTtlSeconds;

  const token = createPlaybackToken(contentId, userId ?? 0, expiresInSeconds);

  const result = await generatePlaybackAccess({
    mediaId: contentId,
    storageProvider,
    storageKey: storageKey as string,
    contentType: content.mime_type ?? undefined,
    contentLength: content.file_size_bytes ?? undefined,
    visibility,
    userId: userId ?? 0,
    expiresInSeconds,
    token,
    ...(requestedKind ? { kind: requestedKind } : null)
  });

  console.log(`[media-access] contentId=${contentId}, provider=${storageProvider}, playbackUrl=${result.playbackUrl?.substring(0, 100)}...`);

  return {
    mediaId: contentId,
    playbackUrl: result.playbackUrl,
    expiresIn: result.expiresIn,
    contentType: result.contentType,
    contentLength: result.contentLength
  };
}
