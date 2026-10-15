-- Migration 0016: Performance Indexes for Content Catalog and Artist Browsing
-- Speeds up /api/v1/fan/content and /api/v1/fan/content/artist/:artistId

CREATE INDEX IF NOT EXISTS idx_content_items_artist_id_created_at
  ON content_items (artist_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_content_items_catalog_governance_sort
  ON content_items (is_approved, is_taken_down, status, lifecycle_state, created_at DESC, id DESC);
