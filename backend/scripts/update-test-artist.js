const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateTestArtist() {
  try {
    console.log('Updating test artist with agreement data...\n');

    // Get first artist
    const artists = await pool.query(`
      SELECT id, name, email
      FROM users
      WHERE UPPER(role) = 'ARTIST'
      LIMIT 1
    `);

    if (artists.rows.length === 0) {
      console.log('❌ No artists found');
      return;
    }

    const artist = artists.rows[0];
    console.log(`Found artist: ${artist.name} (${artist.email})`);

    // Update with agreement data
    await pool.query(`
      UPDATE users
      SET agreement_accepted = true,
          agreement_accepted_at = NOW(),
          agreement_version = 'v1',
          terms_version = 'v1',
          artist_revenue_share = 55,
          platform_revenue_share = 45,
          agreement_status = 'ACTIVE',
          agreement_start_date = NOW(),
          agreement_id = 'AGR-2026-TEST-001',
          signature_signed_at = NOW(),
          digital_signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      WHERE id = $1
    `, [artist.id]);

    console.log('✓ Artist updated with agreement data');

    // Verify
    const updated = await pool.query('SELECT * FROM users WHERE id = $1', [artist.id]);
    console.log('\nUpdated agreement fields:');
    console.log(`  Agreement accepted: ${updated.rows[0].agreement_accepted}`);
    console.log(`  Agreement version: ${updated.rows[0].agreement_version}`);
    console.log(`  Terms version: ${updated.rows[0].terms_version}`);
    console.log(`  Revenue share: ${updated.rows[0].artist_revenue_share}%/${updated.rows[0].platform_revenue_share}%`);
    console.log(`  Agreement status: ${updated.rows[0].agreement_status}`);
    console.log(`  Agreement ID: ${updated.rows[0].agreement_id}`);
    console.log(`  Agreement start date: ${updated.rows[0].agreement_start_date}`);
    console.log(`  Signature signed at: ${updated.rows[0].signature_signed_at}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

updateTestArtist();
