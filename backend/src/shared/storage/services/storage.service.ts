/**
 * Storage service - single entry point for upload/delete/exists/stream.
 * Controllers and business logic use this, never provider SDKs directly.
 */

import { getStorageProvider, getStorageProviderByName } from "../factory/storage-provider.factory";
import type { StorageProviderName } from "../interfaces/storage-types.interface";
import type { IStorageProvider } from "../interfaces/storage-provider.interface";
import type {
  UploadObjectParams,
  UploadObjectResult,
  ObjectMetadata,
  OpenReadStreamParams,
  OpenReadStreamResult
} from "../interfaces/storage-types.interface";

export class StorageService {
  private get provider(): IStorageProvider {
    return getStorageProvider();
  }

  async upload(params: UploadObjectParams): Promise<UploadObjectResult> {
    return this.provider.upload(params);
  }

  async delete(storageKey: string): Promise<void> {
    return this.provider.delete(storageKey);
  }

  async exists(storageKey: string): Promise<boolean> {
    return this.provider.exists(storageKey);
  }

  async getObjectMetadata(storageKey: string): Promise<ObjectMetadata | null> {
    return this.provider.getObjectMetadata(storageKey);
  }

  async openReadStream(params: OpenReadStreamParams): Promise<OpenReadStreamResult> {
    if (!this.provider.openReadStream) {
      throw new Error("Current storage provider does not support openReadStream");
    }
    return this.provider.openReadStream(params);
  }
}

let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}
