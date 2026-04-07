import { pool } from "../common/db";

async function migrate() {
  console.log("=== RUNNING PRODUCTION SUBSCRIPTION MIGRATIONS ===");
  
  try {
    // 1. Processed Webhook Events (Idempotency)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processed_webhook_events (
        event_id VARCHAR(255) PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    console.log("-> Table 'processed_webhook_events' created/verified.");

    // 2. Subscription Audit Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        subscription_id INTEGER,
        event_type VARCHAR(100) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    console.log("-> Table 'subscription_audit_logs' created/verified.");

    // 3. Transactions enhancement (if needed, already exists but ensuring columns)
    await pool.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log("-> Table 'transactions' columns verified.");

    // 4. Subscriptions enhancement
    await pool.query(`
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log("-> Table 'subscriptions' columns verified.");

    console.log("=== MIGRATIONS COMPLETED SUCCESSFULLY ===");
  } catch (err: any) {
    console.error("!!! MIGRATION FAILED !!!", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
