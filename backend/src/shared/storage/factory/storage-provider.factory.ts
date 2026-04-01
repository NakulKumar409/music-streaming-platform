/**
 * Storage provider factory. Section 9.
 * Fail-fast if provider is misconfigured; no implicit fallback.
 */

import type { IStorageProvider } from "../interfaces/storage-provider.interface";
import type { StorageProviderName } from "../interfaces/storage-types.interface";
import { getStorageConfig } from "../../../config/storage.config";
import { StorageProviderNotConfiguredException } from "../../exceptions/storage.exception";
import { LocalStorageProvider } from "../providers/local-storage.provider";
import { FirebaseStorageProvider } from "../providers/firebase-storage.provider";
import { S3StorageProvider } from "../providers/s3-storage.provider";
import { CloudinaryStorageProvider } from "../providers/cloudinary-storage.provider";

let instance: IStorageProvider | null = null;

export function createStorageProvider(): IStorageProvider {
  if (instance) return instance;
  const config = getStorageConfig();
  const provider = config.provider;

  if (provider === "local") {
    instance = new LocalStorageProvider(config.local.root);
    console.log("[Storage] Provider: local");
    return instance;
  }

  if (provider === "firebase") {
    if (!config.firebase.storageBucket) {
      throw new StorageProviderNotConfiguredException("firebase");
    }
    instance = new FirebaseStorageProvider({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
      storageBucket: config.firebase.storageBucket
    });
    console.log("[Storage] Provider: firebase");
    return instance;
  }

  if (provider === "s3") {
    if (!config.s3.bucket || !config.s3.region) {
      throw new StorageProviderNotConfiguredException("s3");
    }
    instance = new S3StorageProvider({
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      region: config.s3.region,
      bucket: config.s3.bucket
    });
    console.log("[Storage] Provider: s3");
    return instance;
  }

  if (provider === "cloudinary") {
    instance = new CloudinaryStorageProvider();
    return instance;
  }

  throw new StorageProviderNotConfiguredException(provider);
}

export function getStorageProvider(): IStorageProvider {
  return createStorageProvider();
}

/**
 * Get a storage provider by name for per-row storage handling.
 * This allows reading content from different providers based on row's storage_provider column.
 */
export function getStorageProviderByName(provider: StorageProviderName): IStorageProvider {
  const config = getStorageConfig();
  
  if (provider === "local") {
    return new LocalStorageProvider(config.local.root);
  }
  
  if (provider === "firebase") {
    if (!config.firebase.storageBucket) {
      throw new StorageProviderNotConfiguredException("firebase");
    }
    return new FirebaseStorageProvider({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
      storageBucket: config.firebase.storageBucket
    });
  }
  
  if (provider === "s3") {
    if (!config.s3.bucket || !config.s3.region) {
      throw new StorageProviderNotConfiguredException("s3");
    }
    return new S3StorageProvider({
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      region: config.s3.region,
      bucket: config.s3.bucket
    });
  }
  
  if (provider === "cloudinary") {
    return new CloudinaryStorageProvider();
  }
  
  throw new StorageProviderNotConfiguredException(provider);
}
