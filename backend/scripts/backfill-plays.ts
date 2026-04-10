/**
 * Backfill Script: Populate content_plays from existing playback_sessions
 * Run this to migrate existing session data to the analytics content_plays table
 */

import { pool } from '../src/common/db';
import { logger } from '../src/common/logger';

async function backfillPlays() {
  const client = await pool.connect();
  
  try {
    logger.info('[BACKFILL] Starting plays backfill from playback_sessions...');
    
    // Count existing sessions that should be converted to plays
    const countResult = await client.query(`
      SELECT COUNT(*) as total 
      FROM playback_sessions ps
      WHERE NOT EXISTS (
        SELECT 1 FROM content_plays cp 
        WHERE cp.user_id = ps.user_id 
        AND cp.content_id = ps.content_id
        AND cp.created_at >= ps.started_at
      )
    `);
    
    const totalToMigrate = Number(countResult.rows[0].total);
    logger.info(`[BACKFILL] Found ${totalToMigrate} sessions to migrate`);
    
    if (totalToMigrate === 0) {
      logger.info('[BACKFILL] No sessions need migration. Exiting.');
      return;
    }
    
    // Insert plays from sessions
    const insertResult = await client.query(`
      INSERT INTO content_plays (content_id, user_id, created_at)
      SELECT content_id, user_id, started_at
      FROM playback_sessions ps
      WHERE NOT EXISTS (
        SELECT 1 FROM content_plays cp 
        WHERE cp.user_id = ps.user_id 
        AND cp.content_id = ps.content_id
        AND cp.created_at >= ps.started_at
      )
      ON CONFLICT DO NOTHING
    `);
    
    const insertedCount = insertResult.rowCount || 0;
    logger.info(`[BACKFILL] Successfully migrated ${insertedCount} plays`);
    
    // Update artist_stats based on actual content_plays
    logger.info('[BACKFILL] Updating artist_stats...');
    
    const artistStatsResult = await client.query(`
      SELECT c.artist_id, COUNT(*) as play_count
      FROM content_plays p
      JOIN content_items c ON c.id = p.content_id
      GROUP BY c.artist_id
    `);
    
    for (const row of artistStatsResult.rows) {
      const artistId = Number(row.artist_id);
      const playCount = Number(row.play_count);
      
      await client.query(`
        INSERT INTO artist_stats (artist_id, total_plays, updated_at)
        VALUES ($1, $2, now())
        ON CONFLICT (artist_id)
        DO UPDATE SET total_plays = $2, updated_at = now()
      `, [artistId, playCount]);
      
      logger.info(`[BACKFILL] Updated artist ${artistId} with ${playCount} plays`);
    }
    
    logger.info('[BACKFILL] Backfill completed successfully!');
    
  } catch (error) {
    logger.error({ error }, '[BACKFILL] Error during backfill');
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  backfillPlays()
    .then(() => {
      console.log('Backfill completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Backfill failed:', error);
      process.exit(1);
    });
}

export { backfillPlays };
