/**
 * Script to diagnose and fix pending artists not showing
 * Run: npx ts-node -r dotenv/config scripts/fix-pending-artists.ts
 */

import { pool } from '../src/common/db';

async function diagnoseAndFix() {
  const client = await pool.connect();
  
  try {
    console.log('[DIAGNOSE] Checking pending artists issue...\n');
    
    // 1. Check if artist_status column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'artist_status'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('[FIX] Creating artist_status column...');
      await client.query(`ALTER TABLE users ADD COLUMN artist_status VARCHAR(20) DEFAULT 'PENDING'`);
      console.log('[FIX] Column created');
    } else {
      console.log('[OK] artist_status column exists');
    }
    
    // 2. Find all ARTIST users
    const artists = await client.query(`
      SELECT id, email, name, role, artist_status, is_verified, verified, created_at, onboarded_at
      FROM users 
      WHERE UPPER(role) = 'ARTIST'
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log(`\n[DIAGNOSE] Found ${artists.rows.length} ARTIST users:`);
    for (const a of artists.rows) {
      console.log(`  ID: ${a.id}, Email: ${a.email}, Status: ${a.artist_status || 'NULL'}, Role: ${a.role}`);
    }
    
    // 3. Check what the pending query would return
    const pending = await client.query(`
      SELECT id, email, name, artist_status
      FROM users
      WHERE UPPER(role) = 'ARTIST'
        AND (
          UPPER(COALESCE(artist_status, 'PENDING')) = 'PENDING'
          OR (
            UPPER(COALESCE(artist_status, 'PENDING')) = 'REJECTED'
            AND NULLIF(TRIM(COALESCE(artist_appeal_message, '')), '') IS NOT NULL
          )
        )
    `);
    
    console.log(`\n[DIAGNOSE] Pending artists query returns: ${pending.rows.length} artists`);
    for (const p of pending.rows) {
      console.log(`  ID: ${p.id}, Email: ${p.email}, Status: ${p.artist_status}`);
    }
    
    // 4. Fix any artists with NULL status
    const nullStatus = artists.rows.filter(a => !a.artist_status);
    if (nullStatus.length > 0) {
      console.log(`\n[FIX] Setting PENDING status for ${nullStatus.length} artists with NULL status...`);
      for (const artist of nullStatus) {
        await client.query(
          `UPDATE users SET artist_status = 'PENDING', onboarded_at = COALESCE(onboarded_at, now()) WHERE id = $1`,
          [artist.id]
        );
        console.log(`[FIX] Updated artist ${artist.id} (${artist.email}) to PENDING`);
      }
    }
    
    // 5. Also ensure is_verified defaults are set
    const unverified = await client.query(`
      SELECT id FROM users 
      WHERE UPPER(role) = 'ARTIST' 
      AND artist_status = 'PENDING'
      AND (is_verified IS NULL OR is_verified = false)
    `);
    
    console.log(`\n[OK] ${unverified.rows.length} artists are pending approval`);
    
    console.log('\n[COMPLETE] Run the admin dashboard again to see pending artists');
    
  } catch (error: any) {
    console.error('[ERROR]', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseAndFix();
