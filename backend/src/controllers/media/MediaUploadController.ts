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

      // 4. Update Database with Provider References
      // Store both the legacy URL fields and the new storage key fields
      await pool.query(
        `UPDATE content_items SET 
          provider_asset_id = $1, 
          file_key = $2, 
          thumbnail_url = $3,
          thumbnail_storage_key = $4,
          storage_key = $5,
          storage_provider = $6,
          video_storage_key = $7,
          metadata = $8
        WHERE id = $9`,
        [
          uploadResult.providerAssetId,
          uploadResult.fileKey,
          thumbResult.fileKey, // Full URL for legacy
          thumbResult.providerAssetId, // Storage key for new routing
          uploadResult.providerAssetId, // Storage key for media
          'cloudinary',
          mediaType === 'video' ? uploadResult.providerAssetId : null,
          uploadResult.metadata ? JSON.stringify(uploadResult.metadata) : null,
          mediaId
        ]
      );

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
