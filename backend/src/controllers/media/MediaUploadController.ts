import { Request, Response } from 'express';
import { MediaProviderFactory } from '../../services/providers/MediaProviderFactory';
import { pool } from '../../common/db';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export const handleMediaUpload = async (req: Request | any, res: Response) => {
  const correlationId = req?.correlationId || "-";
  try {
    const artistId = req.user?.id;
    const { title, genre, type } = req.body;
    
    if (!title || !genre || !req.files) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const files = req.files as Record<string, Express.Multer.File[]>;
    const thumb = files.thumbnail?.[0];
    const mediaFile = files.media?.[0] || files.video?.[0] || files.audio?.[0]; // We can handle unified media or explicit video/audio

    if (!thumb || !mediaFile) {
      return res.status(400).json({ success: false, message: 'Thumbnail and media file are required' });
    }

    // Determine type
    const mediaType: "audio" | "video" = mediaFile.mimetype.startsWith('video') ? 'video' : 'audio';

    // 1. Initial DB Insertion (State: PROCESSING)
    const dbResult = await pool.query(
      `INSERT INTO content_items (
        title, genre, type, artist_id, 
        technical_status, business_status, 
        mime_type, file_size_bytes, original_file_name
      ) VALUES ($1, $2, $3, $4, 'PROCESSING', 'PUBLISHED', $5, $6, $7)
      RETURNING id`,
      [title, genre, mediaType.toUpperCase(), artistId, mediaFile.mimetype, mediaFile.size, mediaFile.originalname]
    );

    const mediaId = dbResult.rows[0].id;
    const provider = MediaProviderFactory.getProvider();

    // 2. Temp File writing for Provider SDK processing
    const tempDir = os.tmpdir();
    const mediaTempPath = path.join(tempDir, `${uuidv4()}-${mediaFile.originalname}`);
    const thumbTempPath = path.join(tempDir, `${uuidv4()}-${thumb.originalname}`);

    await fs.writeFile(mediaTempPath, mediaFile.buffer);
    await fs.writeFile(thumbTempPath, thumb.buffer);

    try {
      // 3. Upload to Provider (Cloudinary)
      const uploadResult = await provider.uploadFile(mediaTempPath, artistId, mediaId, mediaType);
      const thumbResult = await provider.uploadFile(thumbTempPath, artistId, mediaId, "thumbnail");
      const providerName = (process.env.STORAGE_PROVIDER || "local").toString().toLowerCase();
      const internalAudioKey = mediaType === "audio" ? `assetref:${uploadResult.providerAssetId}` : null;
      const internalVideoKey = mediaType === "video" ? `assetref:${uploadResult.providerAssetId}` : null;
      const internalThumbKey = `assetref:${thumbResult.providerAssetId}`;

      // 4. Update Database with Provider References
      // Store both the legacy URL fields and the new storage key fields
      await pool.query(
        `UPDATE content_items SET 
          provider_asset_id = $1, 
          audio_provider_asset_id = $2,
          video_provider_asset_id = $3,
          thumbnail_provider_asset_id = $4,
          file_key = $5, 
          thumbnail_url = $6,
          thumbnail_storage_key = $7,
          storage_key = $8,
          storage_provider = $9,
          video_storage_key = $10,
          audio_url = $11,
          video_url = $12,
          metadata = $13
        WHERE id = $14`,
        [
          uploadResult.providerAssetId,
          mediaType === "audio" ? uploadResult.providerAssetId : null,
          mediaType === "video" ? uploadResult.providerAssetId : null,
          thumbResult.providerAssetId,
          uploadResult.fileKey,
          thumbResult.fileKey, // public URL for legacy clients
          internalThumbKey,
          internalAudioKey,
          providerName,
          internalVideoKey,
          mediaType === "audio" ? uploadResult.fileKey : null,
          mediaType === "video" ? uploadResult.fileKey : null,
          uploadResult.metadata ? JSON.stringify(uploadResult.metadata) : null,
          mediaId
        ]
      ).catch(async (err: any) => {
        if (err?.code !== "42703") throw err;
        // Backward-compatible fallback for DBs not yet migrated with provider-asset columns.
        return pool.query(
          `UPDATE content_items SET 
            provider_asset_id = $1, 
            file_key = $2, 
            thumbnail_url = $3,
            thumbnail_storage_key = $4,
            storage_key = $5,
            storage_provider = $6,
            video_storage_key = $7,
            audio_url = $8,
            video_url = $9,
            metadata = $10
          WHERE id = $11`,
          [
            uploadResult.providerAssetId,
            uploadResult.fileKey,
            thumbResult.fileKey,
            internalThumbKey,
            internalAudioKey,
            providerName,
            internalVideoKey,
            mediaType === "audio" ? uploadResult.fileKey : null,
            mediaType === "video" ? uploadResult.fileKey : null,
            uploadResult.metadata ? JSON.stringify(uploadResult.metadata) : null,
            mediaId
          ]
        );
      });

      return res.json({
        success: true,
        message: 'Upload started successfully',
        mediaId,
        technicalStatus: 'PROCESSING',
        thumbnailUrl: thumbResult.fileKey
      });
    } finally {
      // 5. Cleanup Temp Files
      await fs.unlink(mediaTempPath).catch(() => {});
      await fs.unlink(thumbTempPath).catch(() => {});
    }
  } catch (error: any) {
    console.error("[MediaUpload] Error", correlationId, error);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
};
