/**
 * Backfill Script: Create payment records for existing ARTIST subscriptions
 * Run this to populate the payments table for subscriptions that don't have payment records
 *
 * Run with: npx ts-node -r dotenv/config scripts/backfill-payments.ts
 * Or:       node -r dotenv/config dist/scripts/backfill-payments.js
 */

import { pool } from '../src/common/db';
import { logger } from '../src/common/logger';

async function backfillPayments() {
  const client = await pool.connect();
  
  try {
    logger.info('[BACKFILL-PAYMENTS] Starting payment backfill...');
    
    // Find all ARTIST subscriptions that don't have corresponding payments
    const subsWithoutPayments = await client.query(`
      SELECT s.id as subscription_id, s.user_id, s.artist_id, s.start_date, 
             u.subscription_price, u.yearly_subscription_price, s.plan_type
      FROM subscriptions s
      JOIN users u ON u.id = s.artist_id
      WHERE s.type = 'ARTIST'
        AND s.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM payments p 
          WHERE p.subscription_id = s.id
        )
    `);
    
    const totalToFix = subsWithoutPayments.rows.length;
    logger.info(`[BACKFILL-PAYMENTS] Found ${totalToFix} subscriptions without payment records`);
    
    if (totalToFix === 0) {
      logger.info('[BACKFILL-PAYMENTS] No subscriptions need payment records. Exiting.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of subsWithoutPayments.rows) {
      try {
        const subscriptionId = row.subscription_id;
        const userId = row.user_id;
        const artistId = row.artist_id;
        const isYearly = row.plan_type === 'YEARLY';
        
        // Determine amount based on plan type
        let amountPaise = 0;
        if (isYearly && Number(row.yearly_subscription_price) > 0) {
          amountPaise = Number(row.yearly_subscription_price) * 100;
        } else {
          amountPaise = Number(row.subscription_price) * 100;
        }
        
        // Default to 10000 paise (₹100) if no price found
        if (!amountPaise || amountPaise <= 0) {
          amountPaise = 10000;
        }
        
        // Insert payment record
        await client.query(`
          INSERT INTO payments (user_id, subscription_id, amount, status, razorpay_payment_id, created_at)
          VALUES ($1, $2, $3, 'SUCCESS', $4, $5)
          ON CONFLICT (razorpay_payment_id) DO NOTHING
        `, [
          userId, 
          subscriptionId, 
          amountPaise, 
          `backfill_${subscriptionId}_${Date.now()}`,
          row.start_date || new Date()
        ]);
        
        successCount++;
        logger.info({ 
          subscriptionId, 
          userId, 
          artistId, 
          amountPaise 
        }, '[BACKFILL-PAYMENTS] Created payment record');
        
      } catch (err: any) {
        errorCount++;
        logger.error({ 
          subscriptionId: row.subscription_id, 
          error: err.message 
        }, '[BACKFILL-PAYMENTS] Failed to create payment record');
      }
    }
    
    logger.info(`[BACKFILL-PAYMENTS] Complete! Success: ${successCount}, Errors: ${errorCount}`);
    
    // Verify the fix
    const verification = await client.query(`
      SELECT s.artist_id, COUNT(*) as payment_count, SUM(p.amount)/100 as total_inr
      FROM payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.type = 'ARTIST'
      GROUP BY s.artist_id
    `);
    
    logger.info('[BACKFILL-PAYMENTS] Verification - Payments by artist:');
    for (const row of verification.rows) {
      logger.info(`  Artist ${row.artist_id}: ${row.payment_count} payments, ₹${row.total_inr} total`);
    }
    
  } catch (error: any) {
    logger.error({ error: error.message }, '[BACKFILL-PAYMENTS] Error during backfill');
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  backfillPayments()
    .then(() => {
      console.log('Payment backfill completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Payment backfill failed:', error);
      process.exit(1);
    });
}

export { backfillPayments };
