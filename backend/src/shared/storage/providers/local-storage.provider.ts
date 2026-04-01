import fs from "fs";
import path from "path";
import { Readable } from "stream";
import type { IStorageProvider } from "../interfaces/storage-provider.interface";
import type {
  UploadObjectParams,
  UploadObjectResult,
  ObjectMetadata,
  OpenReadStreamParams,
  OpenReadStreamResult
} from "../interfaces/storage-types.interface";
import { resolveSafePath, isSafeStorageKey } from "../utils/path-safety.util";
import { StorageUploadFailedException, StoragePathTraversalException } from "../../exceptions/storage.exception";

/**
 * Local disk storage provider. Section 25.1.
 * Path-safe, supports openReadStream for range-based streaming.
 */
export class LocalStorageProvider implements IStorageProvider {
  constructor(private readonly rootDir: string) {
    if (!rootDir || !path.isAbsolute(path.resolve(rootDir))) {
      // Allow relative paths; resolve at use time
    }
  }

  private getMetaPath(storageKey: string): string {
    const absolutePath = this.getAbsolutePath(storageKey);
    return `${absolutePath}.meta.json`;
  }

  private getAbsolutePath(storageKey: string): string {
    if (!isSafeStorageKey(storageKey)) {
      throw new StoragePathTraversalException();
    }
    const root = path.resolve(this.rootDir);
    return resolveSafePath(root, storageKey);
  }

  private ensureDirFor(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async upload(params: UploadObjectParams): Promise<UploadObjectResult> {
    const { storageKey, body, contentType } = params;
    const absolutePath = this.getAbsolutePath(storageKey);
    try {
      this.ensureDirFor(absolutePath);
      const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body as Readable);
      fs.writeFileSync(absolutePath, buffer, { flag: "w" });

      try {
        const metaPath = this.getMetaPath(storageKey);
        fs.writeFileSync(
          metaPath,
          JSON.stringify({ contentType: contentType || null }, null, 2),
          { flag: "w" }
        );
      } catch {
        // ignore meta write failures
      }
      return { storageKey, providerAssetId: storageKey, sizeBytes: buffer.length };
    } catch (err: any) {
      throw new StorageUploadFailedException(
        err?.message || "Local upload failed",
        storageKey
      );
    }
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(storageKey);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    const metaPath = this.getMetaPath(storageKey);
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const absolutePath = this.getAbsolutePath(storageKey);
    return fs.existsSync(absolutePath);
  }

  async getObjectMetadata(storageKey: string): Promise<ObjectMetadata | null> {
    const absolutePath = this.getAbsolutePath(storageKey);
    if (!fs.existsSync(absolutePath)) return null;
    const stat = fs.statSync(absolutePath);

    let contentType: string | null = null;
    try {
      const metaPath = this.getMetaPath(storageKey);
      if (fs.existsSync(metaPath)) {
        const raw = fs.readFileSync(metaPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.contentType && typeof parsed.contentType === "string") {
          contentType = parsed.contentType;
        }
      }
    } catch {
      contentType = null;
    }
    return {
      storageKey,
      contentLength: stat.size,
      lastModified: stat.mtime,
      contentType: contentType ?? undefined
    };
  }

  async openReadStream(params: OpenReadStreamParams): Promise<OpenReadStreamResult> {
    const { storageKey, start, end } = params;
    const absolutePath = this.getAbsolutePath(storageKey);
    if (!fs.existsSync(absolutePath)) {
      const err = new Error("File not found");
      (err as any).code = "ENOENT";
      throw err;
    }
    const stat = fs.statSync(absolutePath);
    const totalSize = stat.size;
    const options: { start?: number; end?: number } = {};
    if (start !== undefined) options.start = start;
    if (end !== undefined) options.end = end;
    const stream = fs.createReadStream(absolutePath, options);
    const contentLength = options.end !== undefined && options.start !== undefined
      ? options.end - options.start + 1
      : totalSize;
    return {
      stream,
      contentLength,
      acceptRanges: true
    };
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
