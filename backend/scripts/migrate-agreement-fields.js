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

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20)
    `);
    console.log('✓ Added terms_version column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_status VARCHAR(20)
    `);
    console.log('✓ Added agreement_status column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_start_date TIMESTAMPTZ
    `);
    console.log('✓ Added agreement_start_date column');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_pdf_path VARCHAR(500)
    `);
    console.log('✓ Added agreement_pdf_path column');

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

    // Create terms_versions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS terms_versions (
        id SERIAL PRIMARY KEY,
        version VARCHAR(20) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ Created terms_versions table');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_terms_versions_version ON terms_versions(version)
    `);
    console.log('✓ Created index on terms_versions.version');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_terms_versions_effective_from ON terms_versions(effective_from)
    `);
    console.log('✓ Created index on terms_versions.effective_from');

    // Insert default terms
    const defaultTerms = `MUSIC PLATFORM ARTIST AGREEMENT

1. ACCEPTANCE OF TERMS
By signing this agreement, you agree to be bound by these terms and conditions.

2. REVENUE SHARING
Revenue from your content will be shared according to the agreed percentages.

3. CONTENT GUIDELINES
You agree to only upload content you own or have the right to distribute.

4. INTELLECTUAL PROPERTY
You retain ownership of your intellectual property while granting us the right to distribute it.

5. PAYMENT TERMS
Payments will be processed according to our standard payment schedule.

6. TERMINATION
Either party may terminate this agreement with 30 days notice.

7. GOVERNING LAW
This agreement is governed by the laws of the jurisdiction in which the platform operates.`;

    await pool.query(`
      INSERT INTO terms_versions (version, content)
      VALUES ('v1', $1)
      ON CONFLICT (version) DO NOTHING
    `, [defaultTerms]);
    console.log('✓ Inserted default terms configuration');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
