// Simple migration script for featured_artists table
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: false },
});

async function migrate() {
  try {
    console.log("Creating featured_artists table...");
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS featured_artists (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_artist_featured UNIQUE (artist_id)
      );
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_featured_artists_active 
      ON featured_artists(is_active, created_at DESC);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_featured_artists_artist_id 
      ON featured_artists(artist_id);
    `);
    
    console.log("✅ Migration complete: featured_artists table created");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
