/**
 * Cloudinary delivery strategy. Section 22.3.
 * Generates signed playback URLs for Cloudinary media.
 * 
 * IMPORTANT: storageKey must be a valid Cloudinary public_id, NOT a full URL.
 * If storage_key contains a URL, the strategy will attempt to extract the public_id,
 * but this should be avoided at the database level.
 */

import type { IMediaDeliveryStrategy } from "../interfaces/media-delivery-strategy.interface";
import type { GeneratePlaybackAccessParams, PlaybackAccessResult } from "../interfaces/media-delivery-strategy.interface";
import { DeliveryFailedException } from "../../exceptions/delivery.exception";
import { MediaProviderFactory } from "../../../services/providers/MediaProviderFactory";
import { normalizePublicId, isValidPublicId, logPublicIdNormalization } from "../../utils/cloudinary.utils";

export class CloudinaryDeliveryStrategy implements IMediaDeliveryStrategy {
  async generatePlaybackAccess(params: GeneratePlaybackAccessParams): Promise<PlaybackAccessResult> {
    const { storageKey, contentType, contentLength, expiresInSeconds } = params;

    try {
      if (!storageKey) {
        throw new DeliveryFailedException("Storage key is required");
      }

      // CRITICAL: Normalize storageKey to valid public_id
      // This removes file extensions (.mp3, .mp4, .webp) and version prefixes (v123/)
      let publicId: string;
      try {
        publicId = normalizePublicId(storageKey);
        logPublicIdNormalization(storageKey, publicId, "cloudinary-delivery");
      } catch (normError: any) {
        console.error(`[cloudinary-delivery] Failed to normalize public_id:`, normError.message);
        throw new DeliveryFailedException(`Invalid storage key: ${normError.message}`);
      }

      // Validate the normalized public_id
      if (!isValidPublicId(publicId)) {
        console.error(`[cloudinary-delivery] Invalid public_id after normalization: ${publicId}`);
        throw new DeliveryFailedException("Invalid public_id format after normalization");
      }
      
      // Get the Cloudinary provider from the MediaProviderFactory
      const provider = MediaProviderFactory.getProvider();
      
      // Determine file type from contentType
      const fileType: "audio" | "video" = contentType?.startsWith("audio/") ? "audio" : "video";
      
      console.log(`[cloudinary-delivery] Using publicId=${publicId}, fileType=${fileType}`);
      
      // Generate signed playback URL using the normalized publicId
      const result = await provider.generateSignedPlaybackUrl(publicId, fileType);
      
      console.log(`[cloudinary-delivery] Generated playbackUrl=${result.playbackUrl.substring(0, 80)}...`);
      
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
