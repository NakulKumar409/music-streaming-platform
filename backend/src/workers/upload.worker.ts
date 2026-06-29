import { Worker } from "bullmq";

import fs from "fs";
import dotenv from "dotenv";

import { getStorageService } from "../shared/storage/services/storage.service";

import { pool } from "../common/db";

import { invalidateCachePattern, invalidateContentCache } from "../common/cache";

import { logger } from "../common/logger";

import * as Sentry from "@sentry/node";

import { NotificationService } from "../shared/notifications/notification.service";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Disable worker if Redis is not configured
const redisEnabled = process.env.REDIS_URL && process.env.REDIS_URL !== "" && process.env.REDIS_URL !== "disabled";

// Ensure we don't fail immediately inside the worker loop if DB reconnects

export const uploadWorker = redisEnabled ? new Worker(

  "media-upload",

  async (job) => {

    const { contentId, thumbnail, audio, video } = job.data;

    const storage = getStorageService();



    logger.info({ contentId, jobId: job.id }, `[Worker] Started processing upload`);



    try {

      // 1. Upload Thumbnail

      const uploadedThumbnail = await storage.upload({

        storageKey: thumbnail.key,

        body: fs.createReadStream(thumbnail.path),

        contentType: thumbnail.mime,

      });



      // 2. Upload Audio

      const uploadedAudio = await storage.upload({

        storageKey: audio.key,

        body: fs.createReadStream(audio.path),

        contentType: audio.mime,

      });



      // 3. Upload Video

      const uploadedVideo = await storage.upload({

        storageKey: video.key,

        body: fs.createReadStream(video.path),

        contentType: video.mime,

      });



      // 4. Update Database

      await pool.query(

        `UPDATE content_items

         SET 

            provider_asset_id = $1,

            audio_provider_asset_id = $2,

            video_provider_asset_id = $3,

            thumbnail_provider_asset_id = $4,

            thumbnail_url = $5,

            audio_url = $6,

            video_url = $7,

            file_key = $8,

            status = 'PUBLISHED'

         WHERE id = $9`,

        [

          uploadedAudio.providerAssetId || uploadedVideo.providerAssetId || null,

          uploadedAudio.providerAssetId || null,

          uploadedVideo.providerAssetId || null,

          uploadedThumbnail.providerAssetId || null,

          uploadedThumbnail.providerUrl || null,

          null, // new system doesn't rely entirely on audio_url vs media_url for the raw

          null, // new system uses stream logic

          uploadedAudio.providerUrl || uploadedVideo.providerUrl || null, // legacy file_key mapping

          contentId,

        ]

      );



      logger.info({ contentId, jobId: job.id }, `[Worker] Successfully completed upload`);



      // 5. Cleanup Local Files

      const filesToClean = [thumbnail.path, audio.path, video.path];

      for (const p of filesToClean) {

        if (p && fs.existsSync(p)) {

          fs.promises.unlink(p).catch(err => console.error(`[Worker] Cleanup failed for ${p}:`, err));

        }

      }



      await invalidateContentCache();



      // 6. Notify Subscribers

      try {

        const itemRes = await pool.query(

          "SELECT title, artist_id, subscription_required FROM content_items WHERE id = $1",

          [contentId]

        );

        const item = itemRes.rows[0];

        if (item) {

          const artistRes = await pool.query("SELECT name FROM users WHERE id = $1", [item.artist_id]);

          const artistName = artistRes.rows[0]?.name || "Your favorite artist";



          // Find subscribers

          const subscribersRes = await pool.query(

            `SELECT DISTINCT user_id FROM subscriptions 

             WHERE (status = 'ACTIVE' OR status = 'GRACE') 

             AND (

               (type = 'ARTIST' AND artist_id = $1)

               OR type = 'PLATFORM'

             )`,

            [item.artist_id]

          );



          const subscriberIds = subscribersRes.rows.map(r => String(r.user_id));

          if (subscriberIds.length > 0) {

            await NotificationService.sendToMultipleUsers(subscriberIds, {

              title: "New Exclusive Release! 💎",

              body: `${artistName} just dropped a new ${item.subscription_required ? 'exclusive' : 'track'}: "${item.title}"`,

              data: { type: "new_content", contentId, artistId: item.artist_id }

            });

          }

        }

      } catch (notifyErr) {

        logger.error({ error: notifyErr, contentId }, "[Worker] New content notification failed");

      }



      return { success: true, contentId };

    } catch (err: any) {

      logger.error({ err, contentId, jobId: job.id }, `[Worker Error] Job failed to process`);

      Sentry.captureException(err, { extra: { contentId, jobId: job.id } });

      // We throw the error so BullMQ knows it failed and can retry it.

      // We do NOT delete files here because the retry will need them!

      throw err;

    }

  },

  {
    connection: redisUrl.startsWith("redis://")
      ? { url: redisUrl }
      : {
          host: "127.0.0.1",
          port: 6379,
        },
  }

) : null as any;



if (uploadWorker) {
  uploadWorker.on("failed", async (job, err) => {
    if (!job) return;

    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      logger.warn({ jobId: job.id, contentId: job.data.contentId }, `[Worker] Job completely exhausted retries. Marking as FAILED.`);
      const { contentId, thumbnail, audio, video } = job.data;

      // Ultimate Failure: Set status to FAILED so user sees it in their UI
      await pool.query(`UPDATE content_items SET status = 'FAILED' WHERE id = $1`, [contentId]).catch(e => console.error(e));

      // Cleanup Local Files to prevent disk leak
      const filesToClean = [thumbnail?.path, audio?.path, video?.path];
      for (const p of filesToClean) {
        if (p && fs.existsSync(p)) {
          fs.promises.unlink(p).catch(e => e);
        }
      }
    }
  });
}

