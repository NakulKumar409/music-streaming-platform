/**
 * Delivery strategy contract. Section 8.
 * Responsible for generating playable response; not for upload/DB.
 */

export type VisibilityType = "PUBLIC" | "PROTECTED" | "PRIVATE_INTERNAL";

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
  quality?: 'SD' | 'HD';
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
