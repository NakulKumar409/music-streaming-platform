/**
 * AWS S3 storage provider using AWS SDK v3. Section 25.3.
 */

import { Readable } from "stream";
import type { IStorageProvider } from "../interfaces/storage-provider.interface";
import type {
  UploadObjectParams,
  UploadObjectResult,
  ObjectMetadata,
  OpenReadStreamParams,
  OpenReadStreamResult
} from "../interfaces/storage-types.interface";
import {
  StorageUploadFailedException,
  StorageDeleteFailedException,
  StorageReadFailedException
} from "../../exceptions/storage.exception";

export interface S3StorageProviderConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
}

export class S3StorageProvider implements IStorageProvider {
  private client: any = null;
  private readonly bucket: string;

  constructor(private readonly config: S3StorageProviderConfig) {
    this.bucket = config.bucket;
  }

  private async getClient() {
    if (this.client) return this.client;
    const { S3Client } = await import("@aws-sdk/client-s3");
    this.client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      }
    });
    return this.client;
  }

  async upload(params: UploadObjectParams): Promise<UploadObjectResult> {
    const { storageKey, body, contentType } = params;
    try {
      const client = await this.getClient();
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body as Readable);
      const cmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: contentType
      });
      const result = await client.send(cmd);
      return {
        storageKey,
        providerAssetId: storageKey,
        etag: result.ETag,
        sizeBytes: buffer.length
      };
    } catch (err: any) {
      throw new StorageUploadFailedException(
        err?.message || "S3 upload failed",
        storageKey
      );
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      const client = await this.getClient();
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    } catch (err: any) {
      throw new StorageDeleteFailedException(
        err?.message || "S3 delete failed",
        storageKey
      );
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      return true;
    } catch (err: any) {
      if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return false;
      throw new StorageReadFailedException(err?.message || "S3 exists check failed", storageKey);
    }
  }

  async getObjectMetadata(storageKey: string): Promise<ObjectMetadata | null> {
    try {
      const client = await this.getClient();
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      const result = await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      return {
        storageKey,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        etag: result.ETag,
        lastModified: result.LastModified
      };
    } catch (err: any) {
      if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return null;
      throw new StorageReadFailedException(err?.message || "S3 getMetadata failed", storageKey);
    }
  }

  async openReadStream(params: OpenReadStreamParams): Promise<OpenReadStreamResult> {
    const { storageKey, start, end } = params;
    try {
      const client = await this.getClient();
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const range = start !== undefined && end !== undefined
        ? `bytes=${start}-${end}`
        : start !== undefined
          ? `bytes=${start}-`
          : undefined;
      const cmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ...(range && { Range: range })
      });
      const response = await client.send(cmd);
      const stream = response.Body as Readable;
      const contentLength = response.ContentLength ?? undefined;
      return {
        stream,
        contentType: response.ContentType,
        contentLength,
        acceptRanges: true
      };
    } catch (err: any) {
      throw new StorageReadFailedException(err?.message || "S3 getObject failed", storageKey);
    }
  }
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
