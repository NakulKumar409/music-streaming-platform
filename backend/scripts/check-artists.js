const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkArtists() {
  try {
    console.log('Checking artists with agreement data...\n');

    const artists = await pool.query(`
      SELECT id, name, email, agreement_accepted, agreement_version, terms_version, 
             artist_revenue_share, platform_revenue_share, agreement_status, agreement_id
      FROM users
      WHERE UPPER(role) = 'ARTIST'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`Found ${artists.rows.length} artists:`);
    artists.rows.forEach(artist => {
      console.log(`\n${artist.name} (${artist.email})`);
      console.log(`  Agreement accepted: ${artist.agreement_accepted}`);
      console.log(`  Agreement version: ${artist.agreement_version}`);
      console.log(`  Terms version: ${artist.terms_version}`);
      console.log(`  Revenue share: ${artist.artist_revenue_share}%/${artist.platform_revenue_share}%`);
      console.log(`  Agreement status: ${artist.agreement_status}`);
      console.log(`  Agreement ID: ${artist.agreement_id}`);
    });

    // Update one artist to have agreement data for testing
    if (artists.rows.length > 0) {
      const testArtist = artists.rows[0];
      console.log(`\n\nUpdating test artist (${testArtist.name}) with sample agreement data...`);
      
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
            agreement_id = 'AGR-TEST-001',
            signature_signed_at = NOW()
        WHERE id = $1
      `, [testArtist.id]);

      console.log('✓ Test artist updated with agreement data');
      
      // Verify the update
      const updated = await pool.query('SELECT * FROM users WHERE id = $1', [testArtist.id]);
      console.log('\nUpdated artist agreement fields:');
      console.log(`  Agreement accepted: ${updated.rows[0].agreement_accepted}`);
      console.log(`  Agreement version: ${updated.rows[0].agreement_version}`);
      console.log(`  Terms version: ${updated.rows[0].terms_version}`);
      console.log(`  Revenue share: ${updated.rows[0].artist_revenue_share}%/${updated.rows[0].platform_revenue_share}%`);
      console.log(`  Agreement status: ${updated.rows[0].agreement_status}`);
      console.log(`  Agreement ID: ${updated.rows[0].agreement_id}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkArtists();
