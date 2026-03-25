import { Response } from "express";
import crypto from "crypto";
import { pool } from "../common/db";
import { razorpayClient } from "../config/razorpay";

const safeEqualHex = (aHex: string, bHex: string) => {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export const createSubscription = async (req: any, res: Response) => {
  try {
    const userId = Number(req.user?.id);
    const { artistId, planId } = req.body as {
      artistId?: number | string;
      planId?: string;
    };

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!planId) {
      return res.status(400).json({ success: false, message: "planId is required" });
    }

    const artistIdRaw = (artistId ?? "").toString().trim();
    let artistIdNum = Number(artistIdRaw);

    if (!Number.isFinite(artistIdNum) || artistIdNum <= 0) {
      const artistRow = await pool.query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [artistIdRaw]
      );
      const resolved = Number(artistRow.rows?.[0]?.id);
      if (!Number.isFinite(resolved) || resolved <= 0) {
        return res.status(400).json({ success: false, message: "Valid artistId is required" });
      }
      artistIdNum = resolved;
    }

    // Check if user has an active subscription to this artist
    const activeSub = await pool.query(
      `SELECT id, status FROM subscriptions 
       WHERE user_id = $1 AND artist_id = $2 AND status IN ('ACTIVE', 'CREATED', 'AUTHENTICATED')
       LIMIT 1`,
      [userId, artistIdNum]
    );

    if (activeSub.rows.length > 0 && activeSub.rows[0].status === 'ACTIVE') {
      return res.status(400).json({ success: false, message: "Active subscription already exists" });
    }

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
      total_count: 120, // max allowed roughly
      customer_notify: 1,
      notes: {
        user_id: String(userId),
        artist_id: String(artistIdNum),
      }
    } as any)) as any;

    await pool.query(
      `INSERT INTO subscriptions 
       (user_id, artist_id, status, plan_type, razorpay_subscription_id, plan_id, start_date)
       VALUES ($1, $2, 'CREATED', 'MONTHLY', $3, $4, now())
       ON CONFLICT (user_id, artist_id)
       DO UPDATE SET 
          status = 'CREATED',
          razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
          plan_id = EXCLUDED.plan_id,
          updated_at = now()`,
      [userId, artistIdNum, subscription.id, planId.trim()]
    );

    return res.json({
      success: true,
      subscription_id: subscription.id,
      key_id: (process.env.RAZORPAY_KEY_ID ?? "").toString()
    });

  } catch (err: any) {
    if (err.statusCode === 400 && err.error?.description) {
         return res.status(400).json({ success: false, message: err.error.description });
    }
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to create subscription"
    });
  }
};

export const verifySubscription = async (req: any, res: Response) => {
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

    // Verify signature: razorpay_payment_id|razorpay_subscription_id
    const payload = `${razorpay_payment_id}|${razorpay_subscription_id}`;
    const expectedSig = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    if (!safeEqualHex(expectedSig, razorpay_signature)) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    const subResult = await pool.query(
      `SELECT id, user_id, status FROM subscriptions 
       WHERE razorpay_subscription_id = $1 LIMIT 1`,
      [razorpay_subscription_id]
    );

    const sub = subResult.rows[0];
    if (!sub || Number(sub.user_id) !== userId) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    // Since verified by frontend successfully, tentatively active, but webhook is the absolute source of truth
    const paymentConfirmedAt = new Date();
    // Default next_billing_date to T+30 for now, webhook will override this to exact dates.
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);

    await pool.query(
      `UPDATE subscriptions 
       SET status = 'ACTIVE', 
           payment_id = $2, 
           updated_at = $3,
           next_billing_date = $4
       WHERE razorpay_subscription_id = $1`,
      [razorpay_subscription_id, razorpay_payment_id, paymentConfirmedAt, nextBillingDate]
    );

    return res.json({
      success: true,
      message: "Subscription verified successfully",
      subscription: {
        razorpay_subscription_id,
        status: "ACTIVE",
        payment_id: razorpay_payment_id
      }
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Verification failed"
    });
  }
};
