-- Provider-native media identity columns for multi-provider safety.
-- Run in production before deploying the backend changes.

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS audio_provider_asset_id TEXT;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS video_provider_asset_id TEXT;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_provider_asset_id TEXT;

-- Optional index helpers for repair/audit operations.
CREATE INDEX IF NOT EXISTS idx_content_items_storage_provider ON content_items(storage_provider);
CREATE INDEX IF NOT EXISTS idx_content_items_audio_provider_asset_id ON content_items(audio_provider_asset_id);
CREATE INDEX IF NOT EXISTS idx_content_items_video_provider_asset_id ON content_items(video_provider_asset_id);
CREATE INDEX IF NOT EXISTS idx_content_items_thumbnail_provider_asset_id ON content_items(thumbnail_provider_asset_id);

