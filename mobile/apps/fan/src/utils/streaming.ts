/**
 * Utility for parsing signed streaming URLs and extracting metadata like token expiry.
 */

import logger from './logger';

export const decodeJwtExpMsFromUrl = (url: string | null): number | null => {
  if (!url) return null;
  try {
    const tokenMatch = url.match(/[?&]token=([^&]+)/i);
    if (!tokenMatch?.[1]) return null;
    const token = decodeURIComponent(tokenMatch[1]);
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payloadB64.length % 4;
    const padded = payloadB64 + (pad ? '='.repeat(4 - pad) : '');

    // React Native's global.atob is usually available, or use a fallback
    const json = global.atob(padded);
    const payload = JSON.parse(json);
    const expSec = Number(payload?.exp ?? 0);

    if (!Number.isFinite(expSec) || expSec <= 0) return null;
    return expSec * 1000;
  } catch (e) {
    logger.warn('[StreamingUtils] Failed to decode JWT expiration from URL', e);
    return null;
  }
};

/**
 * Checks if a streaming URL is about to expire.
 * @param url The URL to check.
 * @param bufferSeconds Buffer time before actual expiry (default 30s).
 */
export const isStreamingUrlExpiringSoon = (url: string | null, bufferSeconds = 30): boolean => {
  const expMs = decodeJwtExpMsFromUrl(url);
  if (!expMs) return false;

  const now = Date.now();
  return now + bufferSeconds * 1000 >= expMs;
};
