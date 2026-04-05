require('dotenv').config();
const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    const res = await client.query('SELECT id, email, expo_push_token, notifications_pref FROM users WHERE expo_push_token IS NOT NULL');
    console.log('SUCCESS! These users have real push tokens registered in the database:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error connecting to DB:', err.message);
  } finally {
    await client.end();
  }
}

check();
