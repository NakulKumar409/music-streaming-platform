-- Add agreement fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_accepted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_version VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_revenue_share INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_revenue_share INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS digital_signature TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_signed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_id VARCHAR(100);

-- Create index on agreement_id
CREATE INDEX IF NOT EXISTS idx_users_agreement_id ON users(agreement_id);

-- Create revenue_share_configs table
CREATE TABLE IF NOT EXISTS revenue_share_configs (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) UNIQUE NOT NULL,
  artist_share INT NOT NULL,
  platform_share INT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_share_configs_version ON revenue_share_configs(version);
CREATE INDEX IF NOT EXISTS idx_revenue_share_configs_effective_from ON revenue_share_configs(effective_from);

-- Insert default revenue share configuration
INSERT INTO revenue_share_configs (version, artist_share, platform_share)
VALUES ('v1', 55, 45)
ON CONFLICT (version) DO NOTHING;
