/**
 * Quick diagnostic to check payments data
 */

import 'dotenv/config';
import { pool } from '../src/common/db';

async function quickCheck() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Quick Payment Check\n');
    
    // 1. Total from payments table
    const paymentsTotal = await client.query(`
      SELECT COALESCE(SUM(amount)/100, 0)::float as total 
      FROM payments 
      WHERE UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID'
    `);
    console.log('1️⃣ Payments table total:', '₹' + paymentsTotal.rows[0].total);
    
    // 2. Total from transactions table  
    const txTotal = await client.query(`
      SELECT COALESCE(SUM(amount)/100, 0)::float as total 
      FROM transactions 
      WHERE UPPER(status) = 'CAPTURED' OR UPPER(status) = 'SUCCESS'
    `);
    console.log('2️⃣ Transactions table total:', '₹' + txTotal.rows[0].total);
    
    // 3. Recent transactions
    console.log('\n3️⃣ Recent CAPTURED transactions:');
    const recentTx = await client.query(`
      SELECT id, user_id, amount/100 as amt, status, date, razorpay_payment_id
      FROM transactions 
      WHERE status = 'CAPTURED'
      ORDER BY date DESC
      LIMIT 5
    `);
    recentTx.rows.forEach(tx => {
      console.log(`   User ${tx.user_id}: ₹${tx.amt} on ${tx.date} (ID: ${tx.id})`);
    });
    
    // 4. Recent payments
    console.log('\n4️⃣ Recent SUCCESS payments:');
    const recentPay = await client.query(`
      SELECT p.id, p.user_id, p.amount/100 as amt, p.status, p.created_at, s.type as sub_type
      FROM payments p
      LEFT JOIN subscriptions s ON s.id = p.subscription_id
      WHERE p.status = 'SUCCESS'
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    recentPay.rows.forEach(p => {
      console.log(`   User ${p.user_id}: ₹${p.amt} - ${p.sub_type || 'unknown'} on ${p.created_at}`);
    });
    
    // 5. Platform subscriptions without payments
    console.log('\n5️⃣ PLATFORM subscriptions without payments:');
    const missing = await client.query(`
      SELECT s.id, s.user_id, s.created_at, u.email
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN payments p ON p.subscription_id = s.id
      WHERE s.type = 'PLATFORM'
        AND s.status = 'ACTIVE'
        AND p.id IS NULL
      ORDER BY s.created_at DESC
      LIMIT 10
    `);
    if (missing.rows.length === 0) {
      console.log('   ✅ All PLATFORM subscriptions have payment records');
    } else {
      missing.rows.forEach(s => {
        console.log(`   User ${s.user_id} (${s.email}): Sub ${s.id} created ${s.created_at}`);
      });
    }
    
    // 6. PLATFORM subscriptions WITH payments
    console.log('\n6️⃣ PLATFORM subscriptions WITH payments:');
    const withPay = await client.query(`
      SELECT s.id, s.user_id, p.amount/100 as amt, p.created_at
      FROM subscriptions s
      JOIN payments p ON p.subscription_id = s.id
      WHERE s.type = 'PLATFORM'
        AND s.status = 'ACTIVE'
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    if (withPay.rows.length === 0) {
      console.log('   ❌ No PLATFORM payments found');
    } else {
      withPay.rows.forEach(p => {
        console.log(`   User ${p.user_id}: ₹${p.amt} on ${p.created_at}`);
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

quickCheck();
