require('dotenv').config();
const { Client } = require('pg');

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    const userId = 9;

    // 1. Update subscription_count in users table
    const subs = await client.query('SELECT COUNT(*) FROM subscriptions WHERE user_id = $1', [userId]);
    const count = Number(subs.rows[0].count);
    await client.query('UPDATE users SET subscription_count = $1, total_listen_time = 125 WHERE id = $2', [count, userId]);

    // 2. Add some playback history to check listen calculation logic
    const content = await client.query('SELECT id FROM content_items LIMIT 1');
    if (content.rows[0]) {
      await client.query(`
        INSERT INTO playback_history (user_id, content_id, played_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING
      `, [userId, content.rows[0].id]);
    }

    console.log(`SUCCESS! Updated user stats: Subscriptions=${count}, ListenTime=125 mins.`);
  } catch (err) {
    console.error('Error seeding data:', err.message);
  } finally {
    await client.end();
  }
}

seed();
