/**
 * Diagnostic script to check payments table structure and data
 */

import 'dotenv/config';
import { pool } from '../src/common/db';

async function checkPaymentsTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Payments Table Structure and Data\n');
    
    // 1. Check table structure
    console.log('1️⃣ Payments Table Columns:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'payments'
      ORDER BY ordinal_position
    `);
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // 2. Check total payments
    console.log('\n2️⃣ Total Payments Count:');
    const countResult = await client.query(`SELECT COUNT(*) as count FROM payments`);
    console.log(`   Total: ${countResult.rows[0].count}`);
    
    // 3. Check payments by status
    console.log('\n3️⃣ Payments by Status:');
    const statusResult = await client.query(`
      SELECT status, COUNT(*) as count, SUM(amount)/100 as total_inr
      FROM payments 
      GROUP BY status
    `);
    statusResult.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} payments, ₹${row.total_inr || 0}`);
    });
    
    // 4. Check payments by subscription type
    console.log('\n4️⃣ Payments by Subscription Type:');
    const typeResult = await client.query(`
      SELECT s.type, COUNT(*) as count, SUM(p.amount)/100 as total_inr
      FROM payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      GROUP BY s.type
    `);
    if (typeResult.rows.length === 0) {
      console.log('   No payments with subscription links found');
    } else {
      typeResult.rows.forEach(row => {
        console.log(`   ${row.type}: ${row.count} payments, ₹${row.total_inr || 0}`);
      });
    }
    
    // 5. Recent payments (last 10)
    console.log('\n5️⃣ Recent Payments (last 10):');
    const recentResult = await client.query(`
      SELECT p.id, p.user_id, p.subscription_id, p.amount/100 as amount_inr, p.status, p.razorpay_payment_id, p.created_at, s.type as sub_type
      FROM payments p
      LEFT JOIN subscriptions s ON s.id = p.subscription_id
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    if (recentResult.rows.length === 0) {
      console.log('   No payments found');
    } else {
      recentResult.rows.forEach(p => {
        console.log(`   ₹${p.amount_inr} - ${p.status} - ${p.sub_type || 'unknown'} - ${p.created_at}`);
      });
    }
    
    // 6. Check for payments without subscription_id
    console.log('\n6️⃣ Payments without subscription_id:');
    const orphanResult = await client.query(`
      SELECT COUNT(*) as count, SUM(amount)/100 as total_inr
      FROM payments 
      WHERE subscription_id IS NULL
    `);
    console.log(`   Count: ${orphanResult.rows[0].count}, Amount: ₹${orphanResult.rows[0].total_inr || 0}`);
    
    // 7. Check PLATFORM subscriptions
    console.log('\n7️⃣ PLATFORM Subscriptions:');
    const platformSubs = await client.query(`
      SELECT s.id, s.user_id, s.status, s.created_at, u.email
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.type = 'PLATFORM'
      ORDER BY s.created_at DESC
      LIMIT 10
    `);
    if (platformSubs.rows.length === 0) {
      console.log('   No platform subscriptions found');
    } else {
      platformSubs.rows.forEach(s => {
        console.log(`   User ${s.user_id} (${s.email}): ${s.status} - ${s.created_at}`);
      });
    }
    
    // 8. Check for PLATFORM payments specifically
    console.log('\n8️⃣ PLATFORM Subscription Payments:');
    const platformPayments = await client.query(`
      SELECT p.id, p.user_id, p.amount/100 as amount_inr, p.status, p.created_at, s.id as sub_id
      FROM payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.type = 'PLATFORM'
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    if (platformPayments.rows.length === 0) {
      console.log('   ⚠️ NO PLATFORM PAYMENTS FOUND!');
    } else {
      platformPayments.rows.forEach(p => {
        console.log(`   ₹${p.amount_inr} - ${p.status} - Sub ${p.sub_id} - ${p.created_at}`);
      });
    }
    
    console.log('\n✅ Check complete!');
    
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkPaymentsTable();
