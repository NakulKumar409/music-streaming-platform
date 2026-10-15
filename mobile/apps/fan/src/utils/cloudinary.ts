import { API_HOST_BASE_URL } from '../config/env';

export const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=max&w=800&q=80';

export function getOptimizedImageUrl(
  url: string | null | undefined,
  fallback: string = FALLBACK_ARTWORK,
  type: 'song' | 'artist' | 'banner' | 'video' = 'song'
): string {
  if (!url || typeof url !== 'string') return fallback;
  let trimmed = url.trim();
  if (!trimmed) return fallback;

  // 0. Detect incomplete or directory-like URLs (e.g. /v1/artists/94/images/)
  if (/\/images\/?$/.test(trimmed) || /\/artists\/\d+\/?$/.test(trimmed)) {
    return fallback;
  }

  // 1. Rewrite any URL that targets /api/v1/ to use active API_HOST_BASE_URL
  const apiV1Index = trimmed.indexOf('/api/v1/');
  if (apiV1Index !== -1) {
    const path = trimmed.substring(apiV1Index);
    trimmed = `${API_HOST_BASE_URL.replace(/\/+$/, '')}${path}`;
  } else if (
    trimmed.startsWith('http://localhost') ||
    trimmed.startsWith('http://127.0.0.1') ||
    trimmed.startsWith('http://10.0.2.2') ||
    trimmed.startsWith('http://192.168.')
  ) {
    const pathIndex = trimmed.indexOf('/', 8);
    if (pathIndex !== -1) {
      const path = trimmed.substring(pathIndex);
      trimmed = `${API_HOST_BASE_URL.replace(/\/+$/, '')}${path}`;
    }
  } else if (trimmed.startsWith('/')) {
    // 2. Relative URLs (/...)
    trimmed = `${API_HOST_BASE_URL.replace(/\/+$/, '')}${trimmed}`;
  }

  // 3. Upgrade any remote http:// to https:// (Android cleartext traffic rejection policy)
  if (trimmed.startsWith('http://')) {
    const isLocal =
      trimmed.startsWith('http://localhost') ||
      trimmed.startsWith('http://127.0.0.1') ||
      trimmed.startsWith('http://10.0.2.2') ||
      trimmed.startsWith('http://192.168.');
    if (!isLocal) {
      trimmed = `https://${trimmed.slice(7)}`;
    }
  }

  // 4. Cloudinary optimization — Smart Letterbox-Stripping & Content-Aware Framing
  // Embedded black bars from 4:3 YouTube frames (640x480 with 60px black bars)
  // are stripped using c_crop,ar_16:9,g_center, then fitted to the target card shape.
  if (trimmed.includes('res.cloudinary.com')) {
    const transform =
      type === 'video'
        ? 'c_crop,ar_16:9,g_center/c_fill,ar_16:9,w_800,q_auto,f_auto'
        : type === 'banner'
        ? 'c_crop,ar_16:9,g_center/c_fill,ar_16:9,w_1200,q_auto,f_auto'
        : 'c_crop,ar_16:9,g_center/c_fill,ar_1:1,g_auto,w_600,q_auto,f_auto';

    const uploadMatch = trimmed.match(/\/upload\/([a-zA-Z0-9_,:-]+)\//);
    if (uploadMatch) {
      const segment = uploadMatch[1];
      if (!/^v\d+$/.test(segment) && !/^s--.+--$/.test(segment)) {
        return trimmed.replace(
          `/upload/${segment}/`,
          `/upload/${transform}/`
        );
      }
    }
    return trimmed.replace('/upload/', `/upload/${transform}/`);
  }

  return trimmed;
}
