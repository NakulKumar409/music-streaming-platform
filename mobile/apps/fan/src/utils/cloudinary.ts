import { API_HOST_BASE_URL } from '../config/env';

export const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=max&w=800&q=80';

export function getOptimizedImageUrl(
  url: string | null | undefined,
  fallback: string = FALLBACK_ARTWORK
): string {
  if (!url || typeof url !== 'string') return fallback;
  let trimmed = url.trim();
  if (!trimmed) return fallback;

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

  // 4. Cloudinary optimization — ZERO-CROP policy
  // Never use c_fill or fixed square crops (e.g. w_300,h_300,c_fill).
  // Use c_limit with auto quality and format: c_limit resizes larger images to fit within 1000px
  // while strictly preserving the source aspect ratio and never cropping edges.
  if (trimmed.includes('res.cloudinary.com')) {
    const uploadMatch = trimmed.match(/\/upload\/([a-zA-Z0-9_,:-]+)\//);
    if (uploadMatch) {
      const segment = uploadMatch[1];
      if (!/^v\d+$/.test(segment) && !/^s--.+--$/.test(segment)) {
        return trimmed.replace(
          `/upload/${segment}/`,
          '/upload/c_limit,w_1000,q_auto,f_auto/'
        );
      }
    }
    return trimmed.replace('/upload/', '/upload/c_limit,w_1000,q_auto,f_auto/');
  }

  return trimmed;
}
