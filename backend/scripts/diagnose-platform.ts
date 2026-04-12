import 'dotenv/config';
import { pool } from '../src/common/db';

async function diagnose() {
  const client = await pool.connect();
  
  try {
    console.log('=== PLATFORM SUBSCRIPTIONS DIAGNOSIS ===\n');
    
    // Check platform subscriptions with their payments
    const result = await client.query(`
      SELECT 
        s.id as subscription_id,
        s.user_id,
        s.created_at::text as created,
        u.email,
        COALESCE(t.amount/100, 0) as tx_amount,
        t.status as tx_status,
        p.id as payment_id,
        COALESCE(p.amount/100, 0) as payment_amount,
        CASE WHEN p.id IS NULL THEN 'MISSING' ELSE 'OK' END as payment_status
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN LATERAL (
        SELECT * FROM transactions 
        WHERE user_id = s.user_id 
          AND status = 'CAPTURED'
        ORDER BY date DESC
        LIMIT 1
      ) t ON true
      LEFT JOIN payments p ON p.subscription_id = s.id
      WHERE s.type = 'PLATFORM'
        AND s.status = 'ACTIVE'
      ORDER BY s.created_at DESC
      LIMIT 20
    `);
    
    console.log(`Found ${result.rows.length} PLATFORM subscriptions:\n`);
    
    let totalMissing = 0;
    let missingAmount = 0;
    
    result.rows.forEach((row, i) => {
      const status = row.payment_status === 'MISSING' ? '❌ MISSING' : '✅ OK';
      console.log(`${i+1}. User ${row.user_id} (${row.email})`);
      console.log(`   Sub ID: ${row.subscription_id}, Created: ${row.created}`);
      console.log(`   TX Amount: ₹${row.tx_amount}, Payment: ${status}`);
      if (row.payment_status === 'MISSING' && row.tx_amount > 0) {
        totalMissing++;
        missingAmount += Number(row.tx_amount);
      }
      console.log('');
    });
    
    console.log('=== SUMMARY ===');
    console.log(`Total subscriptions: ${result.rows.length}`);
    console.log(`Missing payments: ${totalMissing}`);
    console.log(`Missing amount: ₹${missingAmount}`);
    
    if (totalMissing > 0) {
      console.log('\n⚠️  There are missing payment records!');
      console.log('Run: npx ts-node scripts/backfill-platform-payments.ts');
    }
    
    // Show current analytics totals
    const totals = await client.query(`
      SELECT 
        COALESCE(SUM(p.amount)/100, 0)::float as payments_total
      FROM payments p
      WHERE p.status = 'SUCCESS'
    `);
    
    const txTotals = await client.query(`
      SELECT 
        COALESCE(SUM(amount)/100, 0)::float as tx_total
      FROM transactions
      WHERE status = 'CAPTURED'
    `);
    
    console.log('\n=== CURRENT TOTALS ===');
    console.log(`Payments table: ₹${totals.rows[0].payments_total}`);
    console.log(`Transactions table: ₹${txTotals.rows[0].tx_total}`);
    console.log(`Analytics uses: ₹${Math.max(totals.rows[0].payments_total, txTotals.rows[0].tx_total)}`);
    
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnose();
