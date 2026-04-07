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
    const kind = params.kind ? String(params.kind) : null;
    let qs = `token=${encodeURIComponent(token)}`;
    if (kind) qs += `&kind=${encodeURIComponent(kind)}`;
    if (params.quality) qs += `&quality=${encodeURIComponent(params.quality)}`;
    
    const playbackUrl = `${baseUrl}/${route}/${mediaId}?${qs}`;
    return {
      playbackUrl,
      expiresIn: expiresInSeconds
    };
  }
}
