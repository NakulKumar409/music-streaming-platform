import dotenv from "dotenv";
dotenv.config();
import { pool } from "../common/db";

async function migrate() {
  console.log("Starting Yearly Price Migration...");

  try {
    console.log("Adding yearly_price to platform_subscription_configs...");
    await pool.query(`
      ALTER TABLE platform_subscription_configs 
      ADD COLUMN IF NOT EXISTS yearly_price NUMERIC(10, 2);
    `);

    // Optionally set a default value for existing rows
    console.log("Setting default yearly_price for existing rows (price * 12 * 0.8)...");
    await pool.query(`
      UPDATE platform_subscription_configs 
      SET yearly_price = price * 12 * 0.8
      WHERE yearly_price IS NULL AND price IS NOT NULL;
    `);

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
