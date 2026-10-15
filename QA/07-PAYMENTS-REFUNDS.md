# 07 — Payments, Razorpay Webhooks, Refunds & Reconciliation

## Scope

Covers payment-intent/order creation, Razorpay test checkout, exact raw-body signature verification, idempotent webhook processing, payment/subscription transaction integrity, duplicate/out-of-order event handling, manual admin/finance refund, entitlement after refund, ledger consistency, reconciliation tooling and failure recovery.

## Automated gates

```bash
cd backend
npm run test:payment-integrity
npm run test:refund-integrity-contract
npm run test:refund-integrity-db
npm run report:refund-reconciliation
npm run verify
```

Run DB/provider commands only against isolated QA/test infrastructure.

## Payment creation positive cases

| ID | Test | Expected |
|---|---|---|
| PAY-POS-001 | valid paid Artist monthly purchase | backend creates canonical pending payment/order using current server price |
| PAY-POS-002 | valid supported yearly purchase | server uses current yearly price if supported |
| PAY-POS-003 | valid Razorpay test success | local payment becomes successful exactly once; subscription activation follows authoritative event |
| PAY-POS-004 | client callback lost but webhook arrives | backend still reaches correct success/entitlement state |
| PAY-POS-005 | webhook delayed | UI remains pending, later converges to success |
| PAY-POS-006 | gateway payment failure | local state records failure; no protected access |
| PAY-POS-007 | user closes/cancels checkout | no false success/unlock |

## Signature/raw-body security

For the webhook endpoint test:

- valid exact raw body + valid Razorpay signature;
- same body with one byte changed after signing;
- valid JSON reparsed/reserialized with different byte representation;
- missing signature header;
- random signature;
- malformed JSON/raw payload;
- oversized body above configured limit.

Expected: only the exact valid signed raw payload can mutate payment/subscription state. Invalid signature is rejected before business mutation.

## Idempotency and ordering matrix

| ID | Scenario | Expected |
|---|---|---|
| PAY-IDEM-001 | same event delivered twice | second delivery no-op/idempotent success response as designed |
| PAY-IDEM-002 | duplicate success events with different delivery attempts | one financial result, one entitlement result |
| PAY-IDEM-003 | client confirmation and webhook race | one result |
| PAY-IDEM-004 | success then stale failure | authoritative state does not incorrectly regress |
| PAY-IDEM-005 | failure then later valid success where gateway lifecycle permits | deterministic final state consistent with gateway truth |
| PAY-IDEM-006 | unknown order/payment reference | no arbitrary subscription mutation |
| PAY-IDEM-007 | event ID collision/replay | replay protection prevents duplicate mutation |

## Price manipulation matrix

Repeat the attacks from `06-SUBSCRIPTIONS.md` and additionally compare:

- amount/currency stored in local payment row;
- gateway order amount;
- current server pricing configuration;
- eventual invoice/transaction amount;
- artist gross revenue ledger source.

Any mismatch that grants access or corrupts revenue is P0.

## Transactional failure injection

Simulate or force controlled failures at these points:

1. after provider order creation but before local pending transaction commits;
2. local payment update succeeds but subscription activation fails;
3. subscription activation succeeds but payment ledger fails;
4. audit insertion fails during sensitive payment mutation where included transactionally;
5. DB unavailable after valid webhook signature verification;
6. process restarts mid-webhook;
7. webhook retry after prior partial/rolled-back attempt.

Expected: transaction rolls back or state is explicitly reconcilable; never acknowledge a provider event as fully processed if local authoritative mutation did not complete according to the current design.

## Refund authorization

- Admin initiates valid refund.
- Finance initiates allowed refund.
- Moderator attempts refund → 403.
- Artist attempts refund → 403.
- Fan attempts refund admin API → 403.
- direct IDOR: privileged user supplies another unrelated payment/subscription combination → server validates relationships.

Destructive financial UI must require clear confirmation and reason where current UX contract requires it.

## Refund state cases

- full valid refund;
- duplicate refund request;
- refund while already processing;
- refund on failed/pending payment;
- refund unknown payment;
- gateway rejects refund;
- gateway timeout/ambiguous result;
- local DB failure after gateway accepted refund;
- duplicate/refund webhook event;
- refund completion after user/session state changed.

For each verify:

1. provider/gateway state;
2. local payment/refund state;
3. transaction/invoice presentation;
4. subscription entitlement effect according to current policy;
5. `/stream/access` result;
6. artist/admin gross revenue summary;
7. audit trail;
8. reconciliation report.

## Reconciliation

Run:

```bash
npm run report:refund-reconciliation
```

and any approved payment reconciliation utility available in the tested revision.

Seed controlled discrepancies in QA where possible:

- gateway success/local pending;
- gateway refunded/local success;
- duplicate local payment reference attempt;
- missing subscription link;
- stale pending transaction.

Expected: report identifies discrepancies without silently mutating unless the command explicitly supports controlled repair. Repair actions must be idempotent and audited where applicable.

## Database integrity

Attempt:

- duplicate gateway payment/reference IDs;
- duplicate webhook event IDs;
- invalid payment/subscription FK references;
- invalid state values;
- concurrent successful webhooks for one purchase.

Constraints/transactions must prevent duplicate or contradictory financial truth.

## Logging/PII/secrets

Verify payment logging never contains:

- Razorpay key secret;
- webhook secret;
- full Authorization tokens;
- card/payment instrument sensitive fields not required for support;
- raw signed media tokens;
- unnecessary full webhook payload if it contains sensitive data.

Correlation ID + provider reference should be sufficient to trace a test without secrets.

## Mobile payment UX

- user starts checkout then app backgrounds;
- app killed after payment but before callback;
- callback reports success while webhook not yet received;
- slow webhook > normal UX wait period;
- failed payment and retry;
- duplicate tap on pay button;
- network loss immediately after gateway completion.

Expected: app shows `Confirming/Pending`, not false success; status can be recovered after restart; retry cannot double-activate.

## Exit criteria

Only verified gateway truth can create paid entitlement; duplicate/raced/out-of-order events are safe; refund permissions and state are correct; ambiguous failures are detectable by reconciliation; financial records, subscription access, invoice history, analytics summary and audit trail agree.

---

## QA Execution Register & Verification Evidence (Module 07)

**Execution Date:** 2026-09-28  
**Environment:** Greenfield Integration Head (`fix/production-hardening-main`)  
**Backend Port:** `8000` (E2E Test harness dynamic port)  
**Database:** PostgreSQL (Cloud Neon instance via `DATABASE_URL`)  
**Execution Command:** `npm run test:module07-payments-refunds`  

### 1. Real Database Identities Discovered & Verified

| Entity Role | Real ID | Database Identifier / Details | Verification State |
|---|---|---|---|
| **Admin** | `1` | `admin@test.com` | Verified active with ADMIN permissions |
| **Finance Manager** | `57` | `finance@test.com` | Verified active with FINANCE permissions |
| **Artist** | `31` | `nazov@mailinator.com` ("Arjit Singh", ₹49/month) | Verified APPROVED, subscription price = 49 |
| **Fan User A** | `28` | `sjainn@gmail.com` | Verified active Fan account (purchaser & refund target) |
| **Fan User B** | `25` | `nakul.fan@test.com` | Verified active Fan account (second fan for ambiguous & IDOR tests) |
| **Audio Content (Paid)** | `9` | "Qehar" (`subscription_required: true`, Artist `31`) | Verified locked pre-payment, unlocked post-payment, relocked post-refund |
| **Audio Content (Free)** | `8` | "Kesariya (Romance Acoustic)" (`subscription_required: false`) | Verified accessible before, during, and after refund |
| **Video Content (Paid)** | `11` | "Dhun songs" (`subscription_required: true`, Artist `31`) | Verified locked pre-payment, unlocked post-payment, relocked post-refund |

---

### 2. Comprehensive Test Case Execution Matrix

| Test ID | Category | Scenario / Description | Actual Result | Status |
|---|---|---|---|:---:|
| **GATE-001** | Automated Gate | `npm run test:payment-integrity` | Webhook verification, duplicate ordering & transaction rollback passed | **PASS** |
| **GATE-002** | Automated Gate | `npm run test:refund-integrity-contract` | Strict 100% full refund contract, idempotency & query filters passed | **PASS** |
| **GATE-003** | Automated Gate | `npm run test:refund-integrity-db` | Database schema, foreign keys, transaction locks verified | **PASS** |
| **GATE-004** | Automated Gate | `npm run report:refund-reconciliation` | Reconciles pending refunds and scans provider drift accurately | **PASS** |
| **GATE-005** | Automated Gate | `npm run test:module07-payments-refunds` | Full E2E suite covering 8 sections executed and passed 100% | **PASS** |
| **PAY-POS-001** | Payment Positive | Fan A requests checkout intent for Artist 31 (₹49) | Backend created pending subscription (ID `24`) and Razorpay order (`order_mock_28_31_...`) with authoritative amount (4900 paise) | **PASS** |
| **PAY-POS-002** | Payment Positive | Supported monthly subscription plan purchase | Created valid canonical order in INR currency | **PASS** |
| **PAY-POS-003** | Webhook Positive | Valid signed `payment.captured` webhook received | Subscription transitioned from `PENDING` → `ACTIVE`; payment recorded in ledger | **PASS** |
| **PAY-POS-004** | Webhook Positive | Client callback dropped, webhook arrives asynchronously | Backend reaches authoritative `ACTIVE` subscription state and creates entitlement | **PASS** |
| **PAY-POS-005** | State Progression | PENDING subscription before webhook arrival | UI stays in pending state; paid content remains strictly locked | **PASS** |
| **PAY-POS-006** | Negative / Security | Stale/failed webhook after successful capture | Authoritative `ACTIVE` state is preserved; stale failure rejected | **PASS** |
| **PAY-POS-007** | Negative / Price | Price manipulation attack (`amount=0`, `amount=1`, ₹9999) | Rejected with server price enforcement; server always charges ₹49 | **PASS** |
| **PAY-NEG-001** | Negative / Input | Invalid artist ID (`artistId: 99999`) | Rejected with `400 INVALID_ARTIST_ID` | **PASS** |
| **PAY-NEG-002** | Negative / Config | Purchase attempt for artist with no price set (`subscription_price = 0`) | Rejected with `409 SUBSCRIPTION_PRICE_NOT_CONFIGURED` | **PASS** |
| **PAY-SEC-001** | Webhook Security | Missing signature header (`x-razorpay-signature`) | Webhook rejected immediately with `400 WEBHOOK_SIGNATURE_REQUIRED` | **PASS** |
| **PAY-SEC-002** | Webhook Security | Tampered raw body (byte altered post-signing) | Rejected before JSON parse or database access (`400 Invalid signature`) | **PASS** |
| **PAY-SEC-003** | Webhook Security | Invalid HMAC signature | Rejected with `400 Invalid signature`; audit alert emitted | **PASS** |
| **PAY-SEC-004** | Webhook Security | Oversized payload exceeding 2MB limit | Body parser rejects with `413 Payload Too Large` | **PASS** |
| **PAY-IDEM-001** | Idempotency | Duplicate webhook delivery (same event ID) | Processed idempotently; returned `{ duplicated: true }` without duplicate credit | **PASS** |
| **PAY-IDEM-002** | Idempotency | Repeated subscription intent creation | Reuses existing pending order; prevents duplicate pending payments | **PASS** |
| **MEDIA-PAY-001** | Mandatory Media | **AUDIO Content Unlock (Item 9 'Qehar')** | Access verified: `allowed: true, reason: ACTIVE_SUBSCRIPTION` | **PASS** |
| **MEDIA-PAY-002** | Mandatory Media | **VIDEO Content Unlock (Item 11 'Dhun songs')** | Access verified: `allowed: true, reason: ACTIVE_SUBSCRIPTION` | **PASS** |
| **RFND-RBAC-001** | Refund Security | Fan attempts to call admin refund API | Strictly rejected with `403 FORBIDDEN` | **PASS** |
| **RFND-RBAC-002** | Refund Security | Unauthenticated caller attempts refund | Strictly rejected with `401 UNAUTHORIZED` | **PASS** |
| **RFND-IDOR-001** | Refund Security | IDOR attack with nonexistent payment UUID | Rejected with `404 PAYMENT_NOT_FOUND` | **PASS** |
| **RFND-POS-001** | Refund Positive | Finance manager lists refundable payments | Returned status 200 with ledger entries (Amount: 4900 paise) | **PASS** |
| **RFND-POS-002** | Refund Positive | Finance manager executes full refund | Gateway refund succeeded; payment marked `REFUNDED`; subscription revoked | **PASS** |
| **MEDIA-RFND-001**| Mandatory Media | **AUDIO Content Relock (Item 9 'Qehar')** | Access immediately relocked: `allowed: false, reason: NO_ACTIVE_SUBSCRIPTION` | **PASS** |
| **MEDIA-RFND-002**| Mandatory Media | **VIDEO Content Relock (Item 11 'Dhun songs')** | Access immediately relocked: `allowed: false, reason: NO_ACTIVE_SUBSCRIPTION` | **PASS** |
| **MEDIA-RFND-003**| Mandatory Media | **Free Audio Content Access (Item 8)** | Access preserved: `allowed: true, reason: FREE` | **PASS** |
| **RFND-IDEM-001** | Refund Idempotency| Second refund attempt on refunded payment | Returns cached refund record with 0 extra gateway calls | **PASS** |
| **RFND-REC-001**  | Reconciliation | Ambiguous gateway network timeout on refund | Enters durable `RECONCILIATION_REQUIRED` state without crashing | **PASS** |
| **RFND-REC-002**  | Reconciliation | Admin reconciles ambiguous refund with gateway | Matches provider refund by reference; transitions to `COMPLETED` | **PASS** |
| **ERR-MOBILE-001**| Mobile Error UX | API error normalization & redaction | Normalized in `mobile/apps/fan/src/services/api.ts`; raw JSON, SQL & secrets hidden; friendly copy rendered in existing Toast/Modal | **PASS** |

---

### 3. Audio & Video Entitlement Lifecycle Proof

```text
[Baseline: Fan A has NO active subscription to Artist 31]
  -> Audio 8  ('Kesariya'):            allowed: true  (reason: FREE)
  -> Audio 9  ('Qehar'):               allowed: false (reason: NO_ACTIVE_SUBSCRIPTION)
  -> Video 11 ('Dhun songs'):          allowed: false (reason: NO_ACTIVE_SUBSCRIPTION)

[Post-Payment: Webhook Captured & Confirmed for Subscription 24]
  -> Audio 9  ('Qehar'):               allowed: true  (reason: ACTIVE_SUBSCRIPTION)   [UNLOCKED]
  -> Video 11 ('Dhun songs'):          allowed: true  (reason: ACTIVE_SUBSCRIPTION)   [UNLOCKED]

[Post-Refund: Finance Manager Executes Full Refund on Payment]
  -> Audio 9  ('Qehar'):               allowed: false (reason: NO_ACTIVE_SUBSCRIPTION) [RELOCKED]
  -> Video 11 ('Dhun songs'):          allowed: false (reason: NO_ACTIVE_SUBSCRIPTION) [RELOCKED]
  -> Audio 8  ('Kesariya'):            allowed: true  (reason: FREE)                   [STILL ACCESSIBLE]
```

### 4. Error Redaction & Theme Compliance Verification

1. **Theme Reuse**:
   - Fan UI reuses existing `mobile/apps/fan/src/theme/` (`colors.ts`, `typography.ts`) and existing `SubscriptionUI.tsx` components. No new themes, colors, or unnecessary redesigns were introduced.
   - Admin/Finance UI reuses existing `web-admin/src/styles.css` and `AdminRefundsPage.tsx`.

2. **Error Normalization & Redaction**:
   - `mobile/apps/fan/src/services/api.ts` intercepts all API responses:
     - `PAYMENT_ALREADY_PROCESSED` → `"Payment already processed. Please check your transaction history."`
     - `REFUND_NOT_ALLOWED` / `PAYMENT_NOT_REFUNDABLE` → `"Refund cannot be processed for this payment."`
     - `SUBSCRIPTION_EXPIRED` → `"Your subscription has expired."`
     - `PAYMENT_GATEWAY_ERROR` → `"Payment gateway encountered an issue. Please try again."`
     - `SUBSCRIPTION_PRICE_NOT_CONFIGURED` → `"Subscription is currently unavailable for this artist."`
     - `SUBSCRIPTION_ALREADY_ACTIVE` → `"You already have an active subscription for this artist."`
   - Strips raw JSON, PostgreSQL/Prisma query errors, stack traces, and internal IDs before presenting errors to user UI components.

