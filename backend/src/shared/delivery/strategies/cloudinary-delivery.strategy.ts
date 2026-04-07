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
import { normalizePublicId, isValidPublicId, logPublicIdNormalization } from "../../utils/cloudinary.utils";

interface CloudinaryPlaybackSigner {
  generateSignedPlaybackUrl(providerAssetId: string, fileType: "audio" | "video", quality?: "SD" | "HD"): Promise<{ playbackUrl: string }>;
}

export class CloudinaryDeliveryStrategy implements IMediaDeliveryStrategy {
  constructor(
    private readonly provider?: CloudinaryPlaybackSigner
  ) {}

  async generatePlaybackAccess(params: GeneratePlaybackAccessParams): Promise<PlaybackAccessResult> {
    const { providerAssetId, contentType, contentLength, expiresInSeconds, kind } = params;

    try {
      if (!providerAssetId) {
        throw new DeliveryFailedException("Cloudinary providerAssetId is required");
      }

      // CRITICAL: Normalize providerAssetId to valid public_id
      // This removes file extensions (.mp3, .mp4, .webp) and version prefixes (v123/)
      let publicId: string;
      try {
        publicId = normalizePublicId(providerAssetId);
        logPublicIdNormalization(providerAssetId, publicId, "cloudinary-delivery");
      } catch (normError: any) {
        console.error(`[cloudinary-delivery] Failed to normalize public_id:`, normError.message);
        throw new DeliveryFailedException(`Invalid provider asset identity: ${normError.message}`);
      }

      // Validate the normalized public_id
      if (!isValidPublicId(publicId)) {
        console.error(`[cloudinary-delivery] Invalid public_id after normalization: ${publicId}`);
        throw new DeliveryFailedException("Invalid public_id format after normalization");
      }
      
      // Determine file type from contentType
      const fileType: "audio" | "video" = kind || (contentType?.startsWith("audio/") ? "audio" : "video");
      
      console.log(`[cloudinary-delivery] Using publicId=${publicId}, fileType=${fileType}`);

      let signer = this.provider;
      if (!signer) {
        const cloudinaryModule = await import("../../../services/providers/CloudinaryProvider");
        signer = new cloudinaryModule.CloudinaryProvider();
      }
      
      // Generate signed playback URL using the normalized publicId
      const result = await signer.generateSignedPlaybackUrl(publicId, fileType, params.quality);
      
      console.log(`[cloudinary-delivery] URL generated for publicId=${publicId}`);
      
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
