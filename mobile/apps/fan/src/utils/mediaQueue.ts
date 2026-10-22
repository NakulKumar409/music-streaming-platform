import type { MediaItem } from "../media.types";

type MediaIdentity = {
  id?: string | number | null;
  contentId?: string | number | null;
};

function normalizedIds(value: MediaIdentity): string[] {
  return [value.id, value.contentId]
    .filter((entry): entry is string | number => entry !== null && entry !== undefined)
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

export function isSameMediaIdentity(
  left: MediaIdentity,
  right: MediaIdentity
): boolean {
  const leftIds = normalizedIds(left);
  const rightIds = new Set(normalizedIds(right));
  return leftIds.some((id) => rightIds.has(id));
}

export function findMediaQueueIndex(
  queue: MediaItem[],
  target: MediaIdentity
): number {
  return queue.findIndex((item) => isSameMediaIdentity(item, target));
}
