import { Response } from "express";
import crypto from "crypto";
import { pool } from "../common/db";
import { razorpayClient } from "../config/razorpay";
import { logger } from "../common/logger";
import { creditArtistEarnings } from "./paymentController";
import { NotificationService } from "../shared/notifications/notification.service";

const safeEqualHex = (aHex: string, bHex: string) => {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// ─────────────────────────────────────────────────────────────────────────────
//  Block rules
//  ARTIST  → block if same user+artist already ACTIVE (not expired/cancelled)
//  PLATFORM → block if user already has ACTIVE platform sub
//  Early renew → allowed (just create a new row or upsert when near expiry)
// ─────────────────────────────────────────────────────────────────────────────
async function checkDuplicateBlock(
  userId: number,
  type: "ARTIST" | "PLATFORM",
  artistIdNum: number | null
): Promise<{ blocked: boolean; message: string }> {
  if (type === "ARTIST") {
    if (!artistIdNum) return { blocked: true, message: "artistId required for ARTIST subscription" };
    const existing = await pool.query(
      `SELECT id, status, next_billing_date FROM subscriptions
       WHERE user_id = $1 AND type = 'ARTIST' AND artist_id = $2
         AND UPPER(COALESCE(status,'')) IN ('ACTIVE','CREATED','AUTHENTICATED','GRACE','PAST_DUE')
       ORDER BY created_at DESC LIMIT 1`,
      [userId, artistIdNum]
    );
    const sub = existing.rows?.[0];
    if (!sub) return { blocked: false, message: "" };

    const status = (sub.status ?? "").toUpperCase();
    if (status === "ACTIVE") {
      // Allow early renew: if subscription ends within 5 days from now
      const endDate = sub.next_billing_date ? new Date(sub.next_billing_date) : null;
      const now = new Date();
      if (endDate) {
        const daysLeft = (endDate.getTime() - now.getTime()) / (1000 * 86400);
        if (daysLeft > 5) {
          return { blocked: true, message: "You already have an active subscription to this artist. You can renew when it's within 5 days of expiry." };
        }
      } else {
        return { blocked: true, message: "You already have an active subscription to this artist." };
      }
    }
    return { blocked: false, message: "" };
  }

  if (type === "PLATFORM") {
    const existing = await pool.query(
      `SELECT id, status, next_billing_date FROM subscriptions
       WHERE user_id = $1 AND type = 'PLATFORM'
         AND UPPER(COALESCE(status,'')) IN ('ACTIVE','CREATED','AUTHENTICATED','GRACE')
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const sub = existing.rows?.[0];
    if (!sub) return { blocked: false, message: "" };

    const status = (sub.status ?? "").toUpperCase();
    if (status === "ACTIVE") {
      const endDate = sub.next_billing_date ? new Date(sub.next_billing_date) : null;
      const now = new Date();
      if (endDate) {
        const daysLeft = (endDate.getTime() - now.getTime()) / (1000 * 86400);
        if (daysLeft > 5) {
          return { blocked: true, message: "You already have an active Platform subscription. You can renew when it's within 5 days of expiry." };
        }
      } else {
        return { blocked: true, message: "You already have an active Platform subscription." };
      }
    }
    return { blocked: false, message: "" };
  }

  return { blocked: false, message: "" };
}

// ─────────────────────────────────────────────────────────────────────────────
//  createSubscription  — supports both ARTIST and PLATFORM
// ─────────────────────────────────────────────────────────────────────────────
export const createSubscription = async (req: any, res: Response) => {
  const correlationId = req.headers["x-correlation-id"] || "n/a";
  try {
    const userId = Number(req.user?.id);
    const { artistId, planId, type: rawType } = req.body as {
      artistId?: number | string;
      planId?: string;
      type?: string;
    };

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const subscriptionType = (rawType ?? "ARTIST").toString().toUpperCase() as "ARTIST" | "PLATFORM";
    if (subscriptionType !== "ARTIST" && subscriptionType !== "PLATFORM") {
      return res.status(400).json({ success: false, message: "type must be ARTIST or PLATFORM" });
    }

    // Compliance check
    const userAgent = (req.headers["user-agent"] || "").toLowerCase();
    const isMobileUA = userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("android");
    const platform = (req.headers["x-platform"] || "").toString().toLowerCase();
    const isMobilePlatform = platform === "ios" || platform === "android";

    if (isMobilePlatform || isMobileUA) {
      logger.warn({ userId, platform, userAgent, correlationId }, "[SUBSCRIPTION] Blocked mobile Razorpay sub attempt (compliance)");
      return res.status(400).json({
        success: false,
        message: "Digital subscriptions must be managed via our website on a desktop browser. Mobile purchases are coming soon."
      });
    }

    if (!planId) {
      return res.status(400).json({ success: false, message: "planId is required" });
    }

    // Resolve artistId for ARTIST type
    let artistIdNum: number | null = null;
    if (subscriptionType === "ARTIST") {
      const artistIdRaw = (artistId ?? "").toString().trim();
      artistIdNum = Number(artistIdRaw);
      if (!Number.isFinite(artistIdNum) || artistIdNum <= 0) {
        const artistRow = await pool.query(
          `SELECT id FROM users WHERE username = $1 LIMIT 1`,
          [artistIdRaw]
        );
        const resolved = Number(artistRow.rows?.[0]?.id);
        if (!Number.isFinite(resolved) || resolved <= 0) {
          return res.status(400).json({ success: false, message: "Valid artistId is required for ARTIST subscription" });
        }
        artistIdNum = resolved;
      }
    }

    // Check duplicate/block rules
    const { blocked, message: blockMsg } = await checkDuplicateBlock(userId, subscriptionType, artistIdNum);
    if (blocked) {
      return res.status(400).json({ success: false, message: blockMsg });
    }

    // Get / create Razorpay customer
    let customerId: string | null = null;
    const userResult = await pool.query(
      `SELECT email, name, razorpay_customer_id, phone FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const user = userResult.rows[0];

    if (!user.razorpay_customer_id) {
      const newCustomer = await razorpayClient.customers.create({
        name: user.name || "Music Platform Fan",
        email: user.email,
        contact: user.phone || undefined,
        notes: { user_id: String(userId) }
      });
      customerId = newCustomer.id;
      await pool.query(
        `UPDATE users SET razorpay_customer_id = $1 WHERE id = $2`,
        [customerId, userId]
      );
    } else {
      customerId = user.razorpay_customer_id;
    }

    const subscription = (await razorpayClient.subscriptions.create({
      plan_id: planId.trim(),
      customer_id: customerId as string,
      total_count: 120,
      customer_notify: 1,
      notes: {
        user_id: String(userId),
        artist_id: artistIdNum ? String(artistIdNum) : "",
        subscription_type: subscriptionType,
      }
    } as any)) as any;

    // Upsert subscription row
    await pool.query(
      `INSERT INTO subscriptions
         (user_id, type, artist_id, status, plan_type, razorpay_subscription_id, plan_id, start_date, updated_at)
       VALUES ($1, $2, $3, 'CREATED', 'MONTHLY', $4, $5, now(), now())
       ON CONFLICT (razorpay_subscription_id)
       DO UPDATE SET
          status = 'CREATED',
          updated_at = now()`,
      [userId, subscriptionType, artistIdNum, subscription.id, planId.trim()]
    );

    logger.info({ userId, subscriptionId: subscription.id, correlationId }, "[SUBSCRIPTION] Created Razorpay subscription");

    return res.json({
      success: true,
      subscription_id: subscription.id,
      key_id: (process.env.RAZORPAY_KEY_ID ?? "").toString()
    });

  } catch (err: any) {
    logger.error({ error: err.message, correlationId }, "[SUBSCRIPTION] Failed to create subscription");
    if (err.statusCode === 400 && err.error?.description) {
      return res.status(400).json({ success: false, message: err.error.description });
    }
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to create subscription"
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  verifySubscription  — verify Razorpay signature and activate
// ─────────────────────────────────────────────────────────────────────────────
export const verifySubscription = async (req: any, res: Response) => {
  const correlationId = req.headers["x-correlation-id"] || "n/a";
  try {
    const userId = Number(req.user?.id);
    const { razorpay_payment_id, razorpay_signature, razorpay_subscription_id } = req.body;

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!razorpay_payment_id || !razorpay_signature || !razorpay_subscription_id) {
      return res.status(400).json({ success: false, message: "Missing required Razorpay parameters" });
    }

    const keySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").toString().trim();
    if (!keySecret) {
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    // Verify HMAC signature
    const payload = `${razorpay_payment_id}|${razorpay_subscription_id}`;
    const expectedSig = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    if (!safeEqualHex(expectedSig, razorpay_signature)) {
      logger.warn({ userId, razorpay_subscription_id, correlationId, tags: ['ALERT', 'SECURITY'] }, "[VERIFY] Signature mismatch");
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Fetch the subscription record
    const subResult = await pool.query(
      `SELECT id, user_id, status, type, artist_id FROM subscriptions
       WHERE razorpay_subscription_id = $1 LIMIT 1`,
      [razorpay_subscription_id]
    );

    const sub = subResult.rows[0];
    if (!sub || Number(sub.user_id) !== userId) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const now = new Date();
      // Default to 30 days for monthly if no plan meta found
      const nextBillingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      // Grace period: 2 days after next billing
      const graceEndsAt = new Date(nextBillingDate.getTime() + 2 * 24 * 60 * 60 * 1000);

      // 1. Activate subscription
      await client.query(
        `UPDATE subscriptions
         SET status = 'ACTIVE',
             payment_id = $2,
             updated_at = $3,
             next_billing_date = $4,
             grace_ends_at = $5
         WHERE razorpay_subscription_id = $1`,
        [razorpay_subscription_id, razorpay_payment_id, now, nextBillingDate, graceEndsAt]
      );

      // 2. Record payment in payments table
      const artistPriceRow = await client.query(`SELECT subscription_price FROM users WHERE id = $1`, [sub.artist_id]);
      const price = Number(artistPriceRow.rows[0]?.subscription_price || 0);
      const amountPaise = price * 100;

      await client.query(
        `INSERT INTO payments (user_id, subscription_id, amount, status, razorpay_payment_id, created_at)
         VALUES ($1, $2, $3, 'SUCCESS', $4, now())
         ON CONFLICT (razorpay_payment_id) DO NOTHING`,
        [userId, sub.id, amountPaise, razorpay_payment_id]
      );

      // 3. Credit earnings for initial payment (if ARTIST sub)
      if (sub.type === 'ARTIST' && amountPaise > 0) {
         await creditArtistEarnings(Number(sub.artist_id), amountPaise);
      }

      // 4. Handle Upgrade: Cancel old subscriptions of same type/lower tier
      try {
         const oldSubs = await client.query(
           `SELECT razorpay_subscription_id FROM subscriptions
            WHERE user_id = $1 AND razorpay_subscription_id <> $2
              AND (
                (type = $3 AND artist_id = $4) -- same artist
                OR (type = 'ARTIST' AND $3 = 'PLATFORM') -- artist sub superseded by platform
                OR (type = 'PLATFORM' AND $3 = 'PLATFORM') -- old platform superseded
              )
              AND status IN ('ACTIVE', 'PAST_DUE', 'GRACE')`,
           [userId, razorpay_subscription_id, sub.type, sub.artist_id]
         );

         for (const old of oldSubs.rows) {
            logger.info({ userId, oldSubId: old.razorpay_subscription_id, correlationId }, "[UPGRADE] Cancelling redundant sub");
            await razorpayClient.subscriptions.cancel(old.razorpay_subscription_id).catch(() => undefined);
            await client.query(
              `UPDATE subscriptions SET status = 'SUPERSEDED', updated_at = now() 
               WHERE razorpay_subscription_id = $1`,
              [old.razorpay_subscription_id]
            );
         }
      } catch (upgradeErr) {
         logger.error({ error: upgradeErr, correlationId, tags: ['ALERT', 'UPGRADE_FAIL'] }, "[UPGRADE] Failed to process old subscription cleanup");
      }

      await client.query('COMMIT');
      logger.info({ userId, razorpay_subscription_id, correlationId }, "[VERIFY] Subscription activated successfully");

      // Send success notification
      NotificationService.sendToUser({
        userId: String(userId),
        title: "Subscription Confirmed! 🎸",
        body: `You are now subscribed to ${sub.type === 'PLATFORM' ? 'the Platform' : 'the Artist'}. Enjoy HD streaming!`,
        data: { type: "subscription_success", subId: sub.id }
      }).catch(e => logger.error(e, "[VERIFY] Notification failed"));

      return res.json({
        success: true,
        message: "Subscription verified and activated",
        subscription: {
          razorpay_subscription_id,
          type: sub.type,
          status: "ACTIVE",
          payment_id: razorpay_payment_id,
          next_billing_date: nextBillingDate.toISOString(),
          grace_ends_at: graceEndsAt.toISOString(),
        }
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      logger.error({ userId, razorpay_subscription_id, correlationId, error: err.message, tags: ['ALERT', 'VERIFY_FAIL'] }, "[VERIFY] Failed to verify subscription signature");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    } finally {
      client.release();
    }

  } catch (err: any) {
    logger.error({ error: err.message, correlationId }, "[VERIFY] Subscription verification failed");
    return res.status(500).json({
      success: false,
      message: "Verification failed"
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  toggleAutoRenew  — manually toggle auto-renewal for a subscription
// ─────────────────────────────────────────────────────────────────────────────
export const toggleAutoRenew = async (req: any, res: Response) => {
  const correlationId = req.headers["x-correlation-id"] || "n/a";
  try {
    const userId = req.user?.id;
    const subId = req.params.id;
    const { auto_renew } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await pool.query(
      `UPDATE subscriptions 
       SET auto_renew = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id, auto_renew`,
      [!!auto_renew, subId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    logger.info({ userId, subId, auto_renew: !!auto_renew, correlationId }, "[SUBSCRIPTION] Toggled auto-renew");

    // Add audit log
    await pool.query(
      `INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type, metadata)
       VALUES ($1, $2, 'AUTO_RENEW_TOGGLE', $3)`,
      [userId, subId, JSON.stringify({ auto_renew: !!auto_renew })]
    ).catch(e => logger.error(e, "[SUBSCRIPTION] Audit log failed"));

    return res.json({ success: true, auto_renew: result.rows[0].auto_renew });
  } catch (err: any) {
    logger.error({ error: err.message, correlationId }, "[SUBSCRIPTION] Failed to toggle auto-renew");
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  cancelSubscription  — set auto_renew false and record reason
// ─────────────────────────────────────────────────────────────────────────────
export const cancelSubscription = async (req: any, res: Response) => {
  const correlationId = req.headers["x-correlation-id"] || "n/a";
  try {
    const userId = req.user?.id;
    const subId = req.params.id;
    const { reason, feedback, accepted_retention_offer } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // 1. Audit log the intent
    await pool.query(
      `INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type, metadata)
       VALUES ($1, $2, 'CANCEL_INTENT', $3)`,
      [userId, subId, JSON.stringify({ reason, feedback, accepted_retention_offer })]
    ).catch(e => logger.error(e, "[SUBSCRIPTION] Audit log failed"));

    if (accepted_retention_offer) {
       // Apply retention logic (e.g., mark subscription as discounted or extended)
       // For now, we'll keep auto-renew ON if they accept retention
       logger.info({ userId, subId, correlationId }, "[SUBSCRIPTION] User accepted retention offer");
       return res.json({ success: true, message: "Retention offer applied! We value your support." });
    }

    // 2. Disable auto-renew
    const result = await pool.query(
      `UPDATE subscriptions 
       SET auto_renew = false, updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [subId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    logger.info({ userId, subId, reason, correlationId }, "[SUBSCRIPTION] Subscription cancelled (auto-renew disabled)");

    return res.json({ 
      success: true, 
      message: "Subscription will not renew. Your access remains until the end of the billing cycle." 
    });
  } catch (err: any) {
    logger.error({ error: err.message, correlationId }, "[SUBSCRIPTION] Failed to cancel subscription");
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

