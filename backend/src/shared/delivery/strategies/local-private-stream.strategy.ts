/**
 * Local private stream delivery. Section 22.1.
 * Returns backend route /media/stream/:mediaId?token=...
 * Actual streaming with Range support is handled by the stream route.
 */

import type { IMediaDeliveryStrategy } from "../interfaces/media-delivery-strategy.interface";
import type { GeneratePlaybackAccessParams, PlaybackAccessResult } from "../interfaces/media-delivery-strategy.interface";
import { getMediaConfig } from "../../../config/media.config";

export class LocalPrivateStreamStrategy implements IMediaDeliveryStrategy {
  async generatePlaybackAccess(params: GeneratePlaybackAccessParams): Promise<PlaybackAccessResult> {
    const { mediaId, expiresInSeconds, token } = params;
    const config = getMediaConfig();
    const baseUrl = config.appBaseUrl.replace(/\/$/, "");
    const route = config.localPrivateStreamRoute.replace(/^\//, "");
    const kind = (params as any)?.kind ? String((params as any).kind) : null;
    const qs = kind
      ? `token=${encodeURIComponent(token)}&kind=${encodeURIComponent(kind)}`
      : `token=${encodeURIComponent(token)}`;
    const playbackUrl = `${baseUrl}/${route}/${mediaId}?${qs}`;
    return {
      playbackUrl,
      expiresIn: expiresInSeconds
    };
  }
}
