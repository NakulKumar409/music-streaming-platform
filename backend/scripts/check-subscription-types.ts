import 'dotenv/config';
import { pool } from '../src/common/db';

async function checkSubscriptionTypes() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Subscription Types and Statuses\n');
    
    // Check all subscription types and statuses
    const result = await client.query(`
      SELECT 
        type,
        status,
        COUNT(*) as count
      FROM subscriptions
      GROUP BY type, status
      ORDER BY type, status
    `);
    
    console.log('Subscription Types & Statuses:');
    result.rows.forEach(row => {
      console.log(`  ${row.type} | ${row.status}: ${row.count}`);
    });
    
    // Check active PLATFORM subscriptions specifically
    console.log('\n📊 Active PLATFORM subscriptions:');
    const activePlatform = await client.query(`
      SELECT s.id, s.user_id, s.type, s.status, s.plan_type, u.email, s.created_at
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.type = 'PLATFORM'
        AND (s.status = 'ACTIVE' OR s.status = 'GRACE')
      ORDER BY s.created_at DESC
    `);
    
    if (activePlatform.rows.length === 0) {
      console.log('  ⚠️ No active PLATFORM subscriptions found!');
    } else {
      activePlatform.rows.forEach(s => {
        console.log(`  User ${s.user_id} (${s.email}): ${s.plan_type} - ${s.status}`);
      });
    }
    
    // Check what distinct types exist
    console.log('\n📋 All distinct subscription types:');
    const types = await client.query(`
      SELECT DISTINCT type FROM subscriptions ORDER BY type
    `);
    types.rows.forEach(t => {
      console.log(`  - '${t.type}'`);
    });
    
    // Check what distinct statuses exist
    console.log('\n📋 All distinct subscription statuses:');
    const statuses = await client.query(`
      SELECT DISTINCT status FROM subscriptions ORDER BY status
    `);
    statuses.rows.forEach(s => {
      console.log(`  - '${s.status}'`);
    });
    
    console.log('\n✅ Check complete!');
    
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSubscriptionTypes();
