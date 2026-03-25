import { Response } from "express";
import crypto from "crypto";
import { pool } from "../common/db";
import Razorpay from "razorpay";

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
    if (!Number.isFinite(artistIdNumber) || artistIdNumber <= 0) {
      const artistRow = await pool.query(
        `SELECT id
         FROM users
         WHERE username = $1
         LIMIT 1`,
        [artistIdRaw]
      );
      const resolved = Number(artistRow.rows?.[0]?.id);
      if (!Number.isFinite(resolved) || resolved <= 0) {
        return res.status(400).json({ success: false, message: "artistId is invalid" });
      }
      artistIdNumber = resolved;
    }

    const amountPaise = Math.floor(amountInt);
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
      const artistRow = await pool.query(
        `SELECT id
         FROM users
         WHERE username = $1
         LIMIT 1`,
        [artistIdRaw]
      );
      const resolved = Number(artistRow.rows?.[0]?.id);
      if (!Number.isFinite(resolved) || resolved <= 0) {
        return res.status(400).json({ success: false, message: "artist_id is invalid" });
      }
      artistId = resolved;
    }

    const keySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").toString().trim();
    if (!keySecret) {
      return res.status(500).json({ success: false, message: "RAZORPAY_KEY_SECRET is missing" });
    }

    const expectedSig = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (!safeEqualHex(expectedSig, signature)) {
      return res.status(400).json({ success: false, message: "Invalid Razorpay signature" });
    }

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

    const paymentConfirmedAt = new Date();
    const updated = await pool.query(
      `UPDATE transactions
       SET status = 'CAPTURED', payment_confirmed_at = $2, razorpay_payment_id = $3, razorpay_signature = $4
       WHERE razorpay_order_id = $1
       RETURNING id, user_id, razorpay_order_id, amount, currency, status, payment_confirmed_at, razorpay_payment_id, razorpay_signature`,
      [orderId, paymentConfirmedAt, paymentId, signature]
    );

    const updatedTx = updated.rows?.[0] ?? null;

    return res.json({
      success: true,
      message: "Payment submitted. Waiting for confirmation",
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

export const razorpayWebhook = async (req: any, res: Response) => {
  try {
    const signatureHeader = (req.headers["x-razorpay-signature"] ?? "").toString();
    if (!signatureHeader) {
      return res.status(400).json({ success: false, message: "Missing x-razorpay-signature" });
    }

    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_KEY_SECRET ?? "")
      .toString()
      .trim();
    if (!webhookSecret) {
      return res.status(500).json({ success: false, message: "Webhook secret missing" });
    }

    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    const sigA = expected;
    const sigB = signatureHeader;
    if (!safeEqualHex(sigA, sigB)) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const payload = JSON.parse(rawBody.toString("utf8") || "{}");
    const event = (payload?.event ?? "").toString();

    // Log the event concisely
    console.log(`[Webhook] Received event: ${event}`);

    switch (event) {
      case "payment.captured": {
        const paymentEntity = payload?.payload?.payment?.entity ?? null;
        const orderId = (paymentEntity?.order_id ?? "").toString();
        const paymentId = (paymentEntity?.id ?? "").toString();

        if (orderId && paymentId) {
          const client = getRazorpayClient();
          const order = await client.orders.fetch(orderId).catch(() => null);
          if (order) {
            const notes = (order as any).notes || {};
            const userIdFromNotes = Number(notes?.user_id);
            const artistIdFromNotes = Number(notes?.artist_id);

            if (userIdFromNotes > 0 && artistIdFromNotes > 0) {
              const now = new Date();
              const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

              await pool.query(
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
        const nextBillingAt = subEntity.charge_at ? new Date(subEntity.charge_at * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        await pool.query(
          `UPDATE subscriptions 
           SET status = 'ACTIVE', next_billing_date = $2, updated_at = now()
           WHERE razorpay_subscription_id = $1`,
          [subId, nextBillingAt]
        );
        console.log(`[SUCCESS] Subscription activated/charged: ${subId}`);
        break;
      }

      case "payment.failed": {
        const paymentEntity = payload?.payload?.payment?.entity;
        const subId = paymentEntity?.subscription_id;
        if (!subId) break;
        await pool.query(
          `UPDATE subscriptions SET status = 'PAST_DUE', updated_at = now() WHERE razorpay_subscription_id = $1`,
          [subId]
        );
        console.log(`[ERROR] Payment failed for sub: ${subId}`);
        break;
      }

      case "subscription.cancelled": {
        const subEntity = payload?.payload?.subscription?.entity;
        const subId = subEntity?.id;
        if (!subId) break;
        await pool.query(
          `UPDATE subscriptions SET status = 'CANCELLED', auto_renew = false, updated_at = now() WHERE razorpay_subscription_id = $1`,
          [subId]
        );
        console.log(`[INFO] Subscription cancelled: ${subId}`);
        break;
      }
    }

    return res.json({ success: true, received: true });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Webhook handling failed",
    });
  }
};
