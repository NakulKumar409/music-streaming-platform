import { Request, Response } from "express";
import { pool } from "../../common/db";
import { logger } from "../../common/logger";
import { razorpayClient } from "../../config/razorpay";
import { AuditService } from "../../shared/audit/audit.service";

/**
 * Admin: Force revoke a subscription immediately.
 * Cancels in Razorpay and marks as CANCELLED in DB.
 */
export const revokeSubscription = async (req: Request, res: Response) => {
  const { id } = req.params;
  const correlationId = (req as any).correlationId || "-";

  try {
    const result = await pool.query(
      `SELECT razorpay_subscription_id, status FROM subscriptions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    const { razorpay_subscription_id, status } = result.rows[0];

    if (status === 'CANCELLED' || status === 'EXPIRED') {
      return res.status(400).json({ success: false, message: "Subscription already inactive" });
    }

    // 1. Cancel in Razorpay (if applicable)
    if (razorpay_subscription_id) {
       try {
         await razorpayClient.subscriptions.cancel(razorpay_subscription_id);
         logger.info({ id, razorpay_subscription_id, correlationId }, "[ADMIN] Cancelled Razorpay subscription");
       } catch (rzpErr: any) {
         logger.error({ id, razorpay_subscription_id, correlationId, error: rzpErr.message }, "[ADMIN] Failed to cancel Razorpay subscription");
         // Continue to update DB even if RZP fails (might already be cancelled there)
       }
    }

    // 2. Mark as CANCELLED in DB
    await pool.query(
      `UPDATE subscriptions SET status = 'CANCELLED', updated_at = now() WHERE id = $1`,
      [id]
    );

    logger.info({ id, correlationId, adminUserId: (req as any).user?.id }, "[ADMIN] Subscription revoked successfully");

    AuditService.log({
      action: 'admin.subscription_cancelled',
      entity: 'subscription',
      entityId: String(id),
      performedBy: (req as any).user?.id,
      role: 'admin',
      status: 'success',
      correlationId,
      metadata: { action: 'revoked' }
    });

    return res.json({ success: true, message: "Subscription revoked successfully" });
  } catch (err: any) {
    logger.error({ id, correlationId, error: err.message }, "[ADMIN] Failed to revoke subscription");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Admin: Adjust subscription status or expiry manually.
 * Used for manual fixes and support.
 */
export const adjustSubscription = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, next_billing_date, grace_ends_at, auto_renew } = req.body;
  const correlationId = (req as any).correlationId || "-";

  try {
    // Basic validation
    const allowedStatuses = ['ACTIVE', 'PAST_DUE', 'GRACE', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'];
    if (status && !allowedStatuses.includes(status.toUpperCase())) {
       return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const updateParts: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (status) { updateParts.push(`status = $${i++}`); values.push(status.toUpperCase()); }
    if (next_billing_date) { updateParts.push(`next_billing_date = $${i++}`); values.push(next_billing_date); }
    if (grace_ends_at) { updateParts.push(`grace_ends_at = $${i++}`); values.push(grace_ends_at); }
    if (typeof auto_renew === 'boolean') { updateParts.push(`auto_renew = $${i++}`); values.push(auto_renew); }

    if (updateParts.length === 0) {
       return res.status(400).json({ success: false, message: "No updates provided" });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE subscriptions SET ${updateParts.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING id`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    logger.info({ id, correlationId, adminUserId: (req as any).user?.id, updates: req.body }, "[ADMIN] Subscription adjusted successfully");

    AuditService.log({
      action: 'admin.subscription_adjusted',
      entity: 'subscription',
      entityId: String(id),
      performedBy: (req as any).user?.id,
      role: 'admin',
      status: 'success',
      correlationId,
      metadata: { updates: req.body }
    });

    return res.json({ success: true, message: "Subscription adjusted successfully" });
  } catch (err: any) {
    logger.error({ id, correlationId, error: err.message }, "[ADMIN] Failed to adjust subscription");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
