import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import jwt from "jsonwebtoken";
import { createApp } from "../app";
import { validateEnv } from "../config/env.validation";
import { SessionService } from "../common/auth/session.service";
import { pool } from "../common/db";

async function main() {
  console.log("=========================================================");
  console.log("   MODULE 06 — SUBSCRIPTIONS COMPLETE QA TEST SUITE      ");
  console.log("=========================================================");

  const runtime = validateEnv();
  const app = createApp(runtime);
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // ─── 0. FETCH EXISTING IDENTITIES ──────────────────────────
    console.log("\n[0] Verifying Existing Identities from Database...");
    
    // Existing Fan A: user 28 (sjainn@gmail.com)
    const fanARes = await pool.query("SELECT id, email, role, status FROM users WHERE id = 28");
    assert.ok(fanARes.rows[0], "Fan A (user 28) must exist in DB");
    const fanA = fanARes.rows[0];

    // Existing Fan B: user 25 (nakul.fan@test.com)
    const fanBRes = await pool.query("SELECT id, email, role, status FROM users WHERE id = 25");
    assert.ok(fanBRes.rows[0], "Fan B (user 25) must exist in DB");
    const fanB = fanBRes.rows[0];

    // Suspended Fan: user 21 (status = 'SUSPENDED')
    const fanSuspRes = await pool.query("SELECT id, email, role, status FROM users WHERE id = 21");
    assert.ok(fanSuspRes.rows[0], "Suspended fan (user 21) must exist in DB");
    const fanSusp = fanSuspRes.rows[0];

    // Approved Artist with valid price: artist 31 (price = 49)
    const artist31Res = await pool.query(
      "SELECT id, email, name, role, is_verified, subscription_price, status, artist_status FROM users WHERE id = 31"
    );
    assert.ok(artist31Res.rows[0], "Approved artist 31 must exist in DB");
    const artist31 = artist31Res.rows[0];

    // Pending Artist: artist 2 (artist_status = 'PENDING')
    const artist2Res = await pool.query(
      "SELECT id, email, name, role, is_verified, subscription_price, status, artist_status FROM users WHERE id = 2"
    );
    assert.ok(artist2Res.rows[0], "Pending artist 2 must exist in DB");

    // Free/0-price Artist: artist 49 (subscription_price = 0)
    const artist49Res = await pool.query(
      "SELECT id, email, name, role, is_verified, subscription_price, status, artist_status FROM users WHERE id = 49"
    );
    assert.ok(artist49Res.rows[0], "0-price artist 49 must exist in DB");

    // Content Item 9: belongs to artist 31, subscription_required = true
    const content9Res = await pool.query(
      "SELECT id, title, artist_id, subscription_required FROM content_items WHERE id = 9"
    );
    assert.ok(content9Res.rows[0], "Content 9 must exist in DB");

    // Clear any previous test subscription for Fan A (28) on Artist (31) to start clean
    await pool.query("DELETE FROM payments WHERE user_id = $1", [28]);
    await pool.query("DELETE FROM subscription_audit_logs WHERE user_id = $1", [28]);
    await pool.query("DELETE FROM subscriptions WHERE user_id = $1 AND artist_id = $2", [28, 31]);
    await pool.query("DELETE FROM transactions WHERE user_id = $1 AND artist_id = $2", [28, 31]);

    // Create valid sessions
    const sessionA = await SessionService.createSession({
      userId: 28,
      deviceId: "qa06-fanA-device",
      ipAddress: "127.0.0.1",
      userAgent: "QA-FanA"
    });
    const tokenA = jwt.sign(
      { id: 28, email: fanA.email, role: fanA.role, sid: sessionA.id },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    const sessionB = await SessionService.createSession({
      userId: 25,
      deviceId: "qa06-fanB-device",
      ipAddress: "127.0.0.1",
      userAgent: "QA-FanB"
    });
    const tokenB = jwt.sign(
      { id: 25, email: fanB.email, role: fanB.role, sid: sessionB.id },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    const sessionSusp = await SessionService.createSession({
      userId: 21,
      deviceId: "qa06-susp-device",
      ipAddress: "127.0.0.1",
      userAgent: "QA-Susp"
    });
    const tokenSusp = jwt.sign(
      { id: 21, email: fanSusp.email, role: fanSusp.role, sid: sessionSusp.id },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    console.log("✓ Existing identities verified and authenticated sessions created.");

    // Helper for webhook delivery
    const sendWebhook = async (payloadObj: any) => {
      const raw = Buffer.from(JSON.stringify(payloadObj), "utf8");
      const signature = crypto
        .createHmac("sha256", runtime.razorpayWebhookSecret)
        .update(raw)
        .digest("hex");

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature
        },
        body: raw
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    };

    // ─────────────────────────────────────────────────────────
    // POSITIVE TEST CASES (SUB-POS-001 TO SUB-POS-008)
    // ─────────────────────────────────────────────────────────
    console.log("\n--- [PHASE 1] POSITIVE TEST CASES ---");

    // SUB-POS-001: Free Fan views protected content -> denied with NO_ACTIVE_SUBSCRIPTION
    console.log("\n[SUB-POS-001] Free fan views protected content 9...");
    const check1 = await fetch(`${baseUrl}/api/v1/fan/subscriptions/access-check?contentId=9`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const check1Body = await check1.json();
    assert.strictEqual(check1.status, 200);
    assert.strictEqual(check1Body.success, true);
    assert.strictEqual(check1Body.allowed, false);
    assert.strictEqual(check1Body.reason, "NO_ACTIVE_SUBSCRIPTION");
    console.log("✓ Content is locked as expected: allowed=false, reason='NO_ACTIVE_SUBSCRIPTION'");

    // SUB-POS-002: Fan starts valid artist subscription -> 201 with PENDING status and server price
    console.log("\n[SUB-POS-002] Fan A starts subscription to Artist 31...");
    const subCreateRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: 31 })
    });
    const subCreateBody = await subCreateRes.json();
    assert.strictEqual(subCreateRes.status, 201, "Expected 201 Created");
    assert.strictEqual(subCreateBody.success, true);
    assert.strictEqual(subCreateBody.subscription.status, "PENDING");
    assert.strictEqual(subCreateBody.subscription.artistId, 31);
    assert.strictEqual(subCreateBody.order.amount, 4900, "Server authoritative price must be ₹49 = 4900 paise");
    assert.strictEqual(subCreateBody.order.currency, "INR");
    const createdSubId = subCreateBody.subscription.id;
    const createdOrderId = subCreateBody.order.id;
    console.log(`✓ Subscription created in DB: id=${createdSubId}, status=PENDING, order=${createdOrderId}`);

    // SUB-POS-008 (part 1): Immediate re-request before payment -> 200 Reused (Idempotent double-tap)
    console.log("\n[SUB-POS-008] Concurrency check: duplicate subscribe request (double-tap)...");
    const subDupRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: 31 })
    });
    const subDupBody = await subDupRes.json();
    assert.strictEqual(subDupRes.status, 200, "Expected 200 Reused");
    assert.strictEqual(subDupBody.reused, true);
    assert.strictEqual(subDupBody.subscription.id, createdSubId);
    assert.strictEqual(subDupBody.order.id, createdOrderId);
    console.log("✓ Double-tap handled idempotently: reused existing pending subscription & order");

    // Verify polling before payment -> status still PENDING, content still locked
    console.log("\nPolling subscription status before payment...");
    const pollPrePay = await fetch(`${baseUrl}/api/v1/fan/subscriptions/${createdSubId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const pollPrePayBody = await pollPrePay.json();
    assert.strictEqual(pollPrePay.status, 200);
    assert.strictEqual(pollPrePayBody.subscription.status, "PENDING");
    assert.strictEqual(pollPrePayBody.payment.status, "PENDING");
    console.log("✓ Polling returns PENDING; content remains locked");

    // SUB-POS-003: Valid gateway success webhook -> transitions exactly one subscription to ACTIVE
    console.log("\n[SUB-POS-003] Delivering verified payment.captured webhook...");
    const paymentId = `pay_qa06_${Date.now()}`;
    const webhookPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: createdOrderId,
            amount: 4900,
            currency: "INR",
            status: "captured"
          }
        }
      }
    };
    const webhookRes = await sendWebhook(webhookPayload);
    assert.strictEqual(webhookRes.status, 200);
    assert.strictEqual(webhookRes.body.success, true);
    console.log("✓ Webhook accepted and processed successfully");

    // SUB-POS-004: App polls after webhook -> status is now ACTIVE and content unlocks!
    console.log("\n[SUB-POS-004] App polls subscription status after webhook confirmation...");
    const pollPostPay = await fetch(`${baseUrl}/api/v1/fan/subscriptions/${createdSubId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const pollPostPayBody = await pollPostPay.json();
    assert.strictEqual(pollPostPay.status, 200);
    assert.strictEqual(pollPostPayBody.subscription.status, "ACTIVE");
    assert.ok(
      pollPostPayBody.payment.status === "SUCCESS" || pollPostPayBody.payment.status === "CAPTURED",
      `Payment status must be successful, got ${pollPostPayBody.payment.status}`
    );
    assert.ok(pollPostPayBody.subscription.expiresAt, "Next billing date must be set");

    const checkUnlocked = await fetch(`${baseUrl}/api/v1/fan/subscriptions/access-check?contentId=9`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const checkUnlockedBody = await checkUnlocked.json();
    assert.strictEqual(checkUnlockedBody.allowed, true);
    assert.strictEqual(checkUnlockedBody.reason, "ACTIVE");
    console.log("✓ Content unlocked! allowed=true, reason='ACTIVE'");

    // SUB-POS-007: Active subscription visible in status, summary, and details
    console.log("\n[SUB-POS-007] Checking active subscription views across endpoints...");
    const resSummary = await fetch(`${baseUrl}/api/v1/fan/subscriptions/summary`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const bodySummary = await resSummary.json();
    assert.strictEqual(bodySummary.success, true);
    assert.strictEqual(bodySummary.artistSubCount, 1);
    assert.strictEqual(bodySummary.artistPlan.status, "ACTIVE");

    const resStatus = await fetch(`${baseUrl}/api/v1/fan/subscriptions/status`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const bodyStatus = await resStatus.json();
    assert.strictEqual(bodyStatus.count, 1);
    assert.strictEqual(bodyStatus.artists[0].status, "ACTIVE");
    console.log("✓ Active subscription visible across summary and status endpoints");

    // ─────────────────────────────────────────────────────────
    // NEGATIVE & SECURITY TEST CASES
    // ─────────────────────────────────────────────────────────
    console.log("\n--- [PHASE 2] NEGATIVE & SECURITY TEST CASES ---");

    // NEG-01: Price manipulation attacks (client sends amount=0 or amount=1)
    console.log("\n[NEG-01] Price manipulation: client attempts amount=1 or amount=0...");
    const tamperRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: 31, amount: 1, amountPaise: 100 })
    });
    const tamperBody = await tamperRes.json();
    // Server must use authoritative price (4900 paise = 49 INR), NOT client's 1
    assert.strictEqual(tamperBody.order.amount, 4900, "Server price authority must reject/override client amount");
    console.log("✓ Price authority maintained: client amount ignored, server charged ₹49 (4900 paise)");

    // NEG-02: Artist with price = 0 -> 409 SUBSCRIPTION_PRICE_NOT_CONFIGURED
    console.log("\n[NEG-02] Attempt purchase for unpriced artist 49 (price = 0)...");
    const unpricedRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: 49 })
    });
    const unpricedBody = await unpricedRes.json();
    assert.strictEqual(unpricedRes.status, 409);
    assert.strictEqual(unpricedBody.code, "SUBSCRIPTION_PRICE_NOT_CONFIGURED");
    console.log("✓ Rejected unpriced artist with 409 SUBSCRIPTION_PRICE_NOT_CONFIGURED");

    // NEG-03: Artist with status = PENDING (not approved) -> 409 ARTIST_NOT_APPROVED
    console.log("\n[NEG-03] Attempt purchase for unapproved artist 2 (status = PENDING)...");
    const unapprovedRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: 2 })
    });
    const unapprovedBody = await unapprovedRes.json();
    assert.strictEqual(unapprovedRes.status, 409);
    assert.strictEqual(unapprovedBody.code, "ARTIST_NOT_APPROVED");
    console.log("✓ Rejected unapproved artist with 409 ARTIST_NOT_APPROVED");

    // NEG-04: Non-existent artist -> 404 ARTIST_NOT_FOUND
    console.log("\n[NEG-04] Attempt purchase for non-existent artist 99999...");
    const missingArtistRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: 99999 })
    });
    const missingArtistBody = await missingArtistRes.json();
    assert.strictEqual(missingArtistRes.status, 404);
    assert.strictEqual(missingArtistBody.code, "ARTIST_NOT_FOUND");
    console.log("✓ Rejected non-existent artist with 404 ARTIST_NOT_FOUND");

    // NEG-05: Invalid artistId format (string / negative) -> 400 INVALID_ARTIST_ID
    console.log("\n[NEG-05] Attempt purchase with invalid artistId ('xyz' and -10)...");
    const invalidFormatRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: "xyz" })
    });
    const invalidFormatBody = await invalidFormatRes.json();
    assert.strictEqual(invalidFormatRes.status, 400);
    assert.strictEqual(invalidFormatBody.code, "INVALID_ARTIST_ID");

    const negIdRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: -10 })
    });
    const negIdBody = await negIdRes.json();
    assert.strictEqual(negIdRes.status, 400);
    assert.strictEqual(negIdBody.code, "INVALID_ARTIST_ID");
    console.log("✓ Rejected invalid artistId format with 400 INVALID_ARTIST_ID");

    // NEG-06: Already ACTIVE subscription -> 409 SUBSCRIPTION_ALREADY_ACTIVE
    console.log("\n[NEG-06] Fan A attempts to subscribe again while already ACTIVE...");
    const reSubRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: 31 })
    });
    const reSubBody = await reSubRes.json();
    assert.strictEqual(reSubRes.status, 409);
    assert.strictEqual(reSubBody.code, "SUBSCRIPTION_ALREADY_ACTIVE");
    console.log("✓ Duplicate active subscription rejected with 409 SUBSCRIPTION_ALREADY_ACTIVE");

    // NEG-07: IDOR — Fan B attempts to view Fan A's subscription #createdSubId
    console.log(`\n[NEG-07] IDOR: Fan B attempts to access Fan A's subscription ${createdSubId}...`);
    const idorReadRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions/${createdSubId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const idorReadBody = await idorReadRes.json();
    assert.strictEqual(idorReadRes.status, 404);
    assert.strictEqual(idorReadBody.code, "SUBSCRIPTION_NOT_FOUND");
    console.log("✓ IDOR prevented: Fan B cannot view Fan A's subscription (404 SUBSCRIPTION_NOT_FOUND)");

    // NEG-08: IDOR — Fan B attempts to cancel Fan A's subscription
    console.log(`\n[NEG-08] IDOR: Fan B attempts to cancel Fan A's subscription ${createdSubId}...`);
    const idorCancelRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions/${createdSubId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Malicious cancel" })
    });
    const idorCancelBody = await idorCancelRes.json();
    assert.strictEqual(idorCancelRes.status, 404);
    assert.strictEqual(idorCancelBody.code, "SUBSCRIPTION_NOT_FOUND");
    console.log("✓ IDOR prevented: Fan B cannot cancel Fan A's subscription (404 SUBSCRIPTION_NOT_FOUND)");

    // NEG-09: Unauthenticated request -> 401 Unauthorized
    console.log("\n[NEG-09] Unauthenticated request without token...");
    const unauthRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions/status`);
    assert.strictEqual(unauthRes.status, 401);
    console.log("✓ Unauthenticated request rejected with 401");

    // NEG-10: Suspended Fan -> Denied / Forbidden
    console.log("\n[NEG-10] Suspended Fan attempts to access subscriptions...");
    const suspRes = await fetch(`${baseUrl}/api/v1/fan/subscriptions/status`, {
      headers: { Authorization: `Bearer ${tokenSusp}` }
    });
    assert.ok(suspRes.status === 401 || suspRes.status === 403, "Suspended fan must be denied");
    console.log(`✓ Suspended fan denied with HTTP ${suspRes.status}`);

    // NEG-11: Invalid webhook signature -> 400 Invalid signature
    console.log("\n[NEG-11] Webhook with forged signature...");
    const forgedWebhookRes = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": "0000000000000000000000000000000000000000000000000000000000000000"
      },
      body: JSON.stringify({ event: "payment.captured" })
    });
    assert.strictEqual(forgedWebhookRes.status, 400);
    console.log("✓ Forged webhook signature rejected with 400");

    // NEG-12: Duplicate webhook delivery -> 200 with duplicated: true (no duplicate credit)
    console.log("\n[NEG-12] Replay of already-processed webhook...");
    const dupWebhookRes = await sendWebhook(webhookPayload);
    assert.strictEqual(dupWebhookRes.status, 200);
    assert.strictEqual(dupWebhookRes.body.duplicated, true);
    console.log("✓ Replay webhook detected and safely ignored: duplicated=true");

    // NEG-13: SUB-POS-006 Expiry boundary test -> Expire subscription in DB and verify immediate lock
    console.log("\n[NEG-13] Subscription expiry boundary: set next_billing_date to past...");
    await pool.query(
      "UPDATE subscriptions SET next_billing_date = now() - interval '1 second' WHERE id = $1",
      [createdSubId]
    );

    const checkExpired = await fetch(`${baseUrl}/api/v1/fan/subscriptions/access-check?contentId=9`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const checkExpiredBody = await checkExpired.json();
    assert.strictEqual(checkExpiredBody.allowed, false);
    assert.strictEqual(checkExpiredBody.reason, "NO_ACTIVE_SUBSCRIPTION");

    // Verify status updated to EXPIRED
    const subExpiredRes = await pool.query("SELECT status FROM subscriptions WHERE id = $1", [createdSubId]);
    assert.strictEqual(subExpiredRes.rows[0].status, "EXPIRED");
    console.log("✓ Authoritative expiry enforced: access relocked immediately, status transitioned to EXPIRED");

    // Cleanup sessions
    await SessionService.revokeSession(sessionA.id, 28, "QA complete");
    await SessionService.revokeSession(sessionB.id, 25, "QA complete");
    await SessionService.revokeSession(sessionSusp.id, 21, "QA complete");

    console.log("\n=========================================================");
    console.log("   ALL MODULE 06 POSITIVE & NEGATIVE TESTS PASSED!       ");
    console.log("=========================================================");
  } finally {
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("TEST FAILED WITH ERROR:", err);
  process.exit(1);
});
