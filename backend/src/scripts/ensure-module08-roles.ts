import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../common/db";

async function ensureRoles() {
  const hash = await bcrypt.hash("Password123!", 10);

  // 1. Moderator
  const modResult = await pool.query(`
    INSERT INTO users (email, password, role, status, is_verified, name)
    VALUES ('moderator@test.com', $1, 'MODERATOR', 'ACTIVE', true, 'Content Moderator')
    ON CONFLICT (email) DO UPDATE SET role = 'MODERATOR', status = 'ACTIVE'
    RETURNING id, email, role, status
  `, [hash]);
  console.log("MODERATOR:", modResult.rows[0]);

  // 2. Second Admin for Concurrent Admin Testing
  const admin2Result = await pool.query(`
    INSERT INTO users (email, password, role, status, is_verified, name)
    VALUES ('admin2@test.com', $1, 'ADMIN', 'ACTIVE', true, 'Secondary Administrator')
    ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', status = 'ACTIVE'
    RETURNING id, email, role, status
  `, [hash]);
  console.log("ADMIN 2:", admin2Result.rows[0]);

  await pool.end();
}

ensureRoles().catch(e => {
  console.error(e);
  process.exit(1);
});
