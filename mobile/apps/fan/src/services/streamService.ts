/**
 * Requests short-lived playback URL from backend (MediaAccessService).
 * Used when content has useStreamAccess (provider-neutral storage).
 */

import { apiV1 } from './api';

export type StreamAccessResponse = {
  success: boolean;
  mediaId?: number;
  playbackUrl?: string;
  expiresIn?: number;
  contentType?: string;
  contentLength?: number;
  message?: string;
};

export async function getPlaybackUrl(contentId: string, kind?: 'audio' | 'video'): Promise<string> {
  const res = await apiV1.post<StreamAccessResponse>('/stream/access', {
    contentId: Number(contentId),
    kind,
  });
  const data = res.data;
  if (!data?.success || !data?.playbackUrl) {
    throw new Error(data?.message || 'Failed to get playback URL');
  }
  return data.playbackUrl;
}
