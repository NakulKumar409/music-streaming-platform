const { Pool } = require('pg');
require('dotenv').config();

async function check() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const res = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5');
    console.log("DB ROWS:", res.rows);
  } catch (e) {
    console.error("DB ERROR:", e);
  } finally {
    pool.end();
  }
}
check();
