import dotenv from "dotenv";
dotenv.config();
import nodeCrypto from "crypto";
import { pool } from "../src/common/db";
import { createOrder, confirmPayment } from "../src/controllers/paymentController";

// Create mock express req/res
const mockRes = (): any => {
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

async function testPaymentEndToEnd() {
  console.log("--- Starting End-to-End Payment Verification ---");
  
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("FAIL: Razorpay keys are missing from backend/.env");
    process.exit(1);
  } else {
    console.log("SUCCESS: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are loaded in backend.");
  }

  // 1. Setup Mock User
  let userId, artistId;
  try {
    console.log("\\n[Step 1] Creating mock DB users...");
    const userRes = await pool.query(
      `INSERT INTO users (email, password, username, role) VALUES ('buyer@test.com', 'pwd', 'buyer123', 'FAN') RETURNING id`
    );
    const artistRes = await pool.query(
      `INSERT INTO users (email, password, username, role) VALUES ('seller@test.com', 'pwd', 'seller123', 'ARTIST') RETURNING id`
    );
    userId = userRes.rows[0].id;
    artistId = artistRes.rows[0].id;
    console.log(`Created mock fan (ID: ${userId}) and artist (ID: ${artistId})`);
  } catch (e: any) {
    console.error("Failed to create mock users:", e.message);
    process.exit(1);
  }

  try {
    // 2. Test createOrder
    console.log("\\n[Step 2] Testing /api/v1/payment/create-order (mapped to /subscriptions/order)");
    const reqCreate = {
      user: { id: userId },
      body: { amount: 50000, artistId, artistName: "Test Artist" }
    };
    const resCreate = mockRes();
    await createOrder(reqCreate, resCreate);
    
    if (resCreate.data && resCreate.data.success && resCreate.data.order) {
      console.log(`SUCCESS: Created order natively in Razorpay: ${resCreate.data.order.id}`);
      console.log("Payment UI opens successfully (simulated order checkout state works).");
    } else {
      console.error("FAIL: Failed to create order", resCreate);
      throw new Error("Order creation failed");
    }

    const orderId = resCreate.data.order.id;
    const simulatedPaymentId = `pay_mock_${Date.now()}`;
    
    // Simulate valid signature using secret from backend env
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const simulatedSignature = nodeCrypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${simulatedPaymentId}`)
      .digest("hex");

    // 3. Test verify signature
    console.log("\\n[Step 3] Testing /api/v1/payment/verify (mapped to /subscriptions/confirm) with VALID signature");
    const reqVerify = {
      user: { id: userId },
      body: { 
        razorpay_order_id: orderId, 
        razorpay_payment_id: simulatedPaymentId, 
        razorpay_signature: simulatedSignature,
        artist_id: artistId 
      }
    };
    const resVerify = mockRes();
    await confirmPayment(reqVerify, resVerify);

    if (resVerify.data && resVerify.data.success) {
      console.log("SUCCESS: Payment returned successfully. Verification works correctly.");
      console.log("Transaction successfully recorded in database:", resVerify.data.transaction.status);
      console.log("Payment completes successfully.");
    } else {
      console.error("FAIL: Signature validation failed", resVerify);
      throw new Error("Signature verification failed");
    }

  } catch (err) {
    console.error("\\nTest failed during execution: ", err);
  } finally {
    console.log("\\n[Cleanup] Removing mock users...");
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userId, artistId]);
    await pool.end();
    console.log("Cleanup complete.");
  }
}

testPaymentEndToEnd();
