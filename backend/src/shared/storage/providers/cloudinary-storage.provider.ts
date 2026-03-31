/**
 * Cloudinary storage provider adapter for the old storage system.
 * Wraps the new CloudinaryProvider to work with IStorageProvider interface.
 */

import * as fs from "fs";
import * as path from "path";
import type { IStorageProvider } from "../interfaces/storage-provider.interface";
import type {
  UploadObjectParams,
  UploadObjectResult,
  ObjectMetadata,
  OpenReadStreamParams,
  OpenReadStreamResult,
} from "../interfaces/storage-types.interface";
import { CloudinaryProvider } from "../../../services/providers/CloudinaryProvider";
import { StorageProviderNotConfiguredException } from "../../exceptions/storage.exception";

export class CloudinaryStorageProvider implements IStorageProvider {
  private provider: CloudinaryProvider;

  constructor() {
    // Verify required env vars
    const required = [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new StorageProviderNotConfiguredException(
        `cloudinary (missing: ${missing.join(", ")})`
      );
    }
    this.provider = new CloudinaryProvider();
    console.log("[Storage] Provider: cloudinary");
  }

  async upload(params: UploadObjectParams): Promise<UploadObjectResult> {
    const { storageKey, body, contentType } = params;
    // Write body to temp file since CloudinaryProvider expects a file path
    const tempDir = process.env.TEMP_DIR || "/tmp";
    const tempFile = path.join(tempDir, `cloudinary-upload-${Date.now()}`);
    
    if (Buffer.isBuffer(body)) {
      fs.writeFileSync(tempFile, body);
    } else {
      // Handle stream - this is simplified
      throw new Error("Stream upload not yet implemented for Cloudinary");
    }

    try {
      const fileType = this.inferFileType(contentType, storageKey);
      // Extract artistId and mediaId from storageKey (format: artists/{artistId}/media/{mediaId})
      const parts = storageKey.split("/");
      const artistId = parts[1] || "unknown";
      const mediaId = parts[3] || storageKey;
      
      const result = await this.provider.uploadFile(tempFile, artistId, mediaId, fileType);
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      return {
        storageKey: result.fileKey,
        etag: result.providerAssetId,
        sizeBytes: result.metadata?.bytes,
      };
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    // storageKey is the public_id for cloudinary
    await this.provider.deleteFile(storageKey);
  }

  async exists(storageKey: string): Promise<boolean> {
    // Cloudinary doesn't have a direct exists check, try to get metadata
    try {
      const metadata = await this.provider.generateSignedPlaybackUrl(storageKey, "video");
      return !!metadata;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(storageKey: string): Promise<ObjectMetadata | null> {
    try {
      const result = await this.provider.generateSignedPlaybackUrl(storageKey, "video");
      if (!result) return null;
      return {
        storageKey: storageKey,
        contentType: "video",
        contentLength: 0, // Cloudinary doesn't provide this directly
        lastModified: new Date(),
        etag: storageKey,
      };
    } catch {
      return null;
    }
  }

  async openReadStream?(params: OpenReadStreamParams): Promise<OpenReadStreamResult> {
    throw new Error("openReadStream not supported for Cloudinary - use signed URLs instead");
  }

  private inferFileType(
    contentType: string | undefined,
    storageKey: string
  ): "audio" | "video" | "thumbnail" {
    if (contentType) {
      if (contentType.startsWith("video/")) return "video";
      if (contentType.startsWith("audio/")) return "audio";
      if (contentType.startsWith("image/")) return "thumbnail";
    }
    // Infer from path
    if (storageKey.includes("/thumbnails/")) return "thumbnail";
    if (storageKey.match(/\.(mp4|mov|avi|webm)$/i)) return "video";
    if (storageKey.match(/\.(mp3|wav|aac|ogg|m4a|flac)$/i)) return "audio";
    return "video"; // default
  }
}
