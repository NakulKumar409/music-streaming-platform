const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'seraj2@gmail.com'");
    if (userRes.rows.length === 0) {
      console.log("User not found");
      return;
    }
    const userId = userRes.rows[0].id;
    console.log("User ID:", userId);

    const subs = await pool.query("SELECT id, artist_id, type, status, next_billing_date FROM subscriptions WHERE user_id = $1", [userId]);
    console.log("Subscriptions:", subs.rows);

    const content = await pool.query("SELECT id, title, artist_id, subscription_required FROM content_items WHERE title LIKE '%artist subscription%' LIMIT 5");
    console.log("Relevant Content:", content.rows);

    const artistIds = subs.rows.filter(s => s.type === 'ARTIST').map(s => s.artist_id);
    if (artistIds.length > 0) {
        const artists = await pool.query("SELECT id, name FROM users WHERE id = ANY($1::int[])", [artistIds]);
        console.log("Subscribed Artists:", artists.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
