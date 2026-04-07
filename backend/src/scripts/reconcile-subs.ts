import { pool } from "../common/db";
import { logger } from "../common/logger";
import { razorpayClient } from "../config/razorpay";

/**
 * PRODUCTION RECONCILIATION JOB
 * 1. Synchronizes MISSING activations (Captured Payment but no Active Sub).
 * 2. Synchronizes EXPIRED subscriptions (Current Date > Next Billing + Grace).
 */
async function runReconciliation(dryRun = false) {
  const correlationId = `reconcile-${Date.now()}`;
  logger.info({ dryRun, correlationId }, "=== STARTING SUBSCRIPTION RECONCILIATION ===");

  try {
    // ─── 1. Fix Missing Activations ──────────────────────────────────────────
    // Find transactions that are CAPTURED but the corresponding subscription is still PENDING/CREATED
    const missingActivations = await pool.query(`
      SELECT t.id, t.user_id, t.razorpay_order_id, s.id as sub_id, s.razorpay_subscription_id
      FROM transactions t
      JOIN subscriptions s ON (t.razorpay_order_id = s.razorpay_subscription_id OR t.razorpay_order_id = s.plan_id) -- heuristic
      WHERE t.status = 'CAPTURED' 
        AND s.status NOT IN ('ACTIVE', 'SUPERSEDED', 'CANCELLED')
        AND t.date > now() - interval '7 days'
    `);

    logger.info({ count: missingActivations.rows.length }, "Found potentially missing activations");

    for (const row of missingActivations.rows) {
      if (dryRun) {
        logger.info({ id: row.id, subId: row.sub_id }, "[DRY RUN] Would activate subscription");
        continue;
      }

      // Re-run activation logic (simplified here)
      await pool.query(
        `UPDATE subscriptions SET status = 'ACTIVE', updated_at = now() WHERE id = $1`,
        [row.sub_id]
      );
      logger.info({ id: row.id, subId: row.sub_id, tags: ['ALERT', 'RECONCILED'] }, "Automatically activated missing subscription");
    }

    // ─── 2. Sync Expiries ────────────────────────────────────────────────────
    // Find subscriptions that should be EXPIRED but are still ACTIVE
    const expiredSubs = await pool.query(`
      SELECT id, razorpay_subscription_id, next_billing_date, grace_ends_at
      FROM subscriptions
      WHERE status IN ('ACTIVE', 'PAST_DUE', 'GRACE')
        AND COALESCE(grace_ends_at, next_billing_date) < now() - interval '1 hour'
    `);

    logger.info({ count: expiredSubs.rows.length }, "Found stale active subscriptions");

    for (const row of expiredSubs.rows) {
      if (dryRun) {
        logger.info({ id: row.id, rzpId: row.razorpay_subscription_id }, "[DRY RUN] Would expire subscription");
        continue;
      }

      // Verify with Razorpay before expiring
      if (row.razorpay_subscription_id) {
        try {
          const rzpSub = await razorpayClient.subscriptions.fetch(row.razorpay_subscription_id);
          if (rzpSub.status === 'active') {
             // If Razorpay says it's active, sync local date and continue
             const newNextDate = new Date(rzpSub.charge_at * 1000);
             await pool.query(`UPDATE subscriptions SET next_billing_date = $1, updated_at = now() WHERE id = $2`, [newNextDate, row.id]);
             logger.info({ id: row.id, newDate: newNextDate }, "Synced next_billing_date from Razorpay");
             continue;
          }
        } catch (rzpErr: any) {
          logger.error({ id: row.id, error: rzpErr.message }, "Failed to fetch from Razorpay during reconcile");
        }
      }

      // If we reach here, it's truly expired or RZP confirmed it
      await pool.query(
        `UPDATE subscriptions SET status = 'EXPIRED', updated_at = now() WHERE id = $1`,
        [row.id]
      );
      logger.info({ id: row.id, tags: ['ALERT', 'RECONCILED'] }, "Marked subscription as EXPIRED (Missed Webhook)");
    }

    logger.info({ correlationId }, "=== RECONCILIATION COMPLETED SUCCESSFULLY ===");
  } catch (err: any) {
    logger.error({ error: err.message, stack: err.stack, correlationId, tags: ['ALERT', 'PRODUCTION_ISSUE'] }, "Reconciliation Job Failed");
    process.exit(1);
  } finally {
    if (!dryRun) process.exit(0);
  }
}

// Support CLI flags
const dryRun = process.argv.includes("--dry-run");
runReconciliation(dryRun);
