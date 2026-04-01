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
      
      console.log(`[cloudinary-delivery] storageKey=${storageKey}, fileType=${fileType}, contentType=${contentType}`);
      
      // Strip file extension from storageKey - Cloudinary public_id doesn't include it
      const publicId = storageKey.replace(/\.[^/.]+$/, "");
      
      // Generate signed playback URL
      const result = await provider.generateSignedPlaybackUrl(publicId, fileType);
      
      console.log(`[cloudinary-delivery] generated playbackUrl=${result.playbackUrl?.substring(0, 100)}...`);
      
      return {
        playbackUrl: result.playbackUrl,
        expiresIn: expiresInSeconds ?? 300,
        contentType,
        contentLength
      };
    } catch (err: any) {
      console.error(`[cloudinary-delivery] error:`, err);
      throw new DeliveryFailedException(err?.message || "Cloudinary signed URL generation failed");
    }
  }
}
