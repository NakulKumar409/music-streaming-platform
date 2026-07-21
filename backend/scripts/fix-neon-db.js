const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_xP6R4KpYIEGV@ep-little-sunset-aiysaj7x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function fixDatabase() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing Neon DB...');

        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
            UPDATE users SET full_name = email WHERE full_name IS NULL;
            
            CREATE TABLE IF NOT EXISTS featured_artists (
                id SERIAL PRIMARY KEY,
                artist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                display_order INTEGER DEFAULT 0,
                featured_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            );
            CREATE INDEX IF NOT EXISTS idx_featured_artists_artist ON featured_artists(artist_id);
            CREATE INDEX IF NOT EXISTS idx_featured_artists_active ON featured_artists(is_active);
            
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(255) NOT NULL,
                resource_type VARCHAR(100),
                resource_id VARCHAR(100),
                details JSONB DEFAULT '{}',
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50),
                error_message TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
        `);

        console.log('✅ All fixes applied successfully!');

        const result = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name
        `);
        console.log('📊 Tables:', result.rows.map(r => r.table_name).join(', '));

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

fixDatabase();