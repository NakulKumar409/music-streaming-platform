const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log('Starting migration...');

    // Add agreement fields to users table
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_accepted BOOLEAN DEFAULT false
    `);
    console.log('✓ Added agreement_accepted column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ
    `);
    console.log('✓ Added agreement_accepted_at column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_version VARCHAR(20)
    `);
    console.log('✓ Added agreement_version column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_revenue_share INT
    `);
    console.log('✓ Added artist_revenue_share column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_revenue_share INT
    `);
    console.log('✓ Added platform_revenue_share column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS digital_signature TEXT
    `);
    console.log('✓ Added digital_signature column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_signed_at TIMESTAMPTZ
    `);
    console.log('✓ Added signature_signed_at column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_id VARCHAR(100)
    `);
    console.log('✓ Added agreement_id column');

    // Create index on agreement_id
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_agreement_id ON users(agreement_id)
    `);
    console.log('✓ Created index on agreement_id');

    // Create revenue_share_configs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS revenue_share_configs (
        id SERIAL PRIMARY KEY,
        version VARCHAR(20) UNIQUE NOT NULL,
        artist_share INT NOT NULL,
        platform_share INT NOT NULL,
        effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created revenue_share_configs table');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_revenue_share_configs_version ON revenue_share_configs(version)
    `);
    console.log('✓ Created index on revenue_share_configs.version');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_revenue_share_configs_effective_from ON revenue_share_configs(effective_from)
    `);
    console.log('✓ Created index on revenue_share_configs.effective_from');

    // Insert default revenue share configuration
    await pool.query(`
      INSERT INTO revenue_share_configs (version, artist_share, platform_share)
      VALUES ('v1', 55, 45)
      ON CONFLICT (version) DO NOTHING
    `);
    console.log('✓ Inserted default revenue share configuration');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
