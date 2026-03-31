/**
 * Shared types for storage layer. Provider-neutral.
 */

import { Readable } from "stream";

export type StorageProviderName = "local" | "firebase" | "s3" | "cloudinary";

export interface UploadObjectParams {
  storageKey: string;
  body: Buffer | Readable;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadObjectResult {
  storageKey: string;
  etag?: string;
  sizeBytes?: number;
}

export interface ObjectMetadata {
  storageKey: string;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
}

export interface OpenReadStreamParams {
  storageKey: string;
  start?: number;
  end?: number;
}

export interface OpenReadStreamResult {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  acceptRanges?: boolean;
}
