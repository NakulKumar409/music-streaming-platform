import dotenv from "dotenv";
dotenv.config();
import { pool } from "../common/db";

async function migrate() {
  console.log("Starting Advanced Monetization Migration...");

  try {
    // 1. Create user_sessions table
    console.log("Creating user_sessions table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL,
        device_name TEXT,
        token_id TEXT,
        last_active_at TIMESTAMP DEFAULT now(),
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    `);

    // 2. Add first_month_price to platform_subscription_configs
    console.log("Adding first_month_price to platform_subscription_configs...");
    await pool.query(`
      ALTER TABLE platform_subscription_configs 
      ADD COLUMN IF NOT EXISTS first_month_price NUMERIC(10, 2);
    `);

    // 3. Add locked_clicks_count to user_engagement (for analytics/smart upsell)
    console.log("Creating user_engagement table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_engagement (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_id INTEGER,
        event_type TEXT NOT NULL, -- 'LOCKED_CLICK', 'PREVIEW_START', etc.
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_user_engagement_user_id ON user_engagement(user_id);
    `);

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
