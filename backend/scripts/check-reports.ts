/**
 * Debug Script: Check Reports Data
 */

import 'dotenv/config';
import { pool } from '../src/common/db';

async function checkReports() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Reports Data\n');
    
    // 1. Check all reports
    console.log('1️⃣ All Reports in reports table:');
    const reports = await client.query(`
      SELECT r.id, r.content_id, r.user_id, r.reason, r.created_at, c.title, c.status
      FROM reports r
      JOIN content_items c ON r.content_id = c.id
      ORDER BY r.created_at DESC
      LIMIT 10
    `);
    
    if (reports.rows.length === 0) {
      console.log('   ⚠️  NO REPORTS FOUND');
    } else {
      reports.rows.forEach(r => {
        console.log(`   🚩 Content "${r.title}" (ID: ${r.content_id}) - Reason: ${r.reason} - Content Status: ${r.status}`);
      });
    }
    
    // 2. Check content_items with report_count
    console.log('\n2️⃣ Content Items with report_count > 0:');
    const contentWithReports = await client.query(`
      SELECT id, title, report_count, status, artist_id
      FROM content_items
      WHERE COALESCE(report_count, 0) > 0
      ORDER BY report_count DESC
    `);
    
    if (contentWithReports.rows.length === 0) {
      console.log('   ⚠️  NO CONTENT WITH REPORTS');
    } else {
      contentWithReports.rows.forEach(c => {
        console.log(`   📄 "${c.title}" - Reports: ${c.report_count} - Status: ${c.status}`);
      });
    }
    
    // 3. Check FLAGGED content
    console.log('\n3️⃣ FLAGGED Content (status = FLAGGED):');
    const flagged = await client.query(`
      SELECT id, title, report_count, status, artist_id
      FROM content_items
      WHERE UPPER(COALESCE(status, '')) = 'FLAGGED'
    `);
    
    console.log(`   Query found: ${flagged.rows.length} flagged items`);
    flagged.rows.forEach(c => {
      console.log(`   🚩 "${c.title}" - Reports: ${c.report_count} - Status: ${c.status}`);
    });
    
    // 4. Test the exact query from admin analytics (OLD vs NEW)
    console.log('\n4️⃣ Testing admin analytics queries:');
    const oldQuery = await client.query(`
      SELECT COUNT(*)::int as value FROM content_items WHERE UPPER(COALESCE(status, '')) = 'FLAGGED'
    `);
    console.log(`   OLD Query (FLAGGED only): ${oldQuery.rows[0]?.value} active reports`);
    
    const newQuery = await client.query(`
      SELECT COUNT(*)::int as value FROM content_items WHERE (UPPER(COALESCE(status, '')) = 'FLAGGED' OR report_count > 0) AND UPPER(COALESCE(status, '')) != 'DELETED'
    `);
    console.log(`   NEW Query (FLAGGED or report_count > 0, not DELETED): ${newQuery.rows[0]?.value} active reports`);
    
    // 5. Check for any case-sensitivity issues
    console.log('\n5️⃣ All distinct status values:');
    const statuses = await client.query(`
      SELECT DISTINCT status, COUNT(*) as count
      FROM content_items
      WHERE status IS NOT NULL
      GROUP BY status
    `);
    statuses.rows.forEach(s => {
      console.log(`   Status: "${s.status}" - Count: ${s.count}`);
    });
    
    console.log('\n✅ Check complete!');
    
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkReports();
