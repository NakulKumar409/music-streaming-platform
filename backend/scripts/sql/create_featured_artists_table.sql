-- Migration: Create featured_artists table for admin-controlled featured artists
-- Created: 2026-04-02

CREATE TABLE IF NOT EXISTS featured_artists (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one entry per artist
    CONSTRAINT unique_artist_featured UNIQUE (artist_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_featured_artists_active ON featured_artists(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_featured_artists_artist_id ON featured_artists(artist_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_featured_artists_updated_at ON featured_artists;
CREATE TRIGGER update_featured_artists_updated_at
    BEFORE UPDATE ON featured_artists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add to Prisma schema (manual step required)
-- model featured_artists {
--   id         Int      @id @default(autoincrement())
--   artist_id  Int
--   is_active  Boolean  @default(true)
--   created_at DateTime @default(now()) @db.Timestamptz(6)
--   updated_at DateTime @default(now()) @db.Timestamptz(6)
--   artist     users    @relation(fields: [artist_id], references: [id], onDelete: Cascade)
--   
--   @@unique([artist_id])
--   @@index([is_active, created_at])
--   @@index([artist_id])
-- }
