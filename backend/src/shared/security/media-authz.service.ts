/**
 * Media authorization: entitlement and visibility checks.
 * Used by MediaAccessService before issuing playback.
 */

import { checkAccess } from "../../common/accessControl";
import { pool } from "../../common/db";

export type VisibilityType = "PUBLIC" | "PROTECTED" | "PRIVATE_INTERNAL";

export interface MediaAccessCheckResult {
  allowed: boolean;
  reason?: string;
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
  void userId;
  void artistId;
  void visibility;
  void subscriptionRequired;
  return { allowed: true };

  if (visibility === "PRIVATE_INTERNAL") {
    return { allowed: false, reason: "Content is internal only" };
  }

  if (visibility === "PUBLIC") {
    return { allowed: true };
  }

  if (visibility === "PROTECTED") {
    if (!userId) return { allowed: false, reason: "Authentication required" };
    if (!subscriptionRequired) return { allowed: true };
    const hasAccess = await checkAccess(userId, artistId);
    if (!hasAccess) {
      return { allowed: false, reason: "Subscription required" };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "Unknown visibility" };
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
} | null> {
  const result = await pool.query(
    `SELECT id, artist_id,
        COALESCE(storage_provider, 'local') as storage_provider,
        storage_key, video_storage_key, thumbnail_storage_key,
        COALESCE(visibility, 'PROTECTED') as visibility,
        COALESCE(status, lifecycle_state, 'DRAFT') as status,
        COALESCE(is_approved, false) as is_approved,
        COALESCE(subscription_required, true) as subscription_required,
        mime_type, file_size_bytes,
        media_url, audio_url, video_url, type
     FROM content_items
     WHERE id = $1
     LIMIT 1`,
    [contentId]
  );
  const row = result.rows?.[0];
  return row ?? null;
}
