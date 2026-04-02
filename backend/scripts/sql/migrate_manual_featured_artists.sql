-- Migration: Add support for manual featured artists
-- Created: 2026-04-02

-- Step 1: Add name and avatar columns
ALTER TABLE featured_artists
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Step 2: Make artist_id nullable (for manually created featured artists)
ALTER TABLE featured_artists
ALTER COLUMN artist_id DROP NOT NULL;

-- Step 3: Drop the unique constraint on artist_id (since we can have multiple manual entries)
ALTER TABLE featured_artists
DROP CONSTRAINT IF EXISTS unique_artist_featured;

-- Step 4: Add new constraint - either artist_id OR name must be present
ALTER TABLE featured_artists
ADD CONSTRAINT check_artist_or_name CHECK (
    (artist_id IS NOT NULL) OR (name IS NOT NULL AND name <> '')
);

-- Step 5: Update existing records to have name/avatar from users table
UPDATE featured_artists fa
SET 
    name = COALESCE(fa.name, u.name, 'Unknown Artist'),
    avatar = COALESCE(fa.avatar, u.profile_image_url)
FROM users u
WHERE fa.artist_id = u.id;

-- Step 6: Create index for name lookups
CREATE INDEX IF NOT EXISTS idx_featured_artists_name ON featured_artists(name);

-- Verification
SELECT 
    'Migration complete' as status,
    COUNT(*) as total_records,
    COUNT(artist_id) as with_artist_id,
    COUNT(name) as with_name
FROM featured_artists;
