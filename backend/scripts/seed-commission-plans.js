const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedCommissionPlans() {
  try {
    console.log('Seeding commission plans...');

    // Insert 4 commission plan types
    const plans = [
      { version: 'starter', artist_share: 50, platform_share: 50, is_active: true },
      { version: 'standard', artist_share: 60, platform_share: 40, is_active: true },
      { version: 'premium', artist_share: 70, platform_share: 30, is_active: true },
      { version: 'exclusive', artist_share: 80, platform_share: 20, is_active: true },
    ];

    for (const plan of plans) {
      await pool.query(
        `INSERT INTO revenue_share_configs (version, artist_share, platform_share, is_active, effective_from, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
         ON CONFLICT (version) DO UPDATE SET
           artist_share = EXCLUDED.artist_share,
           platform_share = EXCLUDED.platform_share,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [plan.version, plan.artist_share, plan.platform_share, plan.is_active]
      );
      console.log(`Inserted/Updated commission plan ${plan.version}: Artist ${plan.artist_share}%, Platform ${plan.platform_share}%`);
    }

    console.log('Commission plans seeded successfully!');
  } catch (error) {
    console.error('Error seeding commission plans:', error);
  }
}

async function seedTermsVersions() {
  try {
    console.log('Seeding terms versions...');

    const termsContent = `ARTIST AGREEMENT TERMS & CONDITIONS

1. CONTENT OWNERSHIP
You retain full ownership of all content you upload to the platform. The platform is granted a license to distribute your content to subscribers.

2. REVENUE SHARING
Earnings will be split according to the agreed commission plan. The platform handles payment processing and distributes earnings according to the revenue share agreement.

3. CONTENT STANDARDS
All content must be original and comply with applicable laws and platform guidelines. You represent and warrant that you have all necessary rights to the content.

4. PAYMENT PROCESSING
The platform handles payment processing and will distribute earnings according to the revenue share agreement. Payments are made on a monthly basis.

5. ACCOUNT SECURITY
You are responsible for maintaining the security of your account credentials. You agree to notify us immediately of any unauthorized use.

6. PLATFORM RIGHTS
The platform has the right to distribute your content to subscribers and manage the technical infrastructure necessary for service delivery.

7. AGREEMENT BINDING
This agreement is legally binding upon your digital signature. By signing, you agree to all terms outlined herein.

8. MODIFICATIONS
Future changes to terms will only apply to new agreements, not existing signed agreements. You will be notified of any material changes.

9. TERMINATION
Either party may terminate this agreement with 30 days written notice. Upon termination, all content will be removed from the platform.

10. GOVERNING LAW
This agreement shall be governed by the laws of the jurisdiction in which the platform is established.`;

    await pool.query(
      `INSERT INTO terms_versions (version, content, is_active, effective_from, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW(), NOW())
       ON CONFLICT (version) DO UPDATE SET
         content = EXCLUDED.content,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      ['v1', termsContent, true]
    );

    console.log('Terms version v1 seeded successfully!');
  } catch (error) {
    console.error('Error seeding terms versions:', error);
  }
}

async function main() {
  await seedCommissionPlans();
  await seedTermsVersions();
  console.log('All data seeded successfully!');
  await pool.end();
}

main();
