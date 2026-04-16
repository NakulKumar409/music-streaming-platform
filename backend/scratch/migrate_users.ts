
import { pool } from '../src/common/db/index';

async function migrate() {
  try {
    console.log('Adding yearly_subscription_price to users table...');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS yearly_subscription_price DECIMAL DEFAULT 0;');
    console.log('Success!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
