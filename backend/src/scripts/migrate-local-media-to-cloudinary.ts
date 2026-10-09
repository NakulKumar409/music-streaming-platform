import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs";
import * as path from "path";
import { pool } from "../common/db";
import { getStorageConfig } from "../config/storage.config";

function cleanPublicId(relPath: string): string {
  return relPath.replace(/^\/+/, "").replace(/\.[^/.]+$/, "");
}

async function uploadToCloudinary(
  filePath: string,
  publicId: string,
  resourceType: "image" | "video"
) {
  const uploadOptions: any = {
    public_id: publicId,
    resource_type: resourceType,
    type: "upload",
    overwrite: true,
  };
  console.log(`[Cloudinary] Uploading ${resourceType} from ${filePath} as ${publicId}...`);
  return await cloudinary.uploader.upload(filePath, uploadOptions);
}

async function migrate() {
  const storage = getStorageConfig();
  const cfg = storage.cloudinary;

  if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
    throw new Error("Cloudinary configuration is required in .env");
  }

  cloudinary.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
    secure: true,
    analytics: false,
    urlAnalytics: false,
  });

  const res = await pool.query(`
    SELECT id, title, type, storage_key, video_storage_key, thumbnail_storage_key,
           provider_asset_id, audio_provider_asset_id, video_provider_asset_id,
           thumbnail_provider_asset_id
      FROM content_items
     WHERE storage_provider = 'local'
     ORDER BY id ASC
  `);

  console.log(`Found ${res.rows.length} items with storage_provider = 'local'`);

  for (const item of res.rows) {
    const mediaKey = item.storage_key || item.video_storage_key;
    if (!mediaKey) {
      console.log(`[Skip] #${item.id} ${item.title} has no media storage key`);
      continue;
    }

    const localMediaPath = path.resolve("./storage", mediaKey);
    if (!fs.existsSync(localMediaPath)) {
      console.log(`[Skip] #${item.id} ${item.title} file not found locally: ${mediaKey}`);
      continue;
    }

    console.log(`\n--- Migrating Content #${item.id}: "${item.title}" (${item.type}) ---`);

    // 1. Upload media
    const mediaPublicId = cleanPublicId(mediaKey);
    const mediaUploadRes = await uploadToCloudinary(localMediaPath, mediaPublicId, "video");
    console.log(`  -> Media uploaded: ${mediaUploadRes.secure_url}`);

    // 2. Upload thumbnail if exists
    let thumbPublicId = item.thumbnail_provider_asset_id;
    let thumbUrl: string | null = null;
    if (item.thumbnail_storage_key) {
      const localThumbPath = path.resolve("./storage", item.thumbnail_storage_key);
      if (fs.existsSync(localThumbPath)) {
        thumbPublicId = cleanPublicId(item.thumbnail_storage_key);
        const thumbUploadRes = await uploadToCloudinary(localThumbPath, thumbPublicId, "image");
        thumbUrl = thumbUploadRes.secure_url;
        console.log(`  -> Thumbnail uploaded: ${thumbUrl}`);
      }
    }

    // 3. Update database row
    const isAudio = item.type === "AUDIO";
    const isVideo = item.type === "VIDEO";

    await pool.query(
      `UPDATE content_items
          SET storage_provider = 'cloudinary',
              provider_asset_id = $1,
              audio_provider_asset_id = $2,
              video_provider_asset_id = $3,
              thumbnail_provider_asset_id = COALESCE($4, thumbnail_provider_asset_id),
              media_url = $5,
              audio_url = $6,
              video_url = $7,
              file_key = $5,
              thumbnail_url = COALESCE($8, thumbnail_url),
              status = 'READY'
        WHERE id = $9`,
      [
        mediaPublicId,
        isAudio ? mediaPublicId : null,
        isVideo ? mediaPublicId : null,
        thumbPublicId,
        mediaUploadRes.secure_url,
        isAudio ? mediaUploadRes.secure_url : null,
        isVideo ? mediaUploadRes.secure_url : null,
        thumbUrl,
        item.id,
      ]
    );

    console.log(`  [SUCCESS] Content #${item.id} migrated to Cloudinary in DB!`);
  }

  console.log("\n[Migration Completed] All local media files have been uploaded to Cloudinary and database updated!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
