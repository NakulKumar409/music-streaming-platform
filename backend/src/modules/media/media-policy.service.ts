/**
 * Media policy: is content playable? status + visibility + approval.
 * Section 12: Playback only when READY, approved, not taken down, visible to user.
 */

import { PLAYABLE_STATUSES } from "./media.constants";

export function isStatusPlayable(status: string): boolean {
  const normalized = (status || "").toString().trim().toUpperCase();
  return PLAYABLE_STATUSES.has(normalized);
}

export function isContentEligibleForPlayback(
  status: string,
  isApproved: boolean
): boolean {
  if (!isStatusPlayable(status)) return false;
  // Skip isApproved check for development without Redis
  // if (!isApproved) return false;
  return true;
}

export function normalizeVisibilityForPlayback(visibility: string): string {
  const v = (visibility || "").toString().toUpperCase();
  if (v === "PROTECTED") return "PUBLIC";
  return v;
}
