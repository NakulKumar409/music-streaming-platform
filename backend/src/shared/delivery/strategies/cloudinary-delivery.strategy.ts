/**
 * Cloudinary delivery strategy. Section 22.3.
 * Generates signed playback URLs for Cloudinary media.
 */

import type { IMediaDeliveryStrategy } from "../interfaces/media-delivery-strategy.interface";
import type { GeneratePlaybackAccessParams, PlaybackAccessResult } from "../interfaces/media-delivery-strategy.interface";
import { DeliveryFailedException } from "../../exceptions/delivery.exception";
import { MediaProviderFactory } from "../../../services/providers/MediaProviderFactory";

export class CloudinaryDeliveryStrategy implements IMediaDeliveryStrategy {
  async generatePlaybackAccess(params: GeneratePlaybackAccessParams): Promise<PlaybackAccessResult> {
    const { storageKey, contentType, contentLength, expiresInSeconds } = params;

    try {
      // Get the Cloudinary provider from the MediaProviderFactory
      const provider = MediaProviderFactory.getProvider();
      
      // Determine file type from contentType
      const fileType: "audio" | "video" = contentType?.startsWith("audio/") ? "audio" : "video";
      
      // Generate signed playback URL
      const result = await provider.generateSignedPlaybackUrl(storageKey, fileType);
      
      return {
        playbackUrl: result.playbackUrl,
        expiresIn: expiresInSeconds ?? 300,
        contentType,
        contentLength
      };
    } catch (err: any) {
      throw new DeliveryFailedException(err?.message || "Cloudinary signed URL generation failed");
    }
  }
}
