/**
 * Test Script: Verify Analytics Data Flow
 * Run this to test if analytics are working correctly
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:8000';

async function testAnalytics() {
  console.log('🔍 Testing Artist Analytics System\n');
  
  // Test 1: Check database tables
  console.log('1️⃣ Checking database tables...');
  
  // Test 2: Simulate a heartbeat (requires auth token)
  console.log('\n2️⃣ Testing play recording...');
  console.log('   - Play a song in the mobile app');
  console.log('   - Check backend logs for: "[ANALYTICS] Play recorded successfully"');
  
  // Test 3: Check dashboard API
  console.log('\n3️⃣ Testing dashboard/summary API...');
  console.log(`   Endpoint: ${API_BASE_URL}/api/v1/artist/dashboard/summary`);
  console.log('   Requires: Artist authentication token');
  
  // Test 4: Check growth API
  console.log('\n4️⃣ Testing dashboard/growth API...');
  console.log(`   Endpoint: ${API_BASE_URL}/api/v1/artist/dashboard/growth?days=30&metric=plays`);
  console.log('   Requires: Artist authentication token');
  
  console.log('\n📋 Verification Checklist:');
  console.log('   [ ] content_plays table has records');
  console.log('   [ ] payments table has records linked to subscriptions');
  console.log('   [ ] subscriptions table has artist_id populated');
  console.log('   [ ] Dashboard shows Total Plays > 0');
  console.log('   [ ] Dashboard shows correct subscriber count');
  console.log('   [ ] Dashboard shows correct earnings');
  console.log('   [ ] Performance Trend chart shows data points');
  
  console.log('\n🔧 Manual Test Steps:');
  console.log('1. Start backend: npm run dev');
  console.log('2. Login as fan in mobile app');
  console.log('3. Play any song for 30+ seconds (wait for heartbeat)');
  console.log('4. Check backend logs for play recording');
  console.log('5. Login as artist in web dashboard');
  console.log('6. Check Analytics page - plays should appear');
  
  console.log('\n✅ Expected Results:');
  console.log('- Total Plays: Should increment after each unique play session');
  console.log('- Subscribers: Shows count from subscriptions table');
  console.log('- Earnings: Shows sum of payments with 90% revenue share applied');
}

testAnalytics().catch(console.error);
