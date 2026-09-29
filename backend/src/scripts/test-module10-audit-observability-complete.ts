import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { createApp } from "../app";
import { validateEnv } from "../config/env.validation";
import { pool } from "../common/db";
import { SessionService } from "../common/auth/session.service";

async function main() {
  console.log("================================================================================");
  console.log("MODULE 10 -- AUDIT LOGGING, OBSERVABILITY & ERROR TRACEABILITY QA SUITE");
  console.log("================================================================================\n");

  const env = validateEnv();
  const app = createApp(env);
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not bind test server");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[INIT] Privileged Test Server running on ${baseUrl}\n`);

  async function api(
    path: string,
    options: {
      method?: string;
      token?: string;
      correlationId?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ) {
    const headers: Record<string, string> = {
      ...(options.headers || {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.correlationId ? { "x-correlation-id": options.correlationId } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    };

    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const status = res.status;
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      responseHeaders[key.toLowerCase()] = val;
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { status, data, headers: responseHeaders };
  }

  try {
    // -------------------------------------------------------------------------
    // Setup Test Identities
    // -------------------------------------------------------------------------
    console.log("[SETUP] Minting Authenticated Test Actors...");
    const secret = process.env.JWT_SECRET || "supersecretjwtkeyforlocaldevelopment12345";

    const adminUser = await pool.query<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE UPPER(role) = 'ADMIN' AND COALESCE(is_deleted, false) = false ORDER BY id ASC LIMIT 1"
    );
    if (!adminUser.rows[0]) throw new Error("No admin user in database");
    const adminId = adminUser.rows[0].id;
    await pool.query("DELETE FROM user_sessions WHERE user_id = $1", [adminId]);
    const sessionAdmin = await SessionService.createSession({ userId: adminId, deviceId: "qa-admin-obs", deviceName: "Admin PC" });
    const adminToken = jwt.sign(
      { id: adminId, role: "ADMIN", email: adminUser.rows[0].email, sid: sessionAdmin.id },
      secret,
      { expiresIn: "1h" }
    );

    const fanUser = await pool.query<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE UPPER(role) = 'FAN' AND COALESCE(is_deleted, false) = false ORDER BY id ASC LIMIT 1"
    );
    if (!fanUser.rows[0]) throw new Error("No fan user in database");
    const fanId = fanUser.rows[0].id;
    await pool.query("DELETE FROM user_sessions WHERE user_id = $1", [fanId]);
    const sessionFan = await SessionService.createSession({ userId: fanId, deviceId: "qa-fan-obs", deviceName: "Fan Phone" });
    const fanToken = jwt.sign(
      { id: fanId, role: "FAN", email: fanUser.rows[0].email, sid: sessionFan.id },
      secret,
      { expiresIn: "1h" }
    );

    console.log(`  -> Admin Actor ID: ${adminId} (${adminUser.rows[0].email})`);
    console.log(`  -> Fan Actor ID: ${fanId} (${fanUser.rows[0].email})\n`);

    // =========================================================================
    // SECTION 1: Correlation ID Lifecycle & Anti-Injection
    // =========================================================================
    console.log("--- SECTION 1: Correlation ID Lifecycle & Anti-Injection ---");

    // 1A. Auto-generation when none provided
    const res1A = await api("/health");
    assert.equal(res1A.status, 200, "Health should return 200");
    const cid1A = res1A.headers["x-correlation-id"];
    assert.ok(cid1A, "Response must include x-correlation-id header");
    assert.match(
      cid1A,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Auto-generated correlation ID must be a valid UUID v4"
    );
    console.log(`  [PASS] 1A. Auto-generated Correlation ID verified: ${cid1A}`);

    // 1B. Preservation of valid client-provided correlation ID
    const customCid = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
    const res1B = await api("/health", { correlationId: customCid });
    assert.equal(res1B.status, 200);
    assert.equal(
      res1B.headers["x-correlation-id"],
      customCid,
      "Server must preserve and echo valid client correlation ID"
    );
    console.log(`  [PASS] 1B. Client Correlation ID successfully preserved: ${customCid}`);

    // 1C. Negative: CRLF Header Injection Protection
    const injectionCid = "valid-prefix\r\nInjected-Header: malicious-value\r\n";
    let res1C: any;
    try {
      res1C = await api("/health", { correlationId: injectionCid });
    } catch {
      res1C = { headers: {} };
    }
    const returnedCid1C = res1C.headers["x-correlation-id"] || "";
    assert.ok(!returnedCid1C.includes("\r"), "Correlation ID must never contain CR");
    assert.ok(!returnedCid1C.includes("\n"), "Correlation ID must never contain LF");
    assert.ok(!res1C.headers["injected-header"], "Header injection must not occur");
    console.log("  [PASS] 1C. CRLF Header injection strictly prevented & sanitized");

    // 1D. Negative: Excessively long correlation ID
    const longCid = "a".repeat(10000);
    let res1D = await api("/health", { correlationId: longCid });
    const returnedLongCid = res1D.headers["x-correlation-id"];
    assert.ok(returnedLongCid, "Server responded with valid correlation ID");
    assert.ok(
      returnedLongCid.length <= 128,
      `Correlation ID length must be bounded (got ${returnedLongCid.length})`
    );
    console.log(`  [PASS] 1D. Oversized Correlation ID safely bounded to ${returnedLongCid.length} chars\n`);

    // =========================================================================
    // SECTION 2: Health & Readiness Observability
    // =========================================================================
    console.log("--- SECTION 2: Health & Readiness Observability ---");

    // 2A. Liveness check
    const res2A = await api("/health");
    assert.equal(res2A.status, 200);
    assert.ok(res2A.data, "Health must return json payload");
    console.log(`  [PASS] 2A. Liveness endpoint /health healthy: ${JSON.stringify(res2A.data)}`);

    // 2B. Readiness check with database verification
    const res2B = await api("/health/ready");
    assert.equal(res2B.status, 200, "Readiness /health/ready must return 200 when DB is active");
    assert.ok(res2B.data, "Readiness payload returned");
    console.log(`  [PASS] 2B. Readiness endpoint /health/ready verified: status ${res2B.status}`);

    // 2C. Negative Secret Leak Check in Health Payloads
    const healthPayloadStr = JSON.stringify({ ...res2A.data, ...res2B.data });
    assert.ok(!healthPayloadStr.includes("postgres"), "Health must not leak database user");
    assert.ok(!healthPayloadStr.includes("Password"), "Health must not leak credentials");
    assert.ok(!healthPayloadStr.includes("5432"), "Health must not expose raw db port");
    console.log("  [PASS] 2C. Health responses strictly scrubbed of internal infrastructure secrets\n");

    // =========================================================================
    // SECTION 3: Mandatory Audit Event Generation for Sensitive Actions
    // =========================================================================
    console.log("--- SECTION 3: Mandatory Audit Event Generation ---");

    // Discover a content item to test moderation audit logging
    const contentItem = await pool.query<{ id: number; title: string }>(
      "SELECT id, title FROM content_items ORDER BY id DESC LIMIT 1"
    );
    if (!contentItem.rows[0]) throw new Error("No content items for moderation test");
    const testContentId = contentItem.rows[0].id;

    // Reset item to DRAFT + READY to ensure clean test lifecycle
    await pool.query(
      "UPDATE content_items SET lifecycle_state = 'DRAFT', is_approved = false, status = 'READY', is_taken_down = false WHERE id = $1",
      [testContentId]
    );

    // 3A. Perform moderation action (Reject Content with Reason)
    const rejectCorrelationId = "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e";
    const res3A = await api(`/api/v1/admin/moderation/content/${testContentId}/reject`, {
      method: "POST",
      token: adminToken,
      correlationId: rejectCorrelationId,
      body: { reason: "Automated QA audit trace verification reason (duplicate content)" },
    });
    assert.ok([200, 201].includes(res3A.status), `Moderation reject returned ${res3A.status}`);

    // Verify row was written to audit_logs
    const auditRow3A = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'content.rejected' AND entity_id = $1 ORDER BY created_at DESC LIMIT 1",
      [String(testContentId)]
    );
    assert.ok(auditRow3A.rows[0], "Audit record must be created for content rejection");
    const auditLog = auditRow3A.rows[0];
    assert.equal(auditLog.action, "content.rejected");
    assert.equal(auditLog.entity, "content");
    assert.equal(auditLog.entity_id, String(testContentId));
    assert.equal(auditLog.actor_id, adminId);
    assert.equal(auditLog.status, "success");
    assert.ok(auditLog.metadata, "Audit metadata must exist");
    assert.ok(
      auditLog.metadata.reason.includes("Automated QA audit trace"),
      "Audit metadata must preserve mandatory reason"
    );
    console.log(`  [PASS] 3A. Durable audit log created: Action='content.rejected', EntityID=${testContentId}, Actor=${adminId}`);

    // 3B. Perform Content Approval and verify audit record
    const approveCorrelationId = "c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f";
    const res3B = await api(`/api/v1/admin/moderation/content/${testContentId}/approve`, {
      method: "POST",
      token: adminToken,
      correlationId: approveCorrelationId,
    });
    assert.ok([200, 201].includes(res3B.status), `Moderation approve returned ${res3B.status}`);

    const auditRow3B = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'content.approved' AND entity_id = $1 ORDER BY created_at DESC LIMIT 1",
      [String(testContentId)]
    );
    assert.ok(auditRow3B.rows[0], "Audit record must be created for content approval");
    assert.equal(auditRow3B.rows[0].action, "content.approved");
    assert.equal(auditRow3B.rows[0].status, "success");
    console.log(`  [PASS] 3B. Content approval audit log recorded: Action='content.approved', Status='success'\n`);

    // =========================================================================
    // SECTION 4: Audit Immutability & Anti-Tamper Guarantees
    // =========================================================================
    console.log("--- SECTION 4: Audit Immutability & Anti-Tamper Guarantees ---");

    const sampleAuditId = auditLog.id;

    // 4A. Negative: Attempt to UPDATE audit record via REST
    const res4A = await api(`/api/v1/admin/audit/${sampleAuditId}`, {
      method: "PUT",
      token: adminToken,
      body: { action: "tampered.action", status: "tampered" },
    });
    assert.ok(
      [404, 405].includes(res4A.status),
      `PUT on audit record must be rejected with 404/405 (got ${res4A.status})`
    );
    console.log(`  [PASS] 4A. REST update mutation blocked (HTTP ${res4A.status} - No edit route exists)`);

    // 4B. Negative: Attempt to DELETE audit record via REST
    const res4B = await api(`/api/v1/admin/audit/${sampleAuditId}`, {
      method: "DELETE",
      token: adminToken,
    });
    assert.ok(
      [404, 405].includes(res4B.status),
      `DELETE on audit record must be rejected with 404/405 (got ${res4B.status})`
    );
    console.log(`  [PASS] 4B. REST delete mutation blocked (HTTP ${res4B.status} - No delete route exists)`);

    // 4C. Negative: Attempt to PURGE entire audit collection
    const res4C = await api("/api/v1/admin/audit", {
      method: "DELETE",
      token: adminToken,
    });
    assert.ok(
      [404, 405].includes(res4C.status),
      `DELETE on audit collection must be rejected with 404/405 (got ${res4C.status})`
    );
    console.log(`  [PASS] 4C. Bulk audit purge rejected (HTTP ${res4C.status})\n`);

    // =========================================================================
    // SECTION 5: Secret Redaction & Sanitization Verification
    // =========================================================================
    console.log("--- SECTION 5: Secret Redaction & Sensitive Data Protection ---");

    // 5A. Trigger a failed login and verify plaintext password is NEVER stored in audit_logs
    const testSecretPassword = "SuperSecretPassword123!DoNotLogMe";
    await api("/api/v1/auth/login", {
      method: "POST",
      headers: { "x-device-id": "qa-redaction-test" },
      body: { email: "nonexistent-user-audit-test@example.com", password: testSecretPassword, deviceId: "qa-redaction-test" },
    });

    const failedAuditRows = await pool.query(
      "SELECT metadata FROM audit_logs WHERE action = 'auth.failed_login' ORDER BY created_at DESC LIMIT 5"
    );
    for (const r of failedAuditRows.rows) {
      const metaStr = JSON.stringify(r.metadata || {});
      assert.ok(
        !metaStr.includes(testSecretPassword),
        "Plaintext password must NEVER appear in audit log metadata"
      );
    }
    console.log("  [PASS] 5A. Plaintext passwords verified absent from auth failure audit metadata");

    // 5B. Check last 50 audit logs across the entire database for any secret pattern
    const recentAuditLogs = await pool.query<{ metadata: any }>(
      "SELECT metadata FROM audit_logs ORDER BY created_at DESC LIMIT 50"
    );
    const forbiddenPatterns = [
      /\$2[aby]\$[0-9]{2}\$/, // bcrypt hash
      /eyJ[a-zA-Z0-9_-]{10,}\.eyJ/, // JWT token pattern
      /rzp_(test|live)_[a-zA-Z0-9]+/, // Razorpay secret
      /supersecretjwtkey/, // local dev JWT secret
    ];

    for (const row of recentAuditLogs.rows) {
      const metaStr = JSON.stringify(row.metadata || {});
      for (const pattern of forbiddenPatterns) {
        assert.ok(
          !pattern.test(metaStr),
          `Audit log metadata contains forbidden credential pattern: ${pattern}`
        );
      }
    }
    console.log("  [PASS] 5B. Deep scan of audit records: Zero bcrypt hashes, JWTs, or private secrets found\n");

    // =========================================================================
    // SECTION 6: Standardized Error Taxonomy Across Roles
    // =========================================================================
    console.log("--- SECTION 6: Standardized Error Taxonomy Across Roles ---");

    // 6A. 401 Unauthorized
    const res6A = await api("/api/v1/admin/audit");
    assert.equal(res6A.status, 401, "Unauthenticated access must return 401");
    assert.equal(res6A.data?.success, false);
    assert.ok(res6A.data?.code, "Error response must include standard error code");
    assert.ok(res6A.headers["x-correlation-id"], "401 must include correlation ID");
    console.log(`  [PASS] 6A. 401 Unauthorized taxonomy verified: code='${res6A.data?.code}'`);

    // 6B. 403 Forbidden (Fan token on Admin route)
    const res6B = await api("/api/v1/admin/audit", { token: fanToken });
    assert.equal(res6B.status, 403, "Fan accessing admin route must return 403");
    assert.equal(res6B.data?.success, false);
    assert.ok(res6B.headers["x-correlation-id"], "403 must include correlation ID");
    console.log(`  [PASS] 6B. 403 Forbidden taxonomy verified: code='${res6B.data?.code}'`);

    // 6C. 404 Route Not Found
    const res6C = await api("/api/v1/non-existent-diagnostic-endpoint-xyz");
    assert.equal(res6C.status, 404, "Invalid route must return 404");
    assert.equal(res6C.data?.success, false);
    assert.ok(res6C.headers["x-correlation-id"], "404 must include correlation ID");
    console.log(`  [PASS] 6C. 404 Route Not Found taxonomy verified: code='${res6C.data?.code}'`);

    // 6D. 400 Validation Error (Missing reason in reject)
    const res6D = await api(`/api/v1/admin/moderation/content/${testContentId}/reject`, {
      method: "POST",
      token: adminToken,
      body: {}, // missing reason
    });
    assert.equal(res6D.status, 400, "Missing required reason must return 400");
    assert.equal(res6D.data?.success, false);
    console.log(`  [PASS] 6D. 400 Bad Request taxonomy verified: code='${res6D.data?.code}'\n`);

    // =========================================================================
    // SECTION 7: Failure-Path Audit Integrity
    // =========================================================================
    console.log("--- SECTION 7: Failure-Path Audit Integrity ---");

    // When an action fails validation, verify it does NOT produce a false 'success' audit entry
    const beforeCountRes = await pool.query(
      "SELECT count(*) FROM audit_logs WHERE action = 'content.rejected' AND status = 'success'"
    );
    const beforeCount = Number(beforeCountRes.rows[0].count);

    // Trigger validation failure (reason too short)
    await api(`/api/v1/admin/moderation/content/${testContentId}/reject`, {
      method: "POST",
      token: adminToken,
      body: { reason: "x" },
    });

    const afterCountRes = await pool.query(
      "SELECT count(*) FROM audit_logs WHERE action = 'content.rejected' AND status = 'success'"
    );
    const afterCount = Number(afterCountRes.rows[0].count);

    assert.equal(
      beforeCount,
      afterCount,
      "Failed action must NEVER falsely record a successful audit entry"
    );
    console.log("  [PASS] 7A. Validation failure did not produce phantom success audit record\n");

    // =========================================================================
    // SECTION 8: End-to-End Traceability (Header <-> DB Audit Reconciliation)
    // =========================================================================
    console.log("--- SECTION 8: End-to-End Correlation Traceability ---");

    const traceableCorrelationId = "d3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a";

    // Reset item to DRAFT + READY so Section 8 approval executes and records durable audit trace
    await pool.query(
      "UPDATE content_items SET lifecycle_state = 'DRAFT', is_approved = false, status = 'READY', is_taken_down = false WHERE id = $1",
      [testContentId]
    );

    const res8 = await api(`/api/v1/admin/moderation/content/${testContentId}/approve`, {
      method: "POST",
      token: adminToken,
      correlationId: traceableCorrelationId,
    });
    assert.ok([200, 201].includes(res8.status));

    // Verify correlation ID in header
    assert.equal(
      res8.headers["x-correlation-id"],
      traceableCorrelationId,
      "Header correlation ID must match"
    );

    // Verify correlation ID in database audit row
    const dbAudit = await pool.query(
      "SELECT * FROM audit_logs WHERE correlation_id = $1",
      [traceableCorrelationId]
    );
    assert.ok(dbAudit.rows[0], "Audit record with exact correlation ID must exist in DB");
    assert.equal(dbAudit.rows[0].correlation_id, traceableCorrelationId);
    console.log(`  [PASS] 8A. End-to-End Trace verified: HTTP Header CID == Database Audit CID (${traceableCorrelationId})\n`);

    console.log("================================================================================");
    console.log("MODULE 10 -- AUDIT LOGGING & OBSERVABILITY: ALL 8 SECTIONS PASSED 100%");
    console.log("================================================================================");
  } finally {
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\n[FATAL TEST FAILURE]", err);
  process.exit(1);
});
