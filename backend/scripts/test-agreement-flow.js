const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testAgreementFlow() {
  try {
    console.log('Testing Agreement Flow...\n');

    // Check if agreement fields are stored correctly
    const artist = await pool.query(`
      SELECT 
        id, 
        name, 
        email, 
        agreement_accepted,
        agreement_accepted_at,
        agreement_version,
        artist_revenue_share,
        platform_revenue_share,
        digital_signature,
        signature_signed_at,
        agreement_id,
        terms_version,
        agreement_status,
        agreement_start_date
      FROM users
      WHERE UPPER(role) = 'ARTIST'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (artist.rows.length === 0) {
      console.log('❌ No artists found');
      return;
    }

    const a = artist.rows[0];
    console.log('✓ Artist found:', a.name);
    console.log('\nAgreement Data:');
    console.log(`  Agreement Accepted: ${a.agreement_accepted}`);
    console.log(`  Agreement Accepted At: ${a.agreement_accepted_at}`);
    console.log(`  Agreement Version: ${a.agreement_version}`);
    console.log(`  Artist Revenue Share: ${a.artist_revenue_share}%`);
    console.log(`  Platform Revenue Share: ${a.platform_revenue_share}%`);
    console.log(`  Digital Signature: ${a.digital_signature ? 'Present (' + a.digital_signature.substring(0, 50) + '...)' : 'Missing'}`);
    console.log(`  Signature Signed At: ${a.signature_signed_at}`);
    console.log(`  Agreement ID: ${a.agreement_id}`);
    console.log(`  Terms Version: ${a.terms_version}`);
    console.log(`  Agreement Status: ${a.agreement_status}`);
    console.log(`  Agreement Start Date: ${a.agreement_start_date}`);

    // Check if all required fields are present
    const requiredFields = [
      'agreement_accepted',
      'agreement_version',
      'artist_revenue_share',
      'platform_revenue_share',
      'digital_signature',
      'agreement_id',
      'terms_version',
      'agreement_status',
      'agreement_start_date'
    ];

    console.log('\nField Validation:');
    let allPresent = true;
    requiredFields.forEach(field => {
      const present = a[field] !== null && a[field] !== undefined;
      console.log(`  ${field}: ${present ? '✓' : '❌'}`);
      if (!present) allPresent = false;
    });

    if (allPresent) {
      console.log('\n✅ All agreement fields are present in database');
      console.log('✅ Web-admin should be able to display all this data');
      console.log('✅ PDF generation should work with this data');
    } else {
      console.log('\n❌ Some fields are missing');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testAgreementFlow();
