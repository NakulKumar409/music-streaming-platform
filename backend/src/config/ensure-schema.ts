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
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      deleted_at TIMESTAMPTZ,
      deletion_reason TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      artist_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      is_verified BOOLEAN NOT NULL DEFAULT false,
      verified BOOLEAN NOT NULL DEFAULT false,
      trust_score INT NOT NULL DEFAULT 100,
      strike_count INT NOT NULL DEFAULT 0,
      name VARCHAR(255),
      profile_image_url TEXT,
      artist_bio TEXT,
      portfolio_links TEXT[] NOT NULL DEFAULT '{}',
      onboarded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'FAN'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_bio TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_links TEXT[] NOT NULL DEFAULT '{}'").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");

  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score INT NOT NULL DEFAULT 100");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS strike_count INT NOT NULL DEFAULT 0");

  await pool.query("ALTER TABLE users ALTER COLUMN artist_status SET DEFAULT 'PENDING'").catch(() => undefined);
  await pool.query("ALTER TABLE users ALTER COLUMN is_deleted SET DEFAULT false").catch(() => undefined);
  await pool.query("ALTER TABLE users ALTER COLUMN trust_score SET DEFAULT 100").catch(() => undefined);
  await pool.query("ALTER TABLE users ALTER COLUMN strike_count SET DEFAULT 0").catch(() => undefined);

  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_users_artist_status ON users(artist_status)").catch(() => undefined);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted)").catch(() => undefined);
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
      lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
      is_approved BOOLEAN NOT NULL DEFAULT true,
      rejection_reason TEXT,
      report_count INT NOT NULL DEFAULT 0,
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
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS file_size_bytes INT");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255)");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS video_storage_key TEXT");

  await pool
    .query("ALTER TABLE content_items ALTER COLUMN lifecycle_state SET DEFAULT 'PUBLISHED'")
    .catch(() => undefined);
  await pool
    .query("ALTER TABLE content_items ALTER COLUMN is_approved SET DEFAULT true")
    .catch(() => undefined);

  await pool
    .query("ALTER TABLE content_items ALTER COLUMN status SET DEFAULT 'APPROVED'")
    .catch(() => undefined);

  await pool
    .query("ALTER TABLE content_items ALTER COLUMN report_count SET DEFAULT 0")
    .catch(() => undefined);

  // Idempotent: publish any legacy pending items.
  await pool
    .query(
      `UPDATE content_items
       SET is_approved = true,
           lifecycle_state = 'PUBLISHED',
           status = COALESCE(NULLIF(status, ''), 'APPROVED'),
           published_at = COALESCE(published_at, now()),
           rejection_reason = NULL
       WHERE COALESCE(is_approved, false) = false
         AND UPPER(COALESCE(lifecycle_state, 'DRAFT')) = 'DRAFT'`
    )
    .catch(() => undefined);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reason VARCHAR(80) NOT NULL,
      content_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason VARCHAR(80)");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS content_id INT");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS user_id INT");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()");

  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_content_user ON reports(content_id, user_id)"
  );
  await pool.query("CREATE INDEX IF NOT EXISTS idx_reports_content_id ON reports(content_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)");
}
