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
    const userId = 9; // User: mdmainuddin1289@gmail.com
    const artistId = 1; // Assuming artist ID 1 exists
    
    // Check if artist 1 exists, if not find any artist
    const artists = await client.query('SELECT id FROM users WHERE role = \'ARTIST\' LIMIT 1');
    const actualArtistId = artists.rows[0]?.id || 1;

    console.log(`Seeding test subscription for user ${userId} and artist ${actualArtistId}...`);

    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(now.getMonth() + 1);

    await client.query(`
      INSERT INTO subscriptions (user_id, artist_id, status, plan_type, start_date, next_billing_date, auto_renew)
      VALUES ($1, $2, 'ACTIVE', 'MONTHLY', $3, $4, true)
      ON CONFLICT (user_id, artist_id) DO UPDATE 
      SET status = 'ACTIVE', 
          plan_type = 'MONTHLY', 
          next_billing_date = $4,
          updated_at = NOW()
    `, [userId, actualArtistId, now, nextMonth]);

    console.log('SUCCESS! Test subscription created.');
  } catch (err) {
    console.error('Error seeding data:', err.message);
  } finally {
    await client.end();
  }
}

seed();
