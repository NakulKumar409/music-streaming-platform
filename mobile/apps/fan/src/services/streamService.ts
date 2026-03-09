/**
 * Requests short-lived playback URL from backend (MediaAccessService).
 * Used when content has useStreamAccess (provider-neutral storage).
 */

import { apiV1 } from './api';
import Constants from 'expo-constants';

export type StreamAccessResponse = {
  success: boolean;
  mediaId?: number;
  playbackUrl?: string;
  expiresIn?: number;
  contentType?: string;
  contentLength?: number;
  message?: string;
};

function getDevHost(): string | null {
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ??
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any)?.manifest?.debuggerHost ??
    null;

  if (!hostUri || typeof hostUri !== 'string') return null;
  return hostUri.split(':')[0] || null;
}

export function normalizePlaybackUrl(url: string): string {
  if (!url) return url;

  // iOS simulator/device cannot reach your laptop via localhost.
  // Replace only in dev to avoid surprising production behavior.
  if (process.env.NODE_ENV === 'production') return url;

  if (!/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/i.test(url)) return url;
  const host = getDevHost();
  if (!host) return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/i, (m) => {
    const portMatch = m.match(/:(\d+)$/);
    const port = portMatch ? `:${portMatch[1]}` : '';
    const scheme = url.startsWith('https://') ? 'https://' : 'http://';
    return `${scheme}${host}${port}`;
  });
}

export async function getPlaybackUrl(contentId: string, kind?: 'audio' | 'video'): Promise<string> {
  const res = await apiV1.post<StreamAccessResponse>('/stream/access', {
    contentId: Number(contentId),
    kind,
  });
  const data = res.data;
  if (!data?.success || !data?.playbackUrl) {
    throw new Error(data?.message || 'Failed to get playback URL');
  }
  return normalizePlaybackUrl(data.playbackUrl);
}
