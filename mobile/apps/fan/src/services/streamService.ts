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
  code?: string;
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

export function validatePlaybackUrl(url: string, kind?: "audio" | "video"): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const lowerPath = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();
  const isTokenizedPrivateStream = lowerPath.includes("/media/stream/") && search.includes("token=");
  if (isTokenizedPrivateStream) {
    if (!kind) return true;
    // Enforce stream kind when caller knows expected media type.
    return search.includes(`kind=${kind}`);
  }

  if (kind === "video") {
    return lowerPath.endsWith(".m3u8") || lowerPath.endsWith(".mp4") || lowerPath.includes("/video/");
  }

  if (kind === "audio") {
    return (
      lowerPath.endsWith(".mp3") ||
      lowerPath.endsWith(".m4a") ||
      lowerPath.endsWith(".wav") ||
      lowerPath.includes("/video/")
    );
  }

  return true;
}

export type VideoQuality = '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | 'Auto' | 'SD' | 'HD';

export async function getPlaybackUrl(contentId: string, kind?: 'audio' | 'video', quality?: VideoQuality, allowPreview?: boolean): Promise<string> {
  const res = await apiV1.post<StreamAccessResponse>('/stream/access', {
    contentId: Number(contentId),
    kind,
    quality,
    allowPreview,
  });
  const data = res.data;
  if (!data?.success || !data?.playbackUrl) {
    throw new Error(data?.message || 'Failed to get playback URL');
  }
  const normalized = normalizePlaybackUrl(data.playbackUrl);
  if (!validatePlaybackUrl(normalized, kind)) {
    throw new Error(data?.message || "Received invalid playback URL");
  }
  return normalized;
}
