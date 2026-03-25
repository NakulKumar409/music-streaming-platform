import dotenv from 'dotenv';
dotenv.config();
import { createSubscription, verifySubscription } from "./src/controllers/subscriptionController";
import { razorpayWebhook } from "./src/controllers/paymentController";
import { pool } from "./src/common/db";
import crypto from 'crypto';

const mockRes = () => {
    const res: any = {};
    res.status = (code: number) => { 
        res.statusCode = code; 
        return res; 
    };
    res.json = (data: any) => { 
        res.data = data; 
        return res; 
    };
    return res;
};

async function runTests() {
    try {
        console.log("Setting up mock user and artist...");
        const userRes = await pool.query(`INSERT INTO users (email, password, username, role) VALUES ('testfan@example.com', 'pwd', 'testfan123', 'FAN') RETURNING id`);
        const artistRes = await pool.query(`INSERT INTO users (email, password, username, role) VALUES ('testartist@example.com', 'pwd', 'testartist123', 'ARTIST') RETURNING id`);
        const userId = userRes.rows[0].id;
        const artistId = artistRes.rows[0].id;

        console.log("Mock Users created:", {userId, artistId});

        // Test 1: Create Subscription
        console.log("\\n--- Test 1: Create Subscription ---");
        let req1 = {
            user: { id: userId },
            body: { artistId, planId: "plan_test123" }
        };
        let res1 = mockRes();
        await createSubscription(req1, res1);
        console.log("Create Sub status:", res1.statusCode, res1.data);
        const subId = res1.data?.subscription_id;

        if (!subId) throw new Error("Subscription creation failed, no subscription_id returned");

        // Test 2: Invalid Signature Verify
        console.log("\\n--- Test 2: Invalid Signature Verify ---");
        let req2 = {
            user: { id: userId },
            body: { razorpay_payment_id: "pay_invalid", razorpay_signature: "invalid_sig", razorpay_subscription_id: subId }
        };
        let res2 = mockRes();
        await verifySubscription(req2, res2);
        console.log("Invalid Verify status:", res2.statusCode, res2.data);
        if (res2.statusCode !== 400) throw new Error("Invalid signature didn't fail!");

        // Test 3: Webhook Subscription Activated
        console.log("\\n--- Test 3: Valid Webhook (Activated) ---");
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
        const payload = JSON.stringify({
            event: "subscription.activated",
            payload: {
                subscription: {
                    entity: { id: subId, charge_at: Math.floor(Date.now() / 1000) + 86400 * 30 }
                }
            }
        });
        const sig = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
        let req3 = {
            headers: { "x-razorpay-signature": sig },
            body: Buffer.from(payload)
        };
        let res3 = mockRes();
        await razorpayWebhook(req3, res3);
        console.log("Webhook Activated status:", res3.statusCode, res3.data);

        const subFromDb = await pool.query(`SELECT status, next_billing_date FROM subscriptions WHERE razorpay_subscription_id = $1`, [subId]);
        console.log("DB status after webhook:", subFromDb.rows[0]);

        // Cleanup
        console.log("\\nCleaning up...");
        await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userId, artistId]);
        console.log("Tests Complete.");
    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        await pool.end();
    }
}

runTests();
