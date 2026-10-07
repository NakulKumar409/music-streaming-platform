import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs";
import * as path from "path";
import { pool } from "../common/db";
import { getStorageConfig } from "../config/storage.config";
import {
  cloudinaryEagerTransformsForSourceHeight,
  qualitiesForSourceHeight,
} from "../modules/media/adaptive-renditions";

function cleanPublicId(relPath: string): string {
  return relPath.replace(/^\/+/, "").replace(/\.[^/.]+$/, "");
}

async function uploadToCloudinary(filePath: string, publicId: string, kind: "audio" | "video" | "thumbnail") {
  const isThumbnail = kind === "thumbnail";
  const uploadOptions: any = {
    public_id: publicId,
    resource_type: isThumbnail ? "image" : "video",
    type: isThumbnail ? "upload" : "authenticated",
    overwrite: true,
  };

  if (kind === "video") {
    uploadOptions.eager = [
      { width: 256, height: 144, crop: "limit", bit_rate: "100k", format: "m3u8" },
      { width: 426, height: 240, crop: "limit", bit_rate: "200k", format: "m3u8" },
      { width: 640, height: 360, crop: "limit", bit_rate: "400k", format: "m3u8" },
      { width: 854, height: 480, crop: "limit", bit_rate: "700k", format: "m3u8" },
      { width: 1280, height: 720, crop: "limit", bit_rate: "1500k", format: "m3u8" },
      { streaming_profile: "auto", format: "m3u8" },
    ];
    uploadOptions.eager_async = true;
    uploadOptions.timeout = 180000;
  }

  console.log(`[Cloudinary] Uploading ${kind} from ${filePath} as ${publicId}...`);
  const res = await cloudinary.uploader.upload(filePath, uploadOptions);
  return res;
}

async function main() {
  const storage = getStorageConfig();
  const cfg = storage.cloudinary;

  if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
    throw new Error("Cloudinary configuration is required");
  }

  cloudinary.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
    secure: true,
    analytics: false,
    urlAnalytics: false,
  });

  console.log("[Cloudinary] Configured with cloud name:", cfg.cloudName);

  // First ensure artists 31, 49, 51, 94 are active and approved
  await pool.query(`
    UPDATE users 
       SET is_deleted = false, 
           status = 'ACTIVE', 
           artist_status = 'APPROVED', 
           is_verified = true 
     WHERE id IN (31, 49, 51, 94)
  `);
  console.log("[DB] Ensured artists 31, 49, 51, 94 are active and approved.");

  const items = await pool.query<{
    id: number;
    title: string;
    artist_id: number;
    type: string;
    storage_provider: string;
    storage_key: string | null;
    video_storage_key: string | null;
    thumbnail_storage_key: string | null;
    duration_ms: number | null;
  }>(`
    SELECT id, title, artist_id, type, storage_provider, storage_key, video_storage_key, thumbnail_storage_key, duration_ms
      FROM content_items
     WHERE id IN (8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23)
     ORDER BY id ASC
  `);

  for (const item of items.rows) {
    console.log(`\n--- Processing content #${item.id}: "${item.title}" (${item.type}) ---`);
    const isVideo = item.type.toUpperCase() === "VIDEO";
    const mediaKey = isVideo ? item.video_storage_key : item.storage_key;

    let mediaPublicId: string | null = null;
    let thumbnailPublicId: string | null = null;
    let thumbnailUrl: string | null = null;
    let durationMs = item.duration_ms;
    let sourceWidth: number | null = null;
    let sourceHeight: number | null = null;
    let adaptiveQualities: string[] = isVideo ? ["144p", "240p", "360p", "480p", "720p"] : [];

    // 1. Upload media if local file exists
    if (mediaKey) {
      const fullMediaPath = path.join(process.cwd(), "storage", mediaKey);
      if (fs.existsSync(fullMediaPath)) {
        const publicId = cleanPublicId(mediaKey);
        try {
          const res = await uploadToCloudinary(fullMediaPath, publicId, isVideo ? "video" : "audio");
          mediaPublicId = res.public_id;
          if (res.duration) {
            durationMs = Math.round(res.duration * 1000);
          }
          if (isVideo) {
            sourceWidth = res.width || 1280;
            sourceHeight = res.height || 720;
            const derivedQualities = qualitiesForSourceHeight(sourceHeight);
            if (derivedQualities.length) {
              adaptiveQualities = derivedQualities;
            }
          }
          console.log(`✓ Media uploaded: ${mediaPublicId} (duration: ${durationMs}ms)`);
        } catch (err) {
          console.error(`✗ Media upload failed for ${mediaKey}:`, err);
        }
      } else {
        console.warn(`File not found on disk: ${fullMediaPath}`);
      }
    }

    // 2. Upload thumbnail if exists
    if (item.thumbnail_storage_key) {
      const fullThumbPath = path.join(process.cwd(), "storage", item.thumbnail_storage_key);
      if (fs.existsSync(fullThumbPath)) {
        const thumbPublicId = cleanPublicId(item.thumbnail_storage_key);
        try {
          const res = await uploadToCloudinary(fullThumbPath, thumbPublicId, "thumbnail");
          thumbnailPublicId = res.public_id;
          thumbnailUrl = res.secure_url;
          console.log(`✓ Thumbnail uploaded: ${thumbnailPublicId}`);
        } catch (err) {
          console.error(`✗ Thumbnail upload failed for ${item.thumbnail_storage_key}:`, err);
        }
      }
    }

    // 3. Update DB record
    if (mediaPublicId) {
      await pool.query(`
        UPDATE content_items
           SET storage_provider = 'cloudinary',
               provider_asset_id = $1,
               audio_provider_asset_id = $2,
               video_provider_asset_id = $3,
               thumbnail_provider_asset_id = COALESCE($4, thumbnail_provider_asset_id),
               thumbnail_url = COALESCE($5, thumbnail_url),
               status = 'READY',
               adaptive_status = $6,
               adaptive_qualities = $7::text[],
               source_width = $8,
               source_height = $9,
               duration_ms = COALESCE($10, duration_ms),
               lifecycle_state = 'EARLY_ACCESS',
               is_approved = true,
               is_taken_down = false,
               published_at = COALESCE(published_at, now())
         WHERE id = $11
      `, [
        mediaPublicId,
        isVideo ? null : mediaPublicId,
        isVideo ? mediaPublicId : null,
        thumbnailPublicId,
        thumbnailUrl,
        isVideo ? "READY" : "NOT_APPLICABLE",
        adaptiveQualities,
        sourceWidth,
        sourceHeight,
        durationMs,
        item.id,
      ]);
      console.log(`✓ DB updated for content #${item.id}`);
    }
  }

  console.log("\nMigration completed successfully!");
}

main().catch(console.error).finally(() => pool.end());
