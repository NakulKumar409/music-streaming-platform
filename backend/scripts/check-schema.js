const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
    console.log('Checking database schema...\n');

    // Check users table columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN (
        'agreement_accepted',
        'agreement_accepted_at',
        'agreement_version',
        'artist_revenue_share',
        'platform_revenue_share',
        'digital_signature',
        'signature_signed_at',
        'agreement_id',
        'terms_version',
        'agreement_status',
        'agreement_start_date',
        'agreement_pdf_path'
      )
      ORDER BY ordinal_position
    `);

    console.log('Users table agreement columns:');
    if (columnsResult.rows.length === 0) {
      console.log('❌ No agreement columns found in users table!');
    } else {
      columnsResult.rows.forEach(col => {
        console.log(`✓ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check revenue_share_configs table
    const revenueTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'revenue_share_configs'
      )
    `);

    console.log('\nRevenue share configs table:');
    if (revenueTableCheck.rows[0].exists) {
      console.log('✓ Table exists');
      const revenueConfigs = await pool.query('SELECT * FROM revenue_share_configs ORDER BY created_at DESC LIMIT 3');
      console.log('  Latest configs:', revenueConfigs.rows.map(r => `${r.version}: ${r.artist_share}%/${r.platform_share}%`));
    } else {
      console.log('❌ Table does not exist');
    }

    // Check terms_versions table
    const termsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'terms_versions'
      )
    `);

    console.log('\nTerms versions table:');
    if (termsTableCheck.rows[0].exists) {
      console.log('✓ Table exists');
      const termsVersions = await pool.query('SELECT version, is_active FROM terms_versions ORDER BY created_at DESC LIMIT 3');
      console.log('  Latest versions:', termsVersions.rows.map(t => `${t.version} (active: ${t.is_active})`));
    } else {
      console.log('❌ Table does not exist');
    }

    // Check sample artist data
    const sampleArtist = await pool.query(`
      SELECT id, name, email, agreement_accepted, agreement_version, terms_version, artist_revenue_share
      FROM users
      WHERE UPPER(role) = 'ARTIST'
      LIMIT 1
    `);

    console.log('\nSample artist data:');
    if (sampleArtist.rows.length > 0) {
      const artist = sampleArtist.rows[0];
      console.log(`✓ Artist: ${artist.name} (${artist.email})`);
      console.log(`  Agreement accepted: ${artist.agreement_accepted}`);
      console.log(`  Agreement version: ${artist.agreement_version}`);
      console.log(`  Terms version: ${artist.terms_version}`);
      console.log(`  Artist revenue share: ${artist.artist_revenue_share}`);
    } else {
      console.log('❌ No artists found in database');
    }

  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
