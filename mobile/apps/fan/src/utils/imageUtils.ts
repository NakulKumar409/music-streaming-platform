import { API_HOST_BASE_URL } from '../config/env';
import { getOptimizedImageUrl } from './cloudinary';

export const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80';

export const FALLBACK_ARTIST_AVATAR =
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80';

export const FALLBACK_BANNER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1400&q=80';

/**
 * Resolves any image URL from backend/API:
 * 1. Rewrites localhost / 127.0.0.1 / 10.0.2.2 to current API_HOST_BASE_URL
 * 2. Prepends API_HOST_BASE_URL to relative paths (/api/v1/...)
 * 3. Applies Cloudinary optimization if applicable
 * 4. Falls back to curated high-quality fallback if empty
 */
export function resolveAppImageUrl(
  url: unknown,
  type: 'song' | 'artist' | 'banner' | 'video' = 'song'
): string {
  const fallback =
    type === 'artist'
      ? FALLBACK_ARTIST_AVATAR
      : type === 'banner'
      ? FALLBACK_BANNER
      : FALLBACK_ARTWORK;

  if (!url || typeof url !== 'string') {
    if (url && typeof url === 'object' && 'uri' in url) {
      return resolveAppImageUrl((url as any).uri, type);
    }
    return fallback;
  }

  const trimmed = url.trim();
  if (!trimmed) return fallback;

  return getOptimizedImageUrl(trimmed, fallback);
}
