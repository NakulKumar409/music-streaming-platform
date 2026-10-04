import { API_HOST_BASE_URL } from '../config/env';

export const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80';

export function getOptimizedImageUrl(
  url: string | null | undefined,
  fallback: string = FALLBACK_ARTWORK
): string {
  if (!url || typeof url !== 'string') return fallback;
  let trimmed = url.trim();
  if (!trimmed) return fallback;

  // 1. Replace localhost / 127.0.0.1 / 10.0.2.2 / 192.168.* with active API base URL
  if (
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
    // 2. Relative URLs (/api/v1/...)
    trimmed = `${API_HOST_BASE_URL.replace(/\/+$/, '')}${trimmed}`;
  }

  // 3. Cloudinary optimization
  if (trimmed.includes('res.cloudinary.com')) {
    return trimmed.replace('/upload/', '/upload/w_300,h_300,c_fill,q_auto,f_auto/');
  }

  return trimmed;
}
