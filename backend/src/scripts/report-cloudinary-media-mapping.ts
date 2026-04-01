/**
 * Cloudinary mapping audit / repair helper.
 *
 * Usage:
 *  - Report only: npx ts-node --transpile-only src/scripts/report-cloudinary-media-mapping.ts
 *  - Apply safe repairs from existing URLs/fields:
 *      npx ts-node --transpile-only src/scripts/report-cloudinary-media-mapping.ts --apply
 */

import "dotenv/config";
import { pool } from "../common/db";
import { resolveMediaIdentity } from "../shared/media/media-asset-locator";

type Row = {
  id: number;
  type: string | null;
  storage_provider: string | null;
  provider_asset_id: string | null;
  audio_provider_asset_id: string | null;
  video_provider_asset_id: string | null;
  thumbnail_provider_asset_id: string | null;
  file_key: string | null;
  audio_url: string | null;
  video_url: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  storage_key: string | null;
  video_storage_key: string | null;
  thumbnail_storage_key: string | null;
};

function requiresAudio(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("audio") || !t.includes("video");
}

function requiresVideo(type: string): boolean {
  return type.toLowerCase().includes("video");
}

function normalizeType(type: string | null | undefined): string {
  return (type || "audio").toString().trim().toLowerCase();
}

async function main() {
  const shouldApply = process.argv.includes("--apply");

  const result = await pool.query<Row>(
    `SELECT
      id, type, storage_provider,
      provider_asset_id, audio_provider_asset_id, video_provider_asset_id, thumbnail_provider_asset_id,
      file_key, audio_url, video_url, media_url, thumbnail_url,
      storage_key, video_storage_key, thumbnail_storage_key
    FROM content_items
    WHERE COALESCE(storage_provider, 'local') = 'cloudinary'
    ORDER BY id ASC`
  );

  const rows = result.rows || [];
  const broken: Array<{
    id: number;
    type: string;
    missingAudio: boolean;
    missingVideo: boolean;
    missingThumbnail: boolean;
  }> = [];

  let repairable = 0;
  let repaired = 0;

  for (const row of rows) {
    const type = normalizeType(row.type);
    const audioIdentity = resolveMediaIdentity(row, "audio").providerAssetId;
    const videoIdentity = resolveMediaIdentity(row, "video").providerAssetId;
    const thumbnailIdentity = resolveMediaIdentity(row, "thumbnail").providerAssetId;

    const needAudio = requiresAudio(type);
    const needVideo = requiresVideo(type);
    const needThumb = true;

    const missingAudio = needAudio && !audioIdentity;
    const missingVideo = needVideo && !videoIdentity;
    const missingThumbnail = needThumb && !thumbnailIdentity;

    if (missingAudio || missingVideo || missingThumbnail) {
      broken.push({
        id: row.id,
        type,
        missingAudio,
        missingVideo,
        missingThumbnail
      });
    }

    if (!shouldApply) continue;

    const nextAudio = row.audio_provider_asset_id || audioIdentity || null;
    const nextVideo = row.video_provider_asset_id || videoIdentity || null;
    const nextThumb = row.thumbnail_provider_asset_id || thumbnailIdentity || null;
    const nextPrimary =
      row.provider_asset_id ||
      (type.includes("video") ? nextVideo : nextAudio) ||
      null;

    const changed =
      nextAudio !== row.audio_provider_asset_id ||
      nextVideo !== row.video_provider_asset_id ||
      nextThumb !== row.thumbnail_provider_asset_id ||
      nextPrimary !== row.provider_asset_id;

    if (!changed) continue;
    repairable += 1;

    await pool.query(
      `UPDATE content_items
       SET provider_asset_id = $1,
           audio_provider_asset_id = $2,
           video_provider_asset_id = $3,
           thumbnail_provider_asset_id = $4
       WHERE id = $5`,
      [nextPrimary, nextAudio, nextVideo, nextThumb, row.id]
    );
    repaired += 1;
  }

  console.log(`[cloudinary-mapping] total cloudinary rows: ${rows.length}`);
  console.log(`[cloudinary-mapping] broken rows: ${broken.length}`);

  if (broken.length) {
    console.log("[cloudinary-mapping] broken examples (up to 25):");
    for (const b of broken.slice(0, 25)) {
      console.log(
        `  - id=${b.id} type=${b.type} missing(audio=${b.missingAudio}, video=${b.missingVideo}, thumbnail=${b.missingThumbnail})`
      );
    }
  }

  if (shouldApply) {
    console.log(`[cloudinary-mapping] repairable rows: ${repairable}`);
    console.log(`[cloudinary-mapping] repaired rows: ${repaired}`);
  } else {
    console.log("[cloudinary-mapping] run with --apply to patch provider asset identity fields from existing URL data.");
  }
}

main()
  .catch((err) => {
    console.error("[cloudinary-mapping] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });

