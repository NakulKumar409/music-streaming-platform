/**
 * Debug Script: Check Revenue Data
 * Run this to verify if payments are being recorded correctly
 */

import 'dotenv/config';
import { pool } from '../src/common/db';

async function checkRevenue() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Revenue Data\n');
    
    // 1. Check all payments
    console.log('1️⃣ All Payments:');
    const payments = await client.query(`
      SELECT p.id, p.user_id, p.subscription_id, p.amount, p.status, p.created_at, s.type as sub_type
      FROM payments p
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    
    if (payments.rows.length === 0) {
      console.log('   ⚠️  NO PAYMENTS FOUND in payments table!');
    } else {
      payments.rows.forEach(p => {
        console.log(`   💰 ₹${p.amount/100} - ${p.status} - ${p.sub_type || 'unknown'} - ${p.created_at}`);
      });
    }
    
    // 2. Check today's payments
    console.log('\n2️⃣ Today\'s Payments:');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPayments = await client.query(`
      SELECT p.id, p.user_id, p.amount, p.status, p.created_at, s.type as sub_type
      FROM payments p
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      WHERE p.created_at >= $1
      ORDER BY p.created_at DESC
    `, [today.toISOString()]);
    
    if (todayPayments.rows.length === 0) {
      console.log('   ⚠️  NO PAYMENTS TODAY');
    } else {
      todayPayments.rows.forEach(p => {
        console.log(`   💰 ₹${p.amount/100} - ${p.status} - ${p.sub_type || 'unknown'} - ${p.created_at}`);
      });
    }
    
    // 3. Check subscriptions
    console.log('\n3️⃣ Recent Subscriptions:');
    const subs = await client.query(`
      SELECT s.id, s.user_id, s.type, s.status, s.artist_id, s.created_at
      FROM subscriptions s
      ORDER BY s.created_at DESC
      LIMIT 10
    `);
    
    subs.rows.forEach(s => {
      console.log(`   📦 ${s.type} - ${s.status} - User ${s.user_id} - ${s.created_at}`);
    });
    
    // 4. Check PLATFORM subscriptions specifically
    console.log('\n4️⃣ PLATFORM Subscriptions:');
    const platformSubs = await client.query(`
      SELECT s.id, s.user_id, s.status, s.created_at
      FROM subscriptions s
      WHERE s.type = 'PLATFORM'
      ORDER BY s.created_at DESC
    `);
    
    if (platformSubs.rows.length === 0) {
      console.log('   ⚠️  NO PLATFORM SUBSCRIPTIONS');
    } else {
      platformSubs.rows.forEach(s => {
        console.log(`   📱 User ${s.user_id} - ${s.status} - ${s.created_at}`);
      });
    }
    
    // 5. Check for payments linked to PLATFORM subs
    console.log('\n5️⃣ Payments for PLATFORM Subscriptions:');
    const platformPayments = await client.query(`
      SELECT p.id, p.user_id, p.amount, p.status, p.created_at, s.id as sub_id
      FROM payments p
      JOIN subscriptions s ON p.subscription_id = s.id
      WHERE s.type = 'PLATFORM'
      ORDER BY p.created_at DESC
    `);
    
    if (platformPayments.rows.length === 0) {
      console.log('   ⚠️  NO PAYMENTS FOR PLATFORM SUBSCRIPTIONS!');
      console.log('   This means the payment recording is NOT working.');
    } else {
      platformPayments.rows.forEach(p => {
        console.log(`   💰 ₹${p.amount/100} - ${p.status} - Sub ${p.sub_id} - ${p.created_at}`);
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

checkRevenue();
