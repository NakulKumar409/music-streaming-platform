import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs";
import * as path from "path";
import { pool } from "../common/db";
import { getStorageConfig } from "../config/storage.config";

function cleanPublicId(relPath: string): string {
  return relPath.replace(/^\/+/, "").replace(/\.[^/.]+$/, "");
}

async function uploadImageToCloudinary(filePath: string, publicId: string) {
  const uploadOptions: any = {
    public_id: publicId,
    resource_type: "image",
    type: "upload",
    overwrite: true,
  };
  console.log(`[Cloudinary] Uploading image from ${filePath} as ${publicId}...`);
  return await cloudinary.uploader.upload(filePath, uploadOptions);
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

  const uploads = [
    {
      userId: 31,
      kind: "PROFILE",
      localFile: "storage/artists/31/images/2026/09/233f1b4e.jpg",
      publicId: "artists/31/images/2026/09/233f1b4e",
    },
    {
      userId: 31,
      kind: "BANNER",
      localFile: "storage/artists/31/images/2026/09/b9f11609.jpg",
      publicId: "artists/31/images/2026/09/b9f11609",
    },
    {
      userId: 51,
      kind: "PROFILE",
      localFile: "storage/artists/51/images/2026/09/4c52a675.jpg",
      publicId: "artists/51/images/2026/09/4c52a675",
    },
    {
      userId: 83,
      kind: "PROFILE",
      localFile: "storage/artists/83/images/2026/10/6f412b96.jpg",
      publicId: "artists/83/images/2026/10/6f412b96",
    },
    {
      userId: 49,
      kind: "PROFILE",
      localFile: "storage/artists/49/thumbnails/2026/09/c66ce102.jpg",
      publicId: "artists/49/images/2026/09/c66ce102",
    },
  ];

  for (const item of uploads) {
    const fullPath = path.resolve(process.cwd(), item.localFile);
    if (!fs.existsSync(fullPath)) {
      console.warn(`File not found: ${fullPath}`);
      continue;
    }
    const stat = fs.statSync(fullPath);
    const res = await uploadImageToCloudinary(fullPath, item.publicId);
    console.log(`[Cloudinary] Uploaded ${item.kind} for user ${item.userId}: ${res.secure_url}`);

    await pool.query(
      `INSERT INTO user_media_assets (
         user_id, kind, storage_provider, storage_key, provider_asset_id,
         mime_type, size_bytes, created_at, updated_at
       ) VALUES ($1, $2, 'cloudinary', $3, $4, 'image/jpeg', $5, now(), now())
       ON CONFLICT (user_id, kind)
       DO UPDATE SET
         storage_provider = 'cloudinary',
         storage_key = EXCLUDED.storage_key,
         provider_asset_id = EXCLUDED.provider_asset_id,
         mime_type = EXCLUDED.mime_type,
         size_bytes = EXCLUDED.size_bytes,
         updated_at = now()`,
      [item.userId, item.kind, item.publicId + ".jpg", item.publicId, stat.size]
    );

    if (item.kind === "PROFILE") {
      await pool.query(
        `UPDATE users SET profile_image_url = $2, updated_at = now() WHERE id = $1`,
        [item.userId, res.secure_url]
      );
    } else if (item.kind === "BANNER") {
      await pool.query(
        `UPDATE users SET banner_image_url = $2, updated_at = now() WHERE id = $1`,
        [item.userId, res.secure_url]
      );
    }
  }

  // Also handle User 94 (Neha Kakkar) who already had asset in Cloudinary
  const nehaUrl = cloudinary.url("artists/94/images/2026/10/64f90f14", {
    secure: true,
    resource_type: "image",
  });
  await pool.query(
    `UPDATE users SET profile_image_url = $2, updated_at = now() WHERE id = $1`,
    [94, nehaUrl]
  );
  console.log(`[DB] Updated Neha Kakkar (94) profile_image_url: ${nehaUrl}`);

  console.log("[Migration] Successfully migrated all artist profile images to Cloudinary!");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
