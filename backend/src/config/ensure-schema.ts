/**
 * Centralized schema management for the backend.
 * Ensures all tables and columns exist at startup to prevent 500 errors in routes.
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

  const queries = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'FAN'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_bio TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_links TEXT[] NOT NULL DEFAULT '{}'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score INT NOT NULL DEFAULT 100",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS strike_count INT NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_image_url TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_price NUMERIC NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_remarks TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_appeal_message TEXT",
    "ALTER TABLE users ALTER COLUMN artist_status SET DEFAULT 'PENDING'",
    "ALTER TABLE users ALTER COLUMN is_deleted SET DEFAULT false",
    "ALTER TABLE users ALTER COLUMN trust_score SET DEFAULT 100",
    "ALTER TABLE users ALTER COLUMN strike_count SET DEFAULT 0",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email)",
    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
    "CREATE INDEX IF NOT EXISTS idx_users_artist_status ON users(artist_status)",
    "CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted)"
  ];

  for (const q of queries) {
    await pool.query(q).catch(() => undefined);
  }
}

export async function ensureContentSchema(): Promise<void> {
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

  const contentQueries = [
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(20) DEFAULT 'local'",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS storage_key TEXT",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_storage_key TEXT",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS visibility VARCHAR(30) DEFAULT 'PROTECTED'",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'APPROVED'",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100)",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS file_size_bytes INT",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255)",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ",
    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS video_storage_key TEXT",
    "ALTER TABLE content_items ALTER COLUMN lifecycle_state SET DEFAULT 'PUBLISHED'",
    "ALTER TABLE content_items ALTER COLUMN is_approved SET DEFAULT true",
    "ALTER TABLE content_items ALTER COLUMN status SET DEFAULT 'APPROVED'",
    "ALTER TABLE content_items ALTER COLUMN report_count SET DEFAULT 0"
  ];

  for (const q of contentQueries) {
    await pool.query(q).catch(() => undefined);
  }

  // Reports table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reason VARCHAR(80),
      content_id INT,
      user_id INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_content_user ON reports(content_id, user_id)").catch(() => undefined);
}

export async function ensurePlaysSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_plays (
      id SERIAL PRIMARY KEY,
      content_id INT NOT NULL,
      user_id INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_content_plays_content_id ON content_plays(content_id)").catch(() => undefined);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_content_plays_created_at ON content_plays(created_at)").catch(() => undefined);
}

export async function ensureReactionsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_reactions (
      id SERIAL PRIMARY KEY,
      content_id INT NOT NULL,
      user_id INT NOT NULL,
      reaction VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reactions_unique ON content_reactions(content_id, user_id)").catch(() => undefined);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_content_reactions_content_id ON content_reactions(content_id)").catch(() => undefined);
}

export async function ensureSubscriptionsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      artist_id INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'INACTIVE',
      plan_type VARCHAR(50),
      start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      next_billing_date TIMESTAMPTZ,
      auto_renew BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  
  const subQueries = [
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'INACTIVE'",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT now()",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_artist ON subscriptions(user_id, artist_id)"
  ];

  for (const q of subQueries) {
    await pool.query(q).catch(() => undefined);
  }
}

export async function ensureArtistStatsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_stats (
      artist_id INT PRIMARY KEY,
      total_plays INT NOT NULL DEFAULT 0,
      total_subscribers INT NOT NULL DEFAULT 0,
      total_earnings NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => undefined);
}

// Deprecated alias for backward compatibility during cleanup if needed
export const ensureContentMediaColumns = ensureContentSchema;
