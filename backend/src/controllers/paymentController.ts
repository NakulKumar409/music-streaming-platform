import { Response } from "express";
import crypto from "crypto";
import { pool } from "../common/db";
import { logger } from "../common/logger";
import Razorpay from "razorpay";
import { NotificationService } from "../shared/notifications/notification.service";

const getRazorpayClient = () => {
  const key_id = (process.env.RAZORPAY_KEY_ID ?? "").toString().trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET ?? "").toString().trim();

  if (!key_id || !key_secret) {
    throw new Error("Razorpay keys are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }

  return new Razorpay({ key_id, key_secret });
};

const safeEqualHex = (aHex: string, bHex: string) => {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export const createOrder = async (req: any, res: Response) => {
  try {
    const userId = Number(req.user?.id);
    const { amount, artistId, artistName } = req.body as {
      amount?: number;
      artistId?: number | string;
      artistName?: string;
    };

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const amountInt = Number(amount);
    if (!Number.isFinite(amountInt) || amountInt <= 0) {
      return res.status(400).json({ success: false, message: "amount is required" });
    }

    const artistIdRaw = (artistId ?? "").toString().trim();
    let artistIdNumber = Number(artistIdRaw);

    // If artistId is '0', empty, or not a positive number — check if it's a username string
    // For Platform plan: artistId will be '0' or '' — that's fine, skip lookup
    if (artistIdRaw && artistIdRaw !== '0' && (!Number.isFinite(artistIdNumber) || artistIdNumber <= 0)) {
      // Probably a username string — try to resolve it
      const artistRow = await pool.query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [artistIdRaw]
      );
      const resolved = Number(artistRow.rows?.[0]?.id);
      if (Number.isFinite(resolved) && resolved > 0) {
        artistIdNumber = resolved;
      } else {
        return res.status(400).json({ success: false, message: "artistId is invalid" });
      }
    }

    // Normalize: 0 or NaN → 0 means Platform plan
    let amountPaise = Math.floor(amountInt);
    const isPlatform = !artistIdNumber || artistIdNumber <= 0;

    // ── Dynamic Platform Price Lookup ──────────────────────────────────────────
    if (isPlatform) {
      try {
        const configRow = await pool.query(
          "SELECT price FROM platform_subscription_configs WHERE is_active = true ORDER BY updated_at DESC LIMIT 1"
        );
        if (configRow.rows.length > 0) {
          const dbPrice = Number(configRow.rows[0].price);
          // Standardise on Paise (multiply by 100)
          amountPaise = Math.floor(dbPrice * 100);
          logger.info({ userId, dbPrice, amountPaise }, "[PAYMENT] Using dynamic platform price");
        }
      } catch (err) {
        logger.error({ err }, "[PAYMENT] Failed to fetch dynamic platform price, falling back to request amount");
      }
    }

    // ── Duplicate Subscription Check ───────────────────────────────────────────
    if (isPlatform) {
      const dupCheck = await pool.query(
        `SELECT id FROM subscriptions WHERE user_id = $1 AND type = 'PLATFORM' AND status = 'ACTIVE' LIMIT 1`,
        [userId]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ success: false, message: "You already have an active Platform subscription." });
      }
    } else {
      const dupCheck = await pool.query(
        `SELECT id FROM subscriptions WHERE user_id = $1 AND artist_id = $2 AND type = 'ARTIST' AND status = 'ACTIVE' LIMIT 1`,
        [userId, artistIdNumber]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ success: false, message: "You already have an active subscription for this artist." });
      }

      // ── Dynamic Artist Price Lookup ──────────────────────────────────────────
      try {
        const artistRow = await pool.query(
          "SELECT COALESCE(subscription_price, 0) as price FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST'",
          [artistIdNumber]
        );
        if (artistRow.rows.length > 0) {
          const dbPrice = Number(artistRow.rows[0].price);
          if (dbPrice > 0) {
            amountPaise = Math.floor(dbPrice * 100);
            logger.info({ userId, artistId: artistIdNumber, dbPrice, amountPaise }, "[PAYMENT] Using dynamic artist price");
          }
        }
      } catch (err) {
        logger.error({ err }, "[PAYMENT] Failed to fetch dynamic artist price");
      }
    }

    const client = getRazorpayClient();

    const receipt = `sub_${userId}_${artistIdNumber}_${Date.now()}`;
    const order = await client.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        user_id: String(userId),
        artist_id: String(artistIdNumber),
        artist_name: (artistName ?? "").toString() || "Unknown",
      },
    });

    await pool.query(
      `INSERT INTO transactions (user_id, razorpay_order_id, amount, currency, status, artist_name)
       VALUES ($1, $2, $3, 'INR', 'CREATED', $4)
       ON CONFLICT (razorpay_order_id)
       DO UPDATE SET amount = EXCLUDED.amount, artist_name = EXCLUDED.artist_name, status = 'CREATED'
      `,
      [userId, order.id, amountPaise, (artistName ?? "").toString() || "Unknown"]
    );

    return res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        status: "CREATED",
        key_id: (process.env.RAZORPAY_KEY_ID ?? "").toString(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to create order"
    });
  }
};

export const confirmPayment = async (req: any, res: Response) => {
  try {
    const userId = Number(req.user?.id);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, artist_id } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      artist_id?: number | string;
    };

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const orderId = (razorpay_order_id ?? "").toString().trim();
    if (!orderId) {
      return res.status(400).json({ success: false, message: "razorpay_order_id is required" });
    }

    const paymentId = (razorpay_payment_id ?? "").toString().trim();
    const signature = (razorpay_signature ?? "").toString().trim();
    if (!paymentId || !signature) {
      return res
        .status(400)
        .json({ success: false, message: "razorpay_payment_id and razorpay_signature are required" });
    }

    const artistIdRaw = (artist_id ?? "").toString().trim();
    let artistId = Number(artistIdRaw);
    if (!Number.isFinite(artistId) || artistId <= 0) {
      if (artistIdRaw && artistIdRaw !== "0") {
        const artistRow = await pool.query(
          `SELECT id FROM users WHERE username = $1 LIMIT 1`,
          [artistIdRaw]
        );
        const resolved = Number(artistRow.rows?.[0]?.id);
        if (Number.isFinite(resolved) && resolved > 0) {
          artistId = resolved;
        }
      }
      // artistId = 0 or invalid means PLATFORM plan
    }

    const keySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").toString().trim();
    if (!keySecret) {
      return res.status(500).json({ success: false, message: "RAZORPAY_KEY_SECRET is missing" });
    }

    // ── Verify Razorpay Signature ──────────────────────────────────────────────
    const expectedSig = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (!safeEqualHex(expectedSig, signature)) {
      return res.status(400).json({ success: false, message: "Invalid Razorpay signature" });
    }

    // ── Fetch transaction ──────────────────────────────────────────────────────
    const found = await pool.query(
      `SELECT id, user_id, razorpay_order_id, amount, currency, status
       FROM transactions
       WHERE razorpay_order_id = $1
       LIMIT 1`,
      [orderId]
    );

    const tx = found.rows?.[0] ?? null;

    if (!tx || Number(tx.user_id) !== userId) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    // ── Mark transaction as CAPTURED ──────────────────────────────────────────
    const paymentConfirmedAt = new Date();
    const updated = await pool.query(
      `UPDATE transactions
       SET status = 'CAPTURED', payment_confirmed_at = $2, razorpay_payment_id = $3, razorpay_signature = $4
       WHERE razorpay_order_id = $1
       RETURNING id, user_id, razorpay_order_id, amount, currency, status, payment_confirmed_at, razorpay_payment_id, razorpay_signature`,
      [orderId, paymentConfirmedAt, paymentId, signature]
    );

    const updatedTx = updated.rows?.[0] ?? null;

    // ── Determine plan type and immediately activate subscription ──────────────
    // PLATFORM plan if artistId is missing/0, ARTIST plan otherwise
    const isPlatform = !artistId || artistId <= 0;
    const planType = isPlatform ? "PLATFORM" : "ARTIST";
    const amountPaise = Number(tx.amount ?? 0);

    // Subscription active for 30 days
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const graceEndsAt = new Date(endDate.getTime() + 2 * 24 * 60 * 60 * 1000);

    if (isPlatform) {
      // Try to update existing platform subscription first
      const updateResult = await pool.query(
        `UPDATE subscriptions
         SET status = 'ACTIVE', start_date = $2, end_date = $3, next_billing_date = $3, grace_ends_at = $4, updated_at = now()
         WHERE user_id = $1 AND type = 'PLATFORM'
         RETURNING id`,
        [userId, startDate, endDate, graceEndsAt]
      );
      if (updateResult.rowCount === 0) {
        // No existing row — insert fresh
        await pool.query(
          `INSERT INTO subscriptions (user_id, type, status, plan_type, start_date, end_date, next_billing_date, grace_ends_at, auto_renew, created_at, updated_at)
           VALUES ($1, 'PLATFORM', 'ACTIVE', 'MONTHLY', $2, $3, $3, $4, true, now(), now())`,
          [userId, startDate, endDate, graceEndsAt]
        );
      }
    } else {
      // Try to update existing artist subscription first
      const updateResult = await pool.query(
        `UPDATE subscriptions
         SET status = 'ACTIVE', start_date = $3, end_date = $4, next_billing_date = $4, grace_ends_at = $5, updated_at = now()
         WHERE user_id = $1 AND artist_id = $2 AND type = 'ARTIST'
         RETURNING id`,
        [userId, artistId, startDate, endDate, graceEndsAt]
      );
      if (updateResult.rowCount === 0) {
        // No existing row — insert fresh
        await pool.query(
          `INSERT INTO subscriptions (user_id, artist_id, type, status, plan_type, start_date, end_date, next_billing_date, grace_ends_at, auto_renew, created_at, updated_at)
           VALUES ($1, $2, 'ARTIST', 'ACTIVE', 'MONTHLY', $3, $4, $4, $5, true, now(), now())`,
          [userId, artistId, startDate, endDate, graceEndsAt]
        );
      }

      // Credit artist earnings asynchronously
      creditArtistEarnings(artistId, amountPaise).catch(() => undefined);
    }

    // Send success notification
    NotificationService.sendToUser({
      userId: String(userId),
      title: "Payment Successful! ✅",
      body: `Your payment was successful. Enjoy your ${planType === 'PLATFORM' ? 'Platform' : 'Artist'} subscription.`,
      data: { type: "payment_success", plan: planType }
    }).catch(e => logger.error(e, "[PAYMENT] Notification failed"));

    logger.info({ userId, planType, isPlatform, artistId, paymentId }, "[PAYMENT] Subscription activated after confirm");

    return res.json({
      success: true,
      message: "Payment confirmed. Subscription activated.",
      plan: planType,
      transaction: {
        razorpay_order_id: updatedTx?.razorpay_order_id ?? orderId,
        razorpay_payment_id: updatedTx?.razorpay_payment_id ?? paymentId,
        status: updatedTx?.status ?? "CAPTURED",
        amount: updatedTx?.amount ?? tx.amount,
        currency: updatedTx?.currency ?? tx.currency ?? "INR",
        payment_confirmed_at: updatedTx?.payment_confirmed_at ?? paymentConfirmedAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to confirm payment"
    });
  }
};


/**
 * Helper to credit artist earnings after a successful payment.
 * @param artistId The ID of the artist being subscribed to
 * @param amountPaise Total amount paid in paise/cents
 */
export async function creditArtistEarnings(artistId: number, amountPaise: number) {
  if (!artistId || artistId <= 0) return;
  try {
    // Get artist revenue share (default 80%)
    const artistRow = await pool.query(
      `SELECT COALESCE(NULLIF(revenue_share_percentage, 0), 80) as share FROM users WHERE id = $1`,
      [artistId]
    );
    const share = Number(artistRow.rows[0]?.share || 80);
    const earnings = (amountPaise / 100) * (share / 100);

    await pool.query(
      `INSERT INTO artist_stats (artist_id, total_earnings, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (artist_id) 
       DO UPDATE SET total_earnings = artist_stats.total_earnings + $2, updated_at = now()`,
      [artistId, earnings]
    );
    console.log(`[EARNINGS] Credited ${earnings} to artist ${artistId} (${share}% share)`);
  } catch (err) {
    console.error("[EARNINGS] Failed to credit earnings", { artistId, amountPaise }, err);
  }
}

/**
 * Helper to reverse artist earnings after a refund.
 */
export async function reverseArtistEarnings(artistId: number, amountPaise: number) {
  if (!artistId || artistId <= 0) return;
  try {
    const artistRow = await pool.query(
      `SELECT COALESCE(NULLIF(revenue_share_percentage, 0), 80) as share FROM users WHERE id = $1`,
      [artistId]
    );
    const share = Number(artistRow.rows[0]?.share || 80);
    const earnings = (amountPaise / 100) * (share / 100);

    await pool.query(
      `UPDATE artist_stats SET total_earnings = total_earnings - $2, updated_at = now() WHERE artist_id = $1`,
      [artistId, earnings]
    );
    console.log(`[EARNINGS] Reversed ${earnings} from artist ${artistId} (Refund)`);
  } catch (err) {
    console.error("[EARNINGS] Failed to reverse earnings", { artistId, amountPaise }, err);
  }
}

/**
 * Helper to log subscription audit events.
 */
async function logSubscriptionAudit(userId: number, subId: number | null, event: string, metadata: any, client?: any) {
  const db = client || pool;
  try {
    await db.query(
      `INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [userId, subId, event, metadata]
    );
  } catch (err) {
    console.error("[AUDIT] Failed to log event", { userId, subId, event }, err);
  }
}

export const razorpayWebhook = async (req: any, res: Response) => {
  const client = await pool.connect();
  try {
    const signatureHeader = (req.headers["x-razorpay-signature"] ?? "").toString();
    const body = JSON.stringify(req.body);
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (signatureHeader !== expectedSignature) {
      logger.error({
        remoteIP: req.ip,
        userAgent: req.headers['user-agent'],
        receivedSig: signatureHeader,
        expectedSig: expectedSignature,
        tags: ['ALERT', 'SECURITY']
      }, "[MONITOR] Webhook Signature Mismatch!");
      return res.status(400).send("Invalid signature");
    }

    const payload = req.body;
    const eventId = payload?.id;

    if (!eventId) {
       return res.status(400).send("Missing event ID");
    }

    // ── Idempotency Check ──────────────────────────────────────────
    const existingEvent = await pool.query(
      `SELECT event_id FROM processed_webhook_events WHERE event_id = $1`,
      [eventId]
    );
    if (existingEvent.rows.length > 0) {
      console.log(`[WEBHOOK] Event ${eventId} already processed. Skipping.`);
      return res.json({ success: true, duplicated: true });
    }

    const eventType = payload?.event;
    logger.info({ eventType, eventId }, "[WEBHOOK] Received event");

    // Start transaction for critical events
    await client.query('BEGIN');

    // Mark event as processed
    await client.query(
      `INSERT INTO processed_webhook_events (event_id, provider) VALUES ($1, 'razorpay')`,
      [eventId]
    );

    switch (eventType) {
      case "payment.captured": {
        const paymentEntity = payload?.payload?.payment?.entity ?? null;
        const orderId = (paymentEntity?.order_id ?? "").toString();
        const paymentId = (paymentEntity?.id ?? "").toString();

        if (orderId && paymentId) {
          const razorpayClient = getRazorpayClient();
          const order = await razorpayClient.orders.fetch(orderId).catch(() => null);
          if (order) {
            const notes = (order as any).notes || {};
            const userIdFromNotes = Number(notes?.user_id);
            const artistIdFromNotes = Number(notes?.artist_id);

            if (userIdFromNotes > 0 && artistIdFromNotes > 0) {
              const now = new Date();

              await client.query(
                `UPDATE transactions
                 SET status = 'SUCCESS', payment_confirmed_at = $2, razorpay_payment_id = $3
                 WHERE razorpay_order_id = $1`,
                [orderId, now, paymentId]
              );
            }
          }
        }
        break;
      }

      case "subscription.activated":
      case "subscription.charged": {
        const subEntity = payload?.payload?.subscription?.entity;
        if (!subEntity) break;
        const subId = subEntity.id;
        const nextBillingAt = subEntity.charge_at
          ? new Date(subEntity.charge_at * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const graceEndsAt = new Date(nextBillingAt.getTime() + 2 * 24 * 60 * 60 * 1000);

        const subRow = await client.query(
          `UPDATE subscriptions
           SET status = 'ACTIVE', next_billing_date = $2, grace_ends_at = $3, updated_at = now()
           WHERE razorpay_subscription_id = $1
           RETURNING id, user_id`,
          [subId, nextBillingAt, graceEndsAt]
        );
        const sub = subRow.rows?.[0];

        const paymentEntity = payload?.payload?.payment?.entity ?? null;
        const paymentId = (paymentEntity?.id ?? "").toString();
        const amountPaise = Number(paymentEntity?.amount ?? 0);
        
        if (sub && paymentId) {
          await client.query(
            `INSERT INTO payments (user_id, subscription_id, amount, status, razorpay_payment_id, created_at)
             VALUES ($1, $2, $3, 'SUCCESS', $4, now())
             ON CONFLICT (razorpay_payment_id) DO NOTHING`,
            [sub.user_id, sub.id, amountPaise, paymentId]
          );

          const subInfo = await client.query(`SELECT type, artist_id FROM subscriptions WHERE id = $1`, [sub.id]);
          if (subInfo.rows[0]?.type === 'ARTIST') {
             await creditArtistEarnings(subInfo.rows[0].artist_id, amountPaise);
          }
          
          await logSubscriptionAudit(sub.user_id, sub.id, 'subscription_activated', { payment_id: paymentId, amount: amountPaise }, client);

          // Notify user
          NotificationService.sendToUser({
            userId: String(sub.user_id),
            title: "Plan Activated! ✨",
            body: "Your subscription has been successfully activated. Open the app to start streaming!",
            data: { type: "subscription_activated", subId: sub.id }
          }).catch(e => logger.error(e, "[WEBHOOK] Notification failed"));
        }
        break;
      }

      case "refund.processed": {
        const refundEntity = payload?.payload?.refund?.entity;
        const paymentId = refundEntity?.payment_id;
        const amountPaise = refundEntity?.amount;

        if (paymentId) {
          const payRow = await client.query(`SELECT user_id, subscription_id FROM payments WHERE razorpay_payment_id = $1`, [paymentId]);
          const payment = payRow.rows[0];
          if (payment) {
             await client.query(
               `UPDATE subscriptions SET status = 'REFUNDED', updated_at = now() WHERE id = $1`,
               [payment.subscription_id]
             );
             
             const subRow = await client.query(`SELECT type, artist_id FROM subscriptions WHERE id = $1`, [payment.subscription_id]);
             if (subRow.rows[0]?.type === 'ARTIST') {
                await reverseArtistEarnings(subRow.rows[0].artist_id, amountPaise);
             }

             await logSubscriptionAudit(payment.user_id, payment.subscription_id, 'refund_processed', { payment_id: paymentId, amount: amountPaise }, client);
          }
        }
        break;
      }

      case "payment.failed": {
        const paymentEntity = payload?.payload?.payment?.entity;
        const subId = paymentEntity?.subscription_id;
        if (!subId) break;
        const graceEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await client.query(
          `UPDATE subscriptions
           SET status = 'PAST_DUE', grace_ends_at = $2, updated_at = now()
           WHERE razorpay_subscription_id = $1`,
          [subId, graceEnd]
        );

        // Fetch user_id for notification
        const subRow = await client.query(`SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = $1`, [subId]);
        if (subRow.rows[0]) {
          NotificationService.sendToUser({
            userId: String(subRow.rows[0].user_id),
            title: "Payment Failed ⚠️",
            body: "Your subscription payment failed. Please check your payment method to avoid losing access.",
            data: { type: "payment_failed", subId }
          }).catch(e => logger.error(e, "[WEBHOOK] Failure notification failed"));
        }
        break;
      }

      case "subscription.cancelled": {
        const subEntity = payload?.payload?.subscription?.entity;
        const subId = subEntity?.id;
        if (!subId) break;
        await client.query(
          `UPDATE subscriptions
           SET status = 'CANCELLED', auto_renew = false, grace_ends_at = now(), updated_at = now()
           WHERE razorpay_subscription_id = $1
           RETURNING id, user_id`,
          [subId]
        );
        const sub = (await client.query(`SELECT id, user_id FROM subscriptions WHERE razorpay_subscription_id = $1`, [subId])).rows[0];
        if (sub) {
           await logSubscriptionAudit(sub.user_id, sub.id, 'subscription_cancelled', { sub_id: subId }, client);
        }
        break;
      }

      case "subscription.expired": {
        const subEntity = payload?.payload?.subscription?.entity;
        const subId = subEntity?.id;
        if (!subId) break;
        await client.query(
          `UPDATE subscriptions
           SET status = 'EXPIRED', auto_renew = false, updated_at = now()
           WHERE razorpay_subscription_id = $1`,
          [subId]
        );
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${eventType}`);
    }

    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (err: any) {
    if (client) await client.query('ROLLBACK');
    logger.error({ error: err.message, stack: err.stack, eventId: req.body?.id, tags: ['ALERT', 'PAYMENT_FAILURE'] }, "[WEBHOOK] Error handling event");
    return res.status(500).send("Internal Server Error");
  } finally {
    if (client) client.release();
  }
};
