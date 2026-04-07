/**
 * Media authorization: entitlement and visibility checks.
 * Used by MediaAccessService before issuing playback.
 */

import { checkAccess } from "../../common/accessControl";
import { pool } from "../../common/db";
import { logger } from "../../common/logger";

export type VisibilityType = "PUBLIC" | "PROTECTED" | "PRIVATE_INTERNAL";

export interface MediaAccessCheckResult {
  allowed: boolean;
  reason?: string;
  tier?: 'FREE' | 'ARTIST' | 'PLATFORM';
}

/**
 * Check if user has a platform-wide subscription (HD access)
 */
export async function checkPlatformAccess(userId: number | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const result = await pool.query(
      `SELECT id FROM subscriptions 
       WHERE user_id = $1 
         AND type = 'PLATFORM' 
         AND UPPER(COALESCE(status, '')) IN ('ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'GRACE')
         AND (COALESCE(grace_ends_at, next_billing_date) IS NULL OR COALESCE(grace_ends_at, next_billing_date) > now())
       LIMIT 1`,
      [userId]
    );
    return Boolean(result.rows?.length);
  } catch {
    return false;
  }
}

/**
 * Validate requested quality against user's subscription level.
 * HD (High Quality) is reserved for PLATFORM subscribers.
 * SD (Standard Quality) is available to all authorized users.
 */
export async function validateQualityAccess(
  userId: number | null,
  requestedQuality?: string
): Promise<{ authorized: boolean; quality: 'SD' | 'HD' }> {
  const isHD = (requestedQuality || "").toString().toUpperCase() === "HD";
  
  // If user didn't request HD, allow SD by default.
  if (!isHD) {
    return { authorized: true, quality: "SD" };
  }

  // If user requested HD, check for PLATFORM subscription.
  const isPlatform = await checkPlatformAccess(userId);
  if (isPlatform) {
    return { authorized: true, quality: "HD" };
  }

  // Unauthorized person or Free user requesting HD.
  return { authorized: false, quality: "SD" };
}

/**
 * Check if user is allowed to play this content based on subscription and visibility.
 */
export async function checkMediaEntitlement(
  userId: number | null,
  artistId: number,
  visibility: VisibilityType,
  subscriptionRequired: boolean
): Promise<MediaAccessCheckResult> {
  if (visibility === "PRIVATE_INTERNAL") {
    return { allowed: false, reason: "Content is internal only", tier: 'FREE' };
  }

  if (visibility === "PUBLIC") {
    const isPlatform = await checkPlatformAccess(userId);
    return { allowed: true, tier: isPlatform ? 'PLATFORM' : 'FREE' };
  }

  if (visibility === "PROTECTED") {
    if (!userId) {
      logger.warn({ artistId, visibility }, "[AUTHZ] Access denied: Authentication required for PROTECTED content");
      return { allowed: false, reason: "Authentication required", tier: 'FREE' };
    }
    
    const isPlatform = await checkPlatformAccess(userId);
    if (isPlatform) return { allowed: true, tier: 'PLATFORM' };

    if (!subscriptionRequired) return { allowed: true, tier: 'FREE' };

    const hasArtistAccess = await checkAccess(userId, artistId);
    if (!hasArtistAccess) {
      logger.info({ userId, artistId, tier: 'FREE' }, "[AUTHZ] Access denied: Subscription required");
      return { allowed: false, reason: "Subscription required", tier: 'FREE' };
    }
    return { allowed: true, tier: 'ARTIST' };
  }

  return { allowed: false, reason: "Unknown visibility", tier: 'FREE' };
}

/**
 * Load content row for access check. Returns storage_key, storage_provider, visibility, status, etc.
 */
export async function getContentForAccess(contentId: number): Promise<{
  id: number;
  artist_id: number;
  storage_provider: string | null;
  storage_key: string | null;
  video_storage_key: string | null;
  thumbnail_storage_key: string | null;
  provider_asset_id: string | null;
  audio_provider_asset_id: string | null;
  video_provider_asset_id: string | null;
  thumbnail_provider_asset_id: string | null;
  visibility: string;
  status: string;
  is_approved: boolean;
  subscription_required: boolean;
  mime_type: string | null;
  file_size_bytes: number | null;
  media_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  type?: string;
  file_key?: string | null;
  thumbnail_url?: string | null;
} | null> {
  try {
    const result = await pool.query(
      `SELECT id, artist_id,
          COALESCE(storage_provider, 'local') as storage_provider,
          storage_key, video_storage_key, thumbnail_storage_key,
          provider_asset_id, audio_provider_asset_id, video_provider_asset_id, thumbnail_provider_asset_id,
          COALESCE(visibility, 'PROTECTED') as visibility,
          COALESCE(status, lifecycle_state, 'DRAFT') as status,
          COALESCE(is_approved, false) as is_approved,
          COALESCE(subscription_required, true) as subscription_required,
          mime_type, file_size_bytes,
          media_url, audio_url, video_url, type,
          file_key, thumbnail_url
       FROM content_items
       WHERE id = $1
       LIMIT 1`,
      [contentId]
    );
    const row = result.rows?.[0];
    return row ?? null;
  } catch (err: any) {
    if (err?.code === '42703') {
      // Fallback if status or is_approved columns are missing
      const result = await pool.query(
        `SELECT id, artist_id,
            COALESCE(storage_provider, 'local') as storage_provider,
            storage_key, video_storage_key, thumbnail_storage_key,
            COALESCE(visibility, 'PROTECTED') as visibility,
            mime_type, file_size_bytes,
            media_url, audio_url, video_url, type,
            file_key, thumbnail_url
         FROM content_items
         WHERE id = $1
         LIMIT 1`,
        [contentId]
      );
      const row = result.rows?.[0];
      if (!row) return null;
      return {
        ...row,
        provider_asset_id: null,
        audio_provider_asset_id: null,
        video_provider_asset_id: null,
        thumbnail_provider_asset_id: null,
        status: (row as any).lifecycle_state || 'READY',
        is_approved: true,
        subscription_required: false
      } as any;
    }
    throw err;
  }
}
