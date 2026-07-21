const { pool } = require('./src/common/db');

async function checkContent() {
  try {
    console.log('Checking content_items table...');
    
    const result = await pool.query(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN type = 'audio' THEN 1 ELSE 0 END) as audio_count,
             SUM(CASE WHEN type = 'video' THEN 1 ELSE 0 END) as video_count
      FROM content_items
    `);
    
    console.log('Content stats:', result.rows[0]);
    
    const content = await pool.query(`
      SELECT id, title, type, artist_id, is_approved, lifecycle_state, created_at
      FROM content_items
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('Recent content:', content.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkContent();
