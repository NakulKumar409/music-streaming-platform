import { pool } from "../common/db";

async function runMigrations() {
  console.log("=== RUNNING ABUSE CONTROL MIGRATIONS ===");
  try {
    // 1. Playback Sessions Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playback_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        content_id INTEGER NOT NULL,
        heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        started_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_playback_sessions_user ON playback_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_playback_sessions_heartbeat ON playback_sessions(heartbeat_at);
    `);
    console.log("-> Table 'playback_sessions' created/verified.");

    console.log("=== ABUSE CONTROL MIGRATIONS COMPLETED SUCCESSFULLY ===");
  } catch (err: any) {
    console.error("!!! MIGRATION FAILED !!!", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigrations();
