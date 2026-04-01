/**
 * Storage module index - exports all public storage APIs
 */

export { getStorageProviderByName, getStorageProvider } from "./factory/storage-provider.factory";
export { getStorageService, StorageService } from "./services/storage.service";
export type { IStorageProvider } from "./interfaces/storage-provider.interface";
export type { StorageProviderName } from "./interfaces/storage-types.interface";
