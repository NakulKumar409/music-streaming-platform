/**
 * Delivery strategy contract. Section 8.
 * Responsible for generating playable response; not for upload/DB.
 */

export type VisibilityType = "PUBLIC" | "PROTECTED" | "PRIVATE_INTERNAL";

/**
 * Supported video quality options.
 */
export type VideoQuality = '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | 'Auto' | 'SD' | 'HD';

export interface GeneratePlaybackAccessParams {
  mediaId: number;
  storageProvider: string;
  storageKey: string;
  providerAssetId?: string;
  kind?: "audio" | "video";
  contentType?: string;
  contentLength?: number;
  visibility: VisibilityType;
  userId: number;
  expiresInSeconds: number;
  token: string;
  quality?: VideoQuality;
}

export interface PlaybackAccessResult {
  playbackUrl: string;
  expiresIn: number;
  contentType?: string;
  contentLength?: number;
}

export interface IMediaDeliveryStrategy {
  generatePlaybackAccess(params: GeneratePlaybackAccessParams): Promise<PlaybackAccessResult>;
}
