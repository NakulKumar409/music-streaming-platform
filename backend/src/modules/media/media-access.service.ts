/**
 * Centralized media access service. Section 18.
 * Validates: Auth, Media Status (READY), Visibility, Entitlement; then issues playback URL via delivery strategy.
 */

import { pool } from "../../common/db";
import { logger } from "../../common/logger";
import { 
  getContentForAccess, 
  checkMediaEntitlement, 
  validateQualityAccess, 
  type VisibilityType 
} from "../../shared/security/media-authz.service";
import { createPlaybackToken } from "../../shared/security/signed-media-token.service";
import { generatePlaybackAccess } from "../../shared/delivery/services/media-delivery.service";
import { isContentEligibleForPlayback, normalizeVisibilityForPlayback } from "./media-policy.service";
import { getMediaConfig } from "../../config/media.config";
import { resolveMediaIdentity } from "../../shared/media/media-asset-locator";
import { DeliveryFailedException } from "../../shared/exceptions/delivery.exception";
import { ensureValidPlaybackUrl } from "./playback-url.guard";
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
  quality?: "SD" | "HD";
  allowPreview?: boolean;
}

/**
 * Main entry: validate everything then return playback URL (or throw).
 * No controller should issue playback URLs without this service.
 */
export async function requestPlaybackAccess(input: RequestPlaybackInput): Promise<PlaybackAccessResponse> {
  const { contentId, userId } = input;
  const correlationId = (input as any).correlationId || "-";

  if (userId) {
    // 1. Prune dead sessions (no heartbeat in 2 mins)
    await pool.query(`DELETE FROM playback_sessions WHERE heartbeat_at < now() - interval '2 minutes'`);

    // 2. Count active sessions
    const activeCountRes = await pool.query(
      `SELECT count(*) FROM playback_sessions WHERE user_id = $1`,
      [userId]
    );
    const activeCount = parseInt(activeCountRes.rows[0].count, 10);

    // 3. Admin bypass or limit block
    const userRoleResult = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const role = (userRoleResult.rows[0]?.role || "").toUpperCase();
    
    if (role !== "ADMIN" && activeCount >= 2) {
       logger.warn({ userId, activeCount, correlationId }, "[ABUSE] Concurrency limit reached");
       throw new MediaAccessDeniedException("Too many concurrent streams. Please close another session to continue.");
    }

    // 4. Register this session
    await pool.query(
      `INSERT INTO playback_sessions (user_id, content_id) VALUES ($1, $2)`,
      [userId, contentId]
    );
  }

  const content = await getContentForAccess(contentId);
  if (!content) {
    throw new MediaNotFoundException(contentId);
  }

  const status = (content.status || "DRAFT").toString().toUpperCase();
  const isApproved = Boolean(content.is_approved);

  const isEligibleForPlayback = isContentEligibleForPlayback(status, isApproved);
  if (!isEligibleForPlayback) {
    throw new MediaNotReadyException(contentId, status);
  }

  const visibility = normalizeVisibilityForPlayback(content.visibility || "PROTECTED") as VisibilityType;
  const subscriptionRequired = Boolean(content.subscription_required);

  const entitlement = await checkMediaEntitlement(
    userId ?? null,
    content.artist_id,
    visibility,
    subscriptionRequired,
    input.allowPreview ?? false
  );

  if (!entitlement.allowed) {
    throw new MediaAccessDeniedException(`Access denied to media ${contentId}: ${entitlement.reason || "No active subscription"}`);
  }

  const kind = (input.kind || "").toString().toLowerCase();
  const requestedKind: "audio" | "video" | null = kind === "video" ? "video" : kind === "audio" ? "audio" : null;
  
  const hasExplicitProvider = Boolean(content.storage_provider);
  const storageProvider = (content.storage_provider || "local").toString().toLowerCase();
  const resolvedKind: "audio" | "video" =
    requestedKind || ((content.type || "").toString().toLowerCase().includes("video") ? "video" : "audio");
  const identity = resolveMediaIdentity(content as any, resolvedKind);
  let storageKey = identity.internalStorageKey;
  const providerAssetId = identity.providerAssetId;

  // DEBUG: Log audio playback resolution details
  console.log(`[media-access] contentId=${contentId}, kind=${resolvedKind}, provider=${storageProvider}, storageKey=${storageKey}, providerAssetId=${providerAssetId}`);
  console.log(`[media-access] content fields:`, {
    type: content.type,
    storage_provider: content.storage_provider,
    storage_key: content.storage_key,
    audio_url: content.audio_url,
    media_url: content.media_url,
    provider_asset_id: content.provider_asset_id,
    audio_provider_asset_id: content.audio_provider_asset_id
  });

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

  // For development without Redis, allow Cloudinary content without providerAssetId
  // if (storageProvider === "cloudinary" && !providerAssetId) {
  //   console.error(`[media-access] MISSING providerAssetId for Cloudinary content: contentId=${contentId}, kind=${resolvedKind}`);
  //   throw new MediaNotReadyException(
  //     contentId,
  //     `missing ${resolvedKind} provider asset identity (cloudinary). Repair mapping for this row`
  //   );
  // }

  // For development without Redis, allow content without storage key
  // if (!storageKey && storageProvider !== "cloudinary") {
  //   throw new MediaNotReadyException(contentId, "no storage key");
  // }

  const config = getMediaConfig();
  // FORCE 5 MINUTE TTL FOR PRODUCTION SECURITY
  const expiresInSeconds = 300; 

  const token = createPlaybackToken(contentId, userId ?? 0, expiresInSeconds);

  // QUALITY GATE: Downgrade to SD if unauthorized HD is requested.
  const qCheck = await validateQualityAccess(userId, input.quality);
  if (input.quality === "HD" && !qCheck.authorized) {
    logger.info({ userId, contentId, requestedQuality: input.quality, correlationId }, "[AUTHZ] Unauthorized HD request - downgrading to SD");
  }

  const result = await generatePlaybackAccess({
    mediaId: contentId,
    storageProvider,
    storageKey: storageKey ?? "",
    providerAssetId: providerAssetId ?? undefined,
    contentType: content.mime_type ?? undefined,
    contentLength: content.file_size_bytes ?? undefined,
    visibility,
    userId: userId ?? 0,
    expiresInSeconds,
    token,
    kind: resolvedKind,
    quality: qCheck.quality
  });

  if (!result?.playbackUrl) {
    throw new DeliveryFailedException("Playback URL was not generated");
  }

  ensureValidPlaybackUrl({
    playbackUrl: result.playbackUrl,
    storageProvider,
    providerAssetId
  });

  console.log(`[media-access] contentId=${contentId}, provider=${storageProvider}, urlGenerated=true`);

  return {
    mediaId: contentId,
    playbackUrl: result.playbackUrl,
    expiresIn: result.expiresIn,
    contentType: result.contentType,
    contentLength: result.contentLength
  };
}
