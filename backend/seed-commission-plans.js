require('dotenv').config();
const { Client } = require('pg');

async function seedCommissionPlans() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Define the 4 standard commission plans as per PDF
    const plans = [
      {
        version: 'basic',
        artist_share: 70,
        platform_share: 30,
        is_active: false
      },
      {
        version: 'growth',
        artist_share: 65,
        platform_share: 35,
        is_active: false
      },
      {
        version: 'pro',
        artist_share: 60,
        platform_share: 40,
        is_active: false
      },
      {
        version: 'managed',
        artist_share: 55,
        platform_share: 45,
        is_active: false
      }
    ];

    // Clear existing plans (optional - comment out if you want to keep existing)
    console.log('Clearing existing commission plans...');
    await client.query('DELETE FROM revenue_share_configs');

    // Insert the 4 standard plans
    for (const plan of plans) {
      const result = await client.query(
        `INSERT INTO revenue_share_configs (version, artist_share, platform_share, effective_from, is_active)
         VALUES ($1, $2, $3, NOW(), $4)
         RETURNING id, version, artist_share, platform_share`,
        [plan.version, plan.artist_share, plan.platform_share, plan.is_active]
      );
      console.log(`Created plan: ${result.rows[0].version} - Artist: ${result.rows[0].artist_share}%, Platform: ${result.rows[0].platform_share}%`);
    }

    // Set 'basic' as active by default
    await client.query(
      `UPDATE revenue_share_configs SET is_active = true WHERE version = 'basic'`
    );
    console.log('Set "basic" plan as active');

    console.log('\nCommission plans seeded successfully!');
    console.log('\nPlan Summary:');
    console.log('1. Basic: 70% Artist, 30% Platform - Standard Streaming, Artist Dashboard, Basic Analytics');
    console.log('2. Growth: 65% Artist, 35% Platform - Standard Streaming, Promotional Support, Advanced Analytics');
    console.log('3. Pro: 60% Artist, 40% Platform - Promotion, Featured Placement');
    console.log('4. Managed: 55% Artist, 45% Platform - Priority Promotion, Artist Management Support');

  } catch (error) {
    console.error('Error seeding commission plans:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

seedCommissionPlans();
