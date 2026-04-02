-- Migration: Add index on artist name for search performance
-- Created: 2026-04-02

-- This index significantly improves the performance of artist search queries
-- by allowing fast case-insensitive partial matching on artist names
CREATE INDEX IF NOT EXISTS idx_users_name_artist_search 
ON users (name) 
WHERE UPPER(role) = 'ARTIST' AND COALESCE(is_deleted, false) = false;

-- Alternative: Full index without partial index condition (if needed for broader searches)
-- CREATE INDEX IF NOT EXISTS idx_artist_name ON users(name);

-- Verify index creation
-- \d users
