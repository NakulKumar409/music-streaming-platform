require('dotenv').config();
const { pool } = require('./src/common/db');

async function check() {
  try {
    const res = await pool.query('SELECT id, email, expo_push_token, notifications_pref FROM users WHERE expo_push_token IS NOT NULL');
    console.log('Users with push tokens:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error checking DB:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

check();
