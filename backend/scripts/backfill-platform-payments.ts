/**
 * Backfill Script: Create payment records for PLATFORM subscriptions that don't have payment records
 * This ensures all platform subscription payments are reflected in analytics
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../src/common/db';
import { logger } from '../src/common/logger';

async function backfillPlatformPayments() {
  const client = await pool.connect();
  
  try {
    logger.info('[BACKFILL-PLATFORM] Starting platform payment backfill...');
    
    // Find all PLATFORM subscriptions that don't have corresponding payments
    const subsWithoutPayments = await client.query(`
      SELECT s.id as subscription_id, s.user_id, s.plan_type, s.created_at,
             t.amount as tx_amount, t.id as tx_id, t.razorpay_payment_id
      FROM subscriptions s
      LEFT JOIN payments pay ON pay.subscription_id = s.id
      LEFT JOIN transactions t ON t.user_id = s.user_id 
        AND t.status = 'CAPTURED'
        AND t.date > s.created_at - interval '1 hour'
        AND t.date < s.created_at + interval '1 hour'
      WHERE s.type = 'PLATFORM'
        AND s.status = 'ACTIVE'
        AND pay.id IS NULL
        AND t.id IS NOT NULL
      ORDER BY s.created_at DESC
    `);
    
    const totalToFix = subsWithoutPayments.rows.length;
    logger.info(`[BACKFILL-PLATFORM] Found ${totalToFix} platform subscriptions without payment records`);
    
    if (totalToFix === 0) {
      logger.info('[BACKFILL-PLATFORM] No platform subscriptions need payment records. Exiting.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of subsWithoutPayments.rows) {
      try {
        const subscriptionId = row.subscription_id;
        const userId = row.user_id;
        const amountPaise = row.tx_amount || 0;
        const razorpayPaymentId = row.razorpay_payment_id || `backfill_${subscriptionId}_${Date.now()}`;
        
        if (!amountPaise || amountPaise <= 0) {
          logger.warn({ subscriptionId, userId }, '[BACKFILL-PLATFORM] Skipping - no valid amount found');
          continue;
        }
        
        // Generate UUID for the payment
        const paymentUuid = uuidv4();
        
        await client.query(
          `INSERT INTO payments (id, user_id, subscription_id, amount, status, razorpay_payment_id, created_at)
           VALUES ($1, $2, $3, $4, 'SUCCESS', $5, now())
           ON CONFLICT (razorpay_payment_id) DO NOTHING`,
          [paymentUuid, userId, subscriptionId, amountPaise, razorpayPaymentId]
        );
        
        successCount++;
        logger.info({ 
          subscriptionId, 
          userId, 
          amountPaise,
          paymentUuid
        }, '[BACKFILL-PLATFORM] Created platform payment record');
        
      } catch (err: any) {
        errorCount++;
        logger.error({ 
          subscriptionId: row.subscription_id, 
          error: err.message 
        }, '[BACKFILL-PLATFORM] Failed to create payment record');
      }
    }
    
    logger.info(`[BACKFILL-PLATFORM] Complete! Success: ${successCount}, Errors: ${errorCount}`);
    
    // Verify the fix
    const verification = await client.query(`
      SELECT 
        s.type,
        COUNT(*) as payment_count, 
        SUM(p.amount)/100 as total_inr
      FROM payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.type = 'PLATFORM'
      GROUP BY s.type
    `);
    
    if (verification.rows.length > 0) {
      logger.info('[BACKFILL-PLATFORM] Verification - PLATFORM payments:');
      for (const row of verification.rows) {
        logger.info(`  ${row.type}: ${row.payment_count} payments, ₹${row.total_inr} total`);
      }
    }
    
  } catch (error: any) {
    logger.error({ error: error.message }, '[BACKFILL-PLATFORM] Error during backfill');
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  backfillPlatformPayments()
    .then(() => {
      console.log('Platform payment backfill completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Platform payment backfill failed:', error);
      process.exit(1);
    });
}

export { backfillPlatformPayments };
