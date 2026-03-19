import dotenv from "dotenv";
dotenv.config();

import { pool } from "../common/db";

async function ensureSchema() {
  await pool
    .query("ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'")
    .catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN").catch(() => undefined);
  await pool.query("ALTER TABLE users ALTER COLUMN artist_status SET DEFAULT 'PENDING'").catch(() => undefined);
}

async function run() {
  try {
    await ensureSchema();

    const r = await pool.query(
      `UPDATE users
       SET artist_status = 'APPROVED',
           is_verified = true,
           verified = true,
           updated_at = COALESCE(updated_at, now())
       WHERE UPPER(role) = 'ARTIST'
         AND COALESCE(is_verified, verified, false) = true
         AND UPPER(COALESCE(artist_status, 'PENDING')) <> 'APPROVED'
       RETURNING id`
    );

    console.log(
      `[AUDIT] ${JSON.stringify({
        event: "backfill_artist_status_approved",
        updatedCount: r.rowCount ?? 0
      })}`
    );
  } catch (err: any) {
    console.error("backfill failed", err?.message || err);
    process.exitCode = 1;
  } finally {
    try {
      await pool.end();
    } catch {
      // ignore
    }
  }
}

run();
