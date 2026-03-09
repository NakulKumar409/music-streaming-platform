/**
 * Ensures content_items has provider-neutral columns at startup so media-access and stream work.
 */

import { pool } from "../common/db";

export async function ensureUsersSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'FAN',
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      is_verified BOOLEAN NOT NULL DEFAULT false,
      verified BOOLEAN NOT NULL DEFAULT false,
      name VARCHAR(255),
      profile_image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'FAN'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");

  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)");
}

export async function ensureContentMediaColumns(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_items (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL,
      artist_id INT NOT NULL,
      thumbnail_url TEXT,
      media_url TEXT,
      audio_url TEXT,
      video_url TEXT,
      genre VARCHAR(80),
      lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      is_approved BOOLEAN NOT NULL DEFAULT false,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      published_at TIMESTAMPTZ,
      subscription_required BOOLEAN NOT NULL DEFAULT false
    )
  `);
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(20) DEFAULT 'local'");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS storage_key TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_storage_key TEXT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS visibility VARCHAR(30) DEFAULT 'PROTECTED'");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS status VARCHAR(20)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS file_size_bytes INT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS video_storage_key TEXT");
}
