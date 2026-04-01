/**
 * Storage provider contract. Section 7.
 * Only storage operations; no entitlement or playback decisions.
 */

import type {
  UploadObjectParams,
  UploadObjectResult,
  ObjectMetadata,
  OpenReadStreamParams,
  OpenReadStreamResult,
  GetPublicObjectUrlParams
} from "./storage-types.interface";

export interface IStorageProvider {
  upload(params: UploadObjectParams): Promise<UploadObjectResult>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
  getObjectMetadata(storageKey: string): Promise<ObjectMetadata | null>;
  openReadStream?(params: OpenReadStreamParams): Promise<OpenReadStreamResult>;
  getPublicObjectUrl?(params: GetPublicObjectUrlParams): Promise<string | null>;
}
