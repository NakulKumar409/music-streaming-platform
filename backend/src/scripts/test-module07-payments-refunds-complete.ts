import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createApp } from "../app";
import { validateEnv } from "../config/env.validation";
import { pool } from "../common/db";
import { SessionService } from "../common/auth/session.service";
import {
  deriveWebhookEventId,
  parseVerifiedWebhookPayload,
  verifyWebhookSignature,
} from "../modules/payment/payment.security";
import { rupeesToPaise } from "../modules/payment/payment.service";
import {
  initiateFullRefund,
  reconcilePendingRefunds,
  getRefundRequest,
  reconcileRefundRequest,
} from "../modules/payment/payment.refund.service";
import {
  reconcileProviderRefundDrift,
} from "../modules/payment/payment.refund.reconciliation";
import { processVerifiedRefundEvent } from "../modules/payment/payment.refund.webhook";
import { hasActiveArtistEntitlement } from "../shared/security/artist-entitlement.service";
import type { RefundGateway, GatewayRefund } from "../modules/payment/payment.refund.gateway";

class MockTestRefundGateway implements RefundGateway {
  createCalls = 0;
  mode: "processed" | "ambiguous" | "failed" = "processed";
  lastInput: { paymentId: string; amountPaise: number; refundRequestId: string; idempotencyKey: string } | null = null;

  async createFullRefund(input: { paymentId: string; amountPaise: number; refundRequestId: string; idempotencyKey: string }): Promise<GatewayRefund> {
    this.createCalls += 1;
    this.lastInput = input;
    if (this.mode === "ambiguous") {
      throw new Error("Simulated gateway network timeout");
    }
    return {
      id: `rfnd_mock_${input.refundRequestId.replace(/-/g, "").slice(0, 12)}`,
      paymentId: input.paymentId,
      amountPaise: input.amountPaise,
      currency: "INR",
      status: this.mode === "failed" ? "failed" : "processed",
      notes: { refund_request_id: input.refundRequestId, idempotency_key: input.idempotencyKey },
    };
  }

  async listRefunds(paymentId: string): Promise<GatewayRefund[]> {
    if (!this.lastInput) return [];
    return [{
      id: `rfnd_mock_${this.lastInput.refundRequestId.replace(/-/g, "").slice(0, 12)}`,
      paymentId,
      amountPaise: this.lastInput.amountPaise,
      currency: "INR",
      status: this.mode === "failed" ? "failed" : "processed",
      notes: { refund_request_id: this.lastInput.refundRequestId, idempotency_key: this.lastInput.idempotencyKey },
    }];
  }

  async fetchPayment(paymentId: string) {
    const amount = this.lastInput?.amountPaise ?? 4900;
    return {
      paymentId,
      amountPaise: amount,
      amountRefundedPaise: this.mode === "failed" ? 0 : amount,
      currency: "INR",
      status: "captured",
      refundStatus: this.mode === "failed" ? "failed" : "full",
    };
  }
}

async function requestJson(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    rawBody?: Buffer;
  } = {}
) {
  const url = new URL(path, baseUrl);
  const method = options.method || "GET";
  const headers: Record<string, string> = { ...(options.headers || {}) };

  let dataToSend: Buffer | undefined;
  if (options.rawBody) {
    dataToSend = options.rawBody;
  } else if (options.body !== undefined) {
    dataToSend = Buffer.from(JSON.stringify(options.body), "utf8");
    if (!headers["content-type"]) {
      headers["content-type"] = "application/json";
    }
  }

  if (dataToSend && !headers["content-length"]) {
    headers["content-length"] = String(dataToSend.length);
  }

  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; rawText: string }>(
    (resolve, reject) => {
      const req = http.request(
        url,
        {
          method,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const rawText = Buffer.concat(chunks).toString("utf8");
            let parsedBody: any = null;
            try {
              parsedBody = JSON.parse(rawText);
            } catch {
              parsedBody = rawText;
            }
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: parsedBody,
              rawText,
            });
          });
        }
      );
      req.on("error", reject);
      if (dataToSend) req.write(dataToSend);
      req.end();
    }
  );
}

function signWebhook(raw: Buffer, secret: string) {
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

async function run() {
  console.log("================================================================================");
  console.log("MODULE 07 — PAYMENTS, RAZORPAY WEBHOOKS, REFUNDS & RECONCILIATION QA SUITE");
  console.log("================================================================================\n");

  const runtime = validateEnv();
  const webhookSecret = runtime.razorpayWebhookSecret;
  const app = createApp(runtime);
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[INIT] Test server running on ${baseUrl}`);

  try {
    // ─── 1. DISCOVER / ENSURE REAL IDENTITIES ─────────────────────────────────────
    console.log("\n[1] Discovering & Preparing Real Database Entities...");

    // Admin: ID 1
    const adminRes = await pool.query("SELECT id, email, role FROM users WHERE id = 1 AND role = 'ADMIN'");
    assert.ok(adminRes.rows[0], "Admin user (id 1) must exist");
    const adminUser = adminRes.rows[0];

    // Ensure a Finance user exists for Module 07 finance authorization tests
    let financeUser: any;
    const existingFinance = await pool.query("SELECT id, email, role FROM users WHERE role = 'FINANCE' LIMIT 1");
    if (existingFinance.rows[0]) {
      financeUser = existingFinance.rows[0];
    } else {
      const hash = await bcrypt.hash("finance123", 10);
      const insertedFinance = await pool.query(
        `INSERT INTO users (email, password, role, name, status, is_verified)
         VALUES ('finance@test.com', $1, 'FINANCE', 'Finance Manager', 'ACTIVE', true)
         ON CONFLICT (email) DO UPDATE SET role = 'FINANCE'
         RETURNING id, email, role`,
        [hash]
      );
      financeUser = insertedFinance.rows[0];
    }
    assert.ok(financeUser, "Finance user must exist");
    console.log(` -> Admin: ID ${adminUser.id} (${adminUser.email}), Finance: ID ${financeUser.id} (${financeUser.email})`);

    // Artist: ID 31 (Arjit Singh, subscription_price = 49)
    const artistRes = await pool.query(
      "SELECT id, email, name, role, artist_status, subscription_price FROM users WHERE id = 31"
    );
    assert.ok(artistRes.rows[0], "Artist 31 must exist");
    const artistUser = artistRes.rows[0];
    assert.strictEqual(artistUser.artist_status, "APPROVED");
    assert.strictEqual(Number(artistUser.subscription_price), 49);
    console.log(` -> Artist: ID ${artistUser.id} (${artistUser.name}, Price: ₹${artistUser.subscription_price})`);

    // Fan A: ID 28 (sjainn@gmail.com)
    const fanARes = await pool.query("SELECT id, email, role, status FROM users WHERE id = 28");
    assert.ok(fanARes.rows[0], "Fan A (ID 28) must exist");
    const fanA = fanARes.rows[0];

    // Fan B: ID 25 (nakul.fan@test.com)
    const fanBRes = await pool.query("SELECT id, email, role, status FROM users WHERE id = 25");
    assert.ok(fanBRes.rows[0], "Fan B (ID 25) must exist");
    const fanB = fanBRes.rows[0];
    console.log(` -> Fan A: ID ${fanA.id} (${fanA.email}), Fan B: ID ${fanB.id} (${fanB.email})`);

    // Audio & Video content for Artist 31
    const audioRes = await pool.query(
      "SELECT id, title, type, subscription_required FROM content_items WHERE id = 9 AND artist_id = 31"
    );
    assert.ok(audioRes.rows[0], "Audio item 9 ('Qehar') must exist for artist 31");
    const audioItem = audioRes.rows[0];
    assert.strictEqual(audioItem.subscription_required, true);

    const freeAudioRes = await pool.query(
      "SELECT id, title, type, subscription_required FROM content_items WHERE id = 8 AND artist_id = 31"
    );
    assert.ok(freeAudioRes.rows[0], "Free audio item 8 ('Kesariya') must exist for artist 31");
    const freeAudioItem = freeAudioRes.rows[0];
    assert.strictEqual(freeAudioItem.subscription_required, false);

    const videoRes = await pool.query(
      "SELECT id, title, type, subscription_required FROM content_items WHERE id = 11 AND artist_id = 31"
    );
    assert.ok(videoRes.rows[0], "Video item 11 ('Dhun songs') must exist for artist 31");
    const videoItem = videoRes.rows[0];
    assert.strictEqual(videoItem.subscription_required, true);
    console.log(` -> Content: Audio 9 ('${audioItem.title}', Paid), Audio 8 ('${freeAudioItem.title}', Free), Video 11 ('${videoItem.title}', Paid)`);

    // Clear previous sessions for test users to avoid DEVICE_LIMIT_REACHED
    await pool.query("DELETE FROM user_sessions WHERE user_id IN ($1, $2, $3, $4)", [
      fanA.id,
      fanB.id,
      adminUser.id,
      financeUser.id,
    ]);

    // Generate JWT sessions for API testing
    const sessionFanA = await SessionService.createSession({ userId: fanA.id, deviceId: "qa07-fanA-dev", deviceName: "FanA-Phone" });
    const tokenFanA = jwt.sign({ id: fanA.id, email: fanA.email, role: fanA.role, sid: sessionFanA.id }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const sessionFanB = await SessionService.createSession({ userId: fanB.id, deviceId: "qa07-fanB-dev", deviceName: "FanB-Phone" });
    const tokenFanB = jwt.sign({ id: fanB.id, email: fanB.email, role: fanB.role, sid: sessionFanB.id }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const sessionAdmin = await SessionService.createSession({ userId: adminUser.id, deviceId: "qa07-admin-dev", deviceName: "Admin-Mac" });
    const tokenAdmin = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN", sid: sessionAdmin.id }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const sessionFinance = await SessionService.createSession({ userId: financeUser.id, deviceId: "qa07-finance-dev", deviceName: "Finance-PC" });
    const tokenFinance = jwt.sign({ id: financeUser.id, email: financeUser.email, role: "FINANCE", sid: sessionFinance.id }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    // ─── 2. CLEANUP BASELINE STATE FOR FAN A ON ARTIST 31 ──────────────────────
    console.log("\n[2] Setting Clean Initial State for Fan A...");
    await pool.query("DELETE FROM refund_requests WHERE user_id = $1", [fanA.id]);
    await pool.query("DELETE FROM payments WHERE user_id = $1", [fanA.id]);
    await pool.query("DELETE FROM transactions WHERE user_id = $1", [fanA.id]);
    await pool.query("DELETE FROM subscription_audit_logs WHERE user_id = $1", [fanA.id]);
    await pool.query("DELETE FROM subscriptions WHERE user_id = $1 AND artist_id = $2", [fanA.id, artistUser.id]);

    // Initial State Verification: Fan A has NO active entitlement to Artist 31
    assert.strictEqual(await hasActiveArtistEntitlement(fanA.id, artistUser.id), false);

    // Initial Content Access Check via API:
    // 1. Free Audio -> Allowed
    const freeAccessRes = await requestJson(baseUrl, `/api/v1/fan/subscriptions/access-check?contentId=${freeAudioItem.id}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(freeAccessRes.status, 200);
    assert.strictEqual(freeAccessRes.body?.allowed, true);
    assert.strictEqual(freeAccessRes.body?.reason, "FREE");

    // 2. Protected Audio -> Denied
    const audioAccessRes = await requestJson(baseUrl, `/api/v1/fan/subscriptions/access-check?contentId=${audioItem.id}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(audioAccessRes.status, 200);
    assert.strictEqual(audioAccessRes.body?.allowed, false);
    assert.strictEqual(audioAccessRes.body?.reason, "NO_ACTIVE_SUBSCRIPTION");

    // 3. Protected Video -> Denied
    const videoAccessRes = await requestJson(baseUrl, `/api/v1/fan/subscriptions/access-check?contentId=${videoItem.id}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(videoAccessRes.status, 200);
    assert.strictEqual(videoAccessRes.body?.allowed, false);
    assert.strictEqual(videoAccessRes.body?.reason, "NO_ACTIVE_SUBSCRIPTION");
    console.log("✓ Baseline Verified: Free audio accessible; Paid audio and video locked without active subscription.");

    // ─── 3. PAYMENT CREATION POSITIVE & NEGATIVE (PAY-POS-001 to 007) ──────────
    console.log("\n[3] Testing Payment Intent Creation (Positive & Attacks)...");

    // Attack: Price manipulation attempt (client sends manipulated body)
    const attackPriceRes = await requestJson(baseUrl, "/api/v1/fan/subscriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenFanA}` },
      body: { artistId: artistUser.id, amount: 100, price: 1, currency: "USD", freePlan: true },
    });
    // Server must ignore client-sent amount/currency and use server-authoritative price (₹49 = 4900 paise)
    assert.strictEqual(attackPriceRes.status, 201);
    assert.strictEqual(attackPriceRes.body?.order?.amount, 4900);
    assert.strictEqual(attackPriceRes.body?.order?.currency, "INR");
    assert.strictEqual(attackPriceRes.body?.subscription?.status, "PENDING");
    const purchaseSubId = attackPriceRes.body?.subscription?.id;
    const initialOrderId = attackPriceRes.body?.order?.id;
    console.log(`✓ PAY-POS-001 & Price Manipulation: Server enforced ₹49 (4900 paise, INR). Client values rejected. Order ID: ${initialOrderId}`);

    // Attack: Invalid artist ID
    const invalidArtistRes = await requestJson(baseUrl, "/api/v1/fan/subscriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenFanA}` },
      body: { artistId: "not-an-id" },
    });
    assert.strictEqual(invalidArtistRes.status, 400);
    assert.strictEqual(invalidArtistRes.body?.code, "INVALID_ARTIST_ID");
    console.log("✓ Negative: Invalid artist ID rejected with 400 INVALID_ARTIST_ID");

    // Attack: Artist with 0 price / unconfigured pricing (Artist 49)
    const unconfiguredArtistRes = await requestJson(baseUrl, "/api/v1/fan/subscriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenFanA}` },
      body: { artistId: 49 },
    });
    assert.strictEqual(unconfiguredArtistRes.status, 409);
    assert.strictEqual(unconfiguredArtistRes.body?.code, "SUBSCRIPTION_PRICE_NOT_CONFIGURED");
    console.log("✓ Negative: 0-price artist purchase rejected with 409 SUBSCRIPTION_PRICE_NOT_CONFIGURED");

    // Concurrency / Idempotent duplicate checkout attempt while pending
    const duplicateCreateRes = await requestJson(baseUrl, "/api/v1/fan/subscriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenFanA}` },
      body: { artistId: artistUser.id },
    });
    assert.ok([200, 201].includes(duplicateCreateRes.status));
    assert.strictEqual(duplicateCreateRes.body?.subscription?.id, purchaseSubId);
    assert.strictEqual(duplicateCreateRes.body?.order?.amount, 4900);
    console.log("✓ PAY-IDEM: Duplicate purchase request reuses pending subscription safely without double billing.");

    // Status check while pending: content remains locked
    const pendingStatusRes = await requestJson(baseUrl, `/api/v1/fan/subscriptions/${purchaseSubId}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(pendingStatusRes.status, 200);
    assert.strictEqual(pendingStatusRes.body?.subscription?.status, "PENDING");
    assert.strictEqual(await hasActiveArtistEntitlement(fanA.id, artistUser.id), false);
    console.log("✓ PAY-POS-005: PENDING state preserves locked content until authoritative payment confirmation.");

    // ─── 4. WEBHOOK SIGNATURE & RAW BODY SECURITY ─────────────────────────────
    console.log("\n[4] Testing Webhook Signature & Raw Body Security Matrix...");

    const testPaymentId = `pay_qa07_${Date.now()}`;
    const validWebhookJson = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: testPaymentId,
            order_id: initialOrderId,
            amount: 4900,
            currency: "INR",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };
    const validRawBody = Buffer.from(JSON.stringify(validWebhookJson), "utf8");
    const validSignature = signWebhook(validRawBody, webhookSecret);

    // Negative 1: Missing signature header
    const missingSigRes = await requestJson(baseUrl, "/api/v1/payments/webhook", {
      method: "POST",
      rawBody: validRawBody,
      headers: { "content-type": "application/json" },
    });
    assert.strictEqual(missingSigRes.status, 400);
    assert.strictEqual(missingSigRes.body?.code, "WEBHOOK_SIGNATURE_REQUIRED");
    console.log("✓ Security: Missing signature header rejected (400 WEBHOOK_SIGNATURE_REQUIRED)");

    // Negative 2: Random / invalid signature
    const invalidSigRes = await requestJson(baseUrl, "/api/v1/payments/webhook", {
      method: "POST",
      rawBody: validRawBody,
      headers: { "content-type": "application/json", "x-razorpay-signature": "00".repeat(32) },
    });
    assert.strictEqual(invalidSigRes.status, 400);
    console.log("✓ Security: Invalid signature rejected with 400 Invalid signature");

    // Negative 3: One byte changed after signing (tampered payload)
    const tamperedRawBody = Buffer.from(
      JSON.stringify({ ...validWebhookJson, event: "payment.failed" }),
      "utf8"
    );
    const tamperedRes = await requestJson(baseUrl, "/api/v1/payments/webhook", {
      method: "POST",
      rawBody: tamperedRawBody,
      headers: { "content-type": "application/json", "x-razorpay-signature": validSignature },
    });
    assert.strictEqual(tamperedRes.status, 400);
    console.log("✓ Security: Tampered raw payload rejected before processing");

    // Negative 4: Oversized payload (> 2MB limit)
    const oversizedBody = Buffer.alloc(2.5 * 1024 * 1024, "a");
    const oversizedRes = await requestJson(baseUrl, "/api/v1/payments/webhook", {
      method: "POST",
      rawBody: oversizedBody,
      headers: { "content-type": "application/json", "x-razorpay-signature": validSignature },
    });
    assert.strictEqual(oversizedRes.status, 413);
    console.log("✓ Security: Oversized payload rejected with 413 Payload Too Large");

    // ─── 5. AUTHORITATIVE PAYMENT SUCCESS & AUDIO+VIDEO VERIFICATION ──────────
    console.log("\n[5] Executing Authoritative Payment Success Webhook...");

    const successEventId = `evt_${Date.now()}_success`;
    const successWebhookRes = await requestJson(baseUrl, "/api/v1/payments/webhook", {
      method: "POST",
      rawBody: validRawBody,
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": validSignature,
        "x-razorpay-event-id": successEventId,
      },
    });
    assert.strictEqual(successWebhookRes.status, 200);
    assert.strictEqual(successWebhookRes.body?.success, true);
    console.log("✓ PAY-POS-003: Payment captured webhook processed successfully.");

    // Verify DB state: payment SUCCESS, subscription ACTIVE
    const verifiedPayment = await pool.query(
      "SELECT id, user_id, amount, status, razorpay_payment_id FROM payments WHERE razorpay_payment_id = $1",
      [testPaymentId]
    );
    assert.strictEqual(verifiedPayment.rows.length, 1);
    assert.strictEqual(verifiedPayment.rows[0].status, "SUCCESS");
    assert.strictEqual(Number(verifiedPayment.rows[0].amount), 4900);
    const savedPaymentId = verifiedPayment.rows[0].id;

    const verifiedSub = await pool.query(
      "SELECT id, status, next_billing_date FROM subscriptions WHERE id = $1",
      [purchaseSubId]
    );
    assert.strictEqual(verifiedSub.rows[0].status, "ACTIVE");
    assert.ok(new Date(verifiedSub.rows[0].next_billing_date).getTime() > Date.now());

    // Verify Entitlement Service directly
    assert.strictEqual(await hasActiveArtistEntitlement(fanA.id, artistUser.id), true);

    // AUDIO ACCESS VERIFICATION:
    const postPayAudioAccess = await requestJson(baseUrl, `/api/v1/fan/subscriptions/access-check?contentId=${audioItem.id}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(postPayAudioAccess.status, 200);
    assert.strictEqual(postPayAudioAccess.body?.allowed, true);
    assert.strictEqual(postPayAudioAccess.body?.reason, "ACTIVE");
    console.log("✓ MANDATORY VERIFICATION: AUDIO CONTENT (Item 9 'Qehar') is UNLOCKED!");

    // VIDEO ACCESS VERIFICATION:
    const postPayVideoAccess = await requestJson(baseUrl, `/api/v1/fan/subscriptions/access-check?contentId=${videoItem.id}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(postPayVideoAccess.status, 200);
    assert.strictEqual(postPayVideoAccess.body?.allowed, true);
    assert.strictEqual(postPayVideoAccess.body?.reason, "ACTIVE");
    console.log("✓ MANDATORY VERIFICATION: VIDEO CONTENT (Item 11 'Dhun songs') is UNLOCKED!");

    // Idempotency: Duplicate webhook delivery with exact same event ID
    const dupWebhookRes = await requestJson(baseUrl, "/api/v1/payments/webhook", {
      method: "POST",
      rawBody: validRawBody,
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": validSignature,
        "x-razorpay-event-id": successEventId,
      },
    });
    assert.strictEqual(dupWebhookRes.status, 200);
    assert.strictEqual(dupWebhookRes.body?.duplicated, true);
    console.log("✓ PAY-IDEM-001: Duplicate webhook processed idempotently with { duplicated: true }");

    // Stale Failure Webhook After Success (ordering attack)
    const staleFailJson = {
      event: "payment.failed",
      payload: { payment: { entity: { id: testPaymentId, order_id: initialOrderId, error_description: "late fail" } } },
    };
    const staleFailRaw = Buffer.from(JSON.stringify(staleFailJson), "utf8");
    const staleFailSig = signWebhook(staleFailRaw, webhookSecret);
    const staleFailRes = await requestJson(baseUrl, "/api/v1/payments/webhook", {
      method: "POST",
      rawBody: staleFailRaw,
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": staleFailSig,
        "x-razorpay-event-id": `evt_${Date.now()}_stale_fail`,
      },
    });
    assert.strictEqual(staleFailRes.status, 200);
    // Subscription MUST remain ACTIVE; payment MUST remain SUCCESS
    const subAfterStale = await pool.query("SELECT status FROM subscriptions WHERE id = $1", [purchaseSubId]);
    assert.strictEqual(subAfterStale.rows[0].status, "ACTIVE");
    console.log("✓ PAY-IDEM-004: Stale failure webhook rejected from regressing authoritative ACTIVE subscription.");

    // ─── 6. REFUND AUTHORIZATION & IDOR RBAC MATRIX ───────────────────────────
    console.log("\n[6] Testing Refund Authorization & RBAC Matrix...");

    // Fan attempts admin refund endpoint -> 403 Forbidden
    const fanRefundRes = await requestJson(baseUrl, `/api/v1/admin/refunds/payments/${savedPaymentId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${tokenFanA}` },
      body: {},
    });
    assert.strictEqual(fanRefundRes.status, 403);
    console.log("✓ RBAC Security: Fan refund attempt rejected with 403 Forbidden");

    // Unauthenticated attempt -> 401 Unauthorized
    const unauthRefundRes = await requestJson(baseUrl, `/api/v1/admin/refunds/payments/${savedPaymentId}`, {
      method: "POST",
      body: {},
    });
    assert.strictEqual(unauthRefundRes.status, 401);
    console.log("✓ RBAC Security: Unauthenticated refund attempt rejected with 401 Unauthorized");

    // IDOR / Invalid Payment ID attempt -> 404
    const fakePaymentId = "00000000-0000-4000-8000-000000000099";
    const idorRefundRes = await requestJson(baseUrl, `/api/v1/admin/refunds/payments/${fakePaymentId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${tokenAdmin}` },
      body: {},
    });
    assert.strictEqual(idorRefundRes.status, 404);
    assert.strictEqual(idorRefundRes.body?.code, "PAYMENT_NOT_FOUND");
    console.log("✓ IDOR Security: Unknown/unrelated payment id rejected with 404 PAYMENT_NOT_FOUND");

    // Finance user lists refundable payments -> Allowed (200)
    const financeListRes = await requestJson(baseUrl, "/api/v1/admin/refunds/payments", {
      headers: { authorization: `Bearer ${tokenFinance}` },
    });
    assert.strictEqual(financeListRes.status, 200);
    assert.ok(Array.isArray(financeListRes.body?.items));
    const targetItem = financeListRes.body.items.find((item: any) => item.paymentId === savedPaymentId);
    assert.ok(targetItem, "Payment must be visible in Finance ledger");
    assert.strictEqual(targetItem.amount, 4900);
    console.log("✓ RBAC: Finance manager successfully lists refundable payments ledger.");

    // Finance manager can initiate valid full refund
    // We test initiation using the MockTestRefundGateway through the domain service
    const mockGateway = new MockTestRefundGateway();
    const refundResult = await initiateFullRefund(
      savedPaymentId,
      { userId: financeUser.id, role: "FINANCE" },
      mockGateway
    );
    assert.strictEqual(refundResult.request.status, "COMPLETED");
    assert.strictEqual(refundResult.request.amountPaise, 4900);
    assert.strictEqual(mockGateway.createCalls, 1);
    console.log("✓ Refund Execution: Full refund initiated by FINANCE, completed successfully.");

    // ─── 7. AUDIO + VIDEO REVOCATION POST-REFUND VERIFICATION ─────────────────
    console.log("\n[7] Verifying Immediate Audio & Video Revocation After Refund...");

    // Entitlement must now be false
    assert.strictEqual(await hasActiveArtistEntitlement(fanA.id, artistUser.id), false);

    // Verify subscription status is CANCELLED / inactive
    const subAfterRefund = await pool.query("SELECT status FROM subscriptions WHERE id = $1", [purchaseSubId]);
    assert.strictEqual(subAfterRefund.rows[0].status, "CANCELLED");

    // Verify payment status is REFUNDED
    const paymentAfterRefund = await pool.query("SELECT status FROM payments WHERE id = $1", [savedPaymentId]);
    assert.strictEqual(paymentAfterRefund.rows[0].status, "REFUNDED");

    // AUDIO ACCESS AFTER REFUND: Must be Denied/Relocked
    const postRefundAudioAccess = await requestJson(baseUrl, `/api/v1/fan/subscriptions/access-check?contentId=${audioItem.id}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(postRefundAudioAccess.status, 200);
    assert.strictEqual(postRefundAudioAccess.body?.allowed, false);
    assert.strictEqual(postRefundAudioAccess.body?.reason, "NO_ACTIVE_SUBSCRIPTION");
    console.log("✓ MANDATORY VERIFICATION: AUDIO CONTENT (Item 9) is immediately RELOCKED post-refund!");

    // VIDEO ACCESS AFTER REFUND: Must be Denied/Relocked
    const postRefundVideoAccess = await requestJson(baseUrl, `/api/v1/fan/subscriptions/access-check?contentId=${videoItem.id}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(postRefundVideoAccess.status, 200);
    assert.strictEqual(postRefundVideoAccess.body?.allowed, false);
    assert.strictEqual(postRefundVideoAccess.body?.reason, "NO_ACTIVE_SUBSCRIPTION");
    console.log("✓ MANDATORY VERIFICATION: VIDEO CONTENT (Item 11) is immediately RELOCKED post-refund!");

    // Free audio track MUST remain accessible!
    const postRefundFreeAudio = await requestJson(baseUrl, `/api/v1/fan/subscriptions/access-check?contentId=${freeAudioItem.id}`, {
      headers: { authorization: `Bearer ${tokenFanA}` },
    });
    assert.strictEqual(postRefundFreeAudio.status, 200);
    assert.strictEqual(postRefundFreeAudio.body?.allowed, true);
    assert.strictEqual(postRefundFreeAudio.body?.reason, "FREE");
    console.log("✓ Free track remains accessible after refund.");

    // Duplicate refund attempt -> Idempotent response, NO second gateway call
    const dupRefundResult = await initiateFullRefund(
      savedPaymentId,
      { userId: financeUser.id, role: "FINANCE" },
      mockGateway
    );
    assert.strictEqual(dupRefundResult.idempotent, true);
    assert.strictEqual(dupRefundResult.request.status, "COMPLETED");
    assert.strictEqual(mockGateway.createCalls, 1);
    console.log("✓ Duplicate Refund: Second refund call returned idempotent cached status with ZERO extra gateway calls.");

    // ─── 8. RECONCILIATION & AMBIGUOUS RECOVERY MATRIX ────────────────────────
    console.log("\n[8] Testing Ambiguous Refund Recovery & Reconciliation Engine...");

    // Create a new purchase to test ambiguous recovery
    const ambGatewayOrderId = `order_amb_${Date.now()}`;
    const ambGatewayPaymentId = `pay_amb_${Date.now()}`;
    const ambPaymentId = crypto.randomUUID();

    const ambSub = await pool.query(
      `INSERT INTO subscriptions (user_id, artist_id, status, plan_type, start_date, next_billing_date, auto_renew, type)
       VALUES ($1, $2, 'ACTIVE', 'MONTHLY', now(), now() + interval '30 days', false, 'ARTIST')
       ON CONFLICT (user_id, artist_id) DO UPDATE SET status = 'ACTIVE', next_billing_date = now() + interval '30 days'
       RETURNING id`,
      [fanB.id, artistUser.id]
    );
    const ambSubId = ambSub.rows[0].id;

    await pool.query(
      `INSERT INTO transactions (user_id, artist_id, amount, currency, status, razorpay_order_id, razorpay_payment_id, artist_name, billing_cycle)
       VALUES ($1, $2, 4900, 'INR', 'SUCCESS', $3, $4, 'Arjit Singh', 'monthly')`,
      [fanB.id, artistUser.id, ambGatewayOrderId, ambGatewayPaymentId]
    );

    await pool.query(
      `INSERT INTO payments (id, user_id, subscription_id, amount, status, razorpay_payment_id)
       VALUES ($1, $2, $3, 4900, 'SUCCESS', $4)`,
      [ambPaymentId, fanB.id, ambSubId, ambGatewayPaymentId]
    );

    // Initiate refund with ambiguous gateway timeout
    const ambGateway = new MockTestRefundGateway();
    ambGateway.mode = "ambiguous";
    const ambRefund = await initiateFullRefund(
      ambPaymentId,
      { userId: adminUser.id, role: "ADMIN" },
      ambGateway
    );
    assert.strictEqual(ambRefund.request.status, "RECONCILIATION_REQUIRED");
    console.log("✓ Ambiguous Timeout: Gateway timeout entered durable RECONCILIATION_REQUIRED state without crashing.");

    // Reconcile via admin reconciliation
    ambGateway.mode = "processed";
    const reconciledResult = await reconcileRefundRequest(ambRefund.request.id, ambGateway);
    assert.strictEqual(reconciledResult.status, "COMPLETED");
    console.log("✓ Reconciliation Repair: Pending ambiguous request reconciled and completed safely.");

    // Cleanup session tokens
    await SessionService.revokeSession(fanA.id, sessionFanA.id);
    await SessionService.revokeSession(fanB.id, sessionFanB.id);
    await SessionService.revokeSession(adminUser.id, sessionAdmin.id);
    await SessionService.revokeSession(financeUser.id, sessionFinance.id);

    console.log("\n================================================================================");
    console.log("MODULE 07 END-TO-END QA SUITE: ALL TESTS COMPLETED & VERIFIED 100% PASSED!");
    console.log("================================================================================\n");
  } finally {
    server.close();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("FATAL QA FAILURE:", error);
  process.exit(1);
});
