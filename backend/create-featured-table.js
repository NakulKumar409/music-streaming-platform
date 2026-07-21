const { pool } = require('./src/common/db');

async function createFeaturedTable() {
  try {
    console.log('Creating featured_artists table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS featured_artists (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        display_order INTEGER DEFAULT 0,
        name VARCHAR(255),
        avatar TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ featured_artists table created');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_featured_artists_artist ON featured_artists(artist_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_featured_artists_active ON featured_artists(is_active)');
    console.log('✅ Indexes created');

    // Add some featured artists
    const artists = await pool.query(`
      SELECT id, name, profile_image_url 
      FROM users 
      WHERE role = 'ARTIST' 
      AND is_deleted = false 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log(`Found ${artists.rows.length} artists to feature`);

    for (const artist of artists.rows) {
      await pool.query(`
        INSERT INTO featured_artists (artist_id, name, avatar, is_active, display_order)
        VALUES ($1, $2, $3, true, $4)
        ON CONFLICT (artist_id) DO UPDATE SET is_active = true
      `, [artist.id, artist.name, artist.profile_image_url, artists.rows.indexOf(artist)]);
    }

    console.log('✅ Featured artists added');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createFeaturedTable();
