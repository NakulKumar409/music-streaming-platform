export interface UploadResult {
  providerAssetId: string;
  fileKey: string;
  url?: string;
  metadata?: any;
}

export interface PlayerUrlResult {
  playbackUrl: string;
  expiryTime: number; // UNIX timestamp
  mediaType: string;
}

import type { VideoQuality } from '../../../shared/delivery/interfaces/media-delivery-strategy.interface';

export interface MediaProvider {
  /**
   * Initialize and perform the raw file upload to the provider
   * @param filePath Local path to the temporary file
   * @param artistId Used to partition the storage bucket/folder
   * @param mediaId A unique identifier to name the file safely
   * @param fileType "audio" | "video" | "thumbnail"
   */
  uploadFile(
    filePath: string,
    artistId: string | number,
    mediaId: string | number,
    fileType: "audio" | "video" | "thumbnail"
  ): Promise<UploadResult>;

  /**
   * Generate a secure, short-lived playback URL directly to the CDN cache or secure stream.
   * @param providerAssetId Provider-specific tracking identifier (e.g. public_id)
   * @param fileType "audio" | "video"
   */
  generateSignedPlaybackUrl(
    providerAssetId: string,
    fileType: "audio" | "video",
    quality?: VideoQuality
  ): Promise<PlayerUrlResult>;

  generatePublicAssetUrl?(
    providerAssetId: string,
    fileType: "thumbnail"
  ): string;

  /**
   * Perform deletion on the provider.
   */
  deleteFile(providerAssetId: string): Promise<boolean>;
}
