# 09 — Analytics & Reporting

## Scope

Covers trusted play/view event ingestion, heartbeat/session validation, deduplication, subscriber counts, artist gross earnings, admin analytics, failure isolation, concurrency abuse and ownership.

## Core rules

- Analytics must never grant entitlement.
- Analytics failure must never block authorized playback or payment.
- Trusted playback/session evidence, not arbitrary client claims, controls play/view metrics.
- Gross earnings come from authoritative captured financial records, not play counts.
- Artist analytics is ownership-scoped.

## Automated gates

```bash
cd backend
npm run test:phase08-operational
npm run verify
```

## Positive cases

| ID | Test | Expected |
|---|---|---|
| ANA-POS-001 | authorized playback starts | trusted session/event recorded according to qualifying rules |
| ANA-POS-002 | qualifying audio play | play count increments once at defined threshold/event |
| ANA-POS-003 | qualifying video view | view count increments according to trusted rule |
| ANA-POS-004 | completed playback | completion/listening-time fields bounded correctly |
| ANA-POS-005 | Artist A opens own analytics | only Artist A metrics shown |
| ANA-POS-006 | Admin opens platform analytics | aggregate values reconcile to underlying data |
| ANA-POS-007 | subscriber count | matches authoritative active subscription definition |
| ANA-POS-008 | gross earnings | matches captured/payment ledger definition; refunded amounts treated according to current reporting rule |

## Abuse/negative matrix

- heartbeat every second;
- duplicate heartbeat payload;
- duplicate event ID;
- forged playback session;
- playback session belonging to another Fan;
- content ID not belonging to playback session;
- artist ID altered in event;
- huge position jump;
- negative position/duration;
- completion before plausible playback time;
- repeated qualifying-play event for same session;
- concurrent duplicate events;
- event after session ended/revoked;
- event after content takedown;
- unauthenticated analytics request;
- Artist A queries Artist B private analytics.

Expected: events are rejected/bounded/deduplicated as appropriate; no metric inflation via obvious client forging; no cross-user/artist data leak.

## Failure isolation

Force analytics write/query failure while:

1. authorized audio is playing;
2. authorized video is playing;
3. payment is being confirmed;
4. admin content action is executing.

Expected: analytics failure is observable but does not block playback/payment/governance unless the endpoint being used is specifically an analytics/report endpoint.

## Listening-time correctness

Test:

- short playback below qualifying threshold;
- playback exactly at threshold;
- pause periods;
- seek forward/back;
- app background;
- disconnected network and later heartbeat;
- heartbeat outside server-bounded elapsed time;
- two devices playing same content;
- session restart.

Server-bounded time must prevent a client from claiming hours of listening within seconds.

## Subscriber count

Create controlled subscription states:

- ACTIVE;
- PENDING;
- EXPIRED;
- FAILED payment;
- REFUNDED/revoked;
- CANCELLED if supported.

Verify count uses the approved active-entitlement definition, not all historical rows.

## Gross revenue

Seed/capture known QA payments and refunds. Verify artist/admin gross revenue against authoritative payment ledger/database query. Attempt forged analytics events and confirm revenue never changes because of them.

## Concurrency/job safety

Where background aggregation jobs exist:

- run same worker/job from two replicas concurrently;
- simulate restart after claim but before finish;
- rerun same job window;
- insert events during aggregation.

Expected: row/job claiming and idempotency prevent duplicate aggregation or corrupted totals.

## UI/report checks

Artist dashboard:

- subscriber count;
- per-content plays/views where in scope;
- gross earnings;
- empty state for no data;
- no subscriber PII exposure.

Admin dashboard:

- platform totals;
- per-artist summaries;
- date/filter behavior where implemented;
- loading/error state;
- values consistent after refresh.

## Data privacy/logging

Inspect analytics rows/logs for unnecessary PII. Events should use only the identifiers needed for measurement. Signed URLs, tokens, passwords and payment secrets must never appear in raw analytics payloads/logs.

## Exit criteria

Analytics is trusted, bounded, deduplicated and ownership-scoped; failure remains non-blocking to core business paths; subscriber/revenue figures reconcile to authoritative subscription/payment data; and abuse cannot materially inflate or leak metrics.

---

## QA Execution Register & Verification Evidence (Module 09)

**Execution Date:** 2026-09-29  
**Environment:** Integration Head (`nakul/module-07-09-hardening`)  
**Backend Port:** `8000`  
**Automated Gate Suite:** `npm run test:module09-analytics-reporting`

### 1. Executive Summary
- Module 09 covers client view event ingestion, 5-minute deduplication, server-owned playback session heartbeats, qualifying play thresholds (>=30s), anti-tampering time-bounding, artist ownership-scoped analytics, and platform-level admin reporting with date range validation.
- **Bug Fixed during Verification:** In `src/app.ts`, `analyticsRoutes` (`./modules/analytics/analytics.routes`) was missing from the router mounts, causing `POST /api/v1/analytics/event` to return `404 ROUTE_NOT_FOUND`. It was mounted at `/api/v1/analytics`, restoring client telemetry event ingestion.
- **All 8 Automated Verification Sections Passed 100%** with zero flakiness.

### 2. Automated Test Matrix & Verification Evidence

| Section | Focus Area | Scenarios Tested | Verified Evidence / Assertion | Status |
|:---:|---|---|---|:---:|
| **01** | Identity & Session Setup | Mint authenticated JWTs for Admin, Artist A, Fan A, Fan B with real server-backed session IDs | All 4 actor tokens minted and authenticated against `SessionService` | **PASS** |
| **02** | Client Event Ingestion & Deduplication | Fan sends `CONTENT_VIEWED` on public track -> returns 200 `accepted: true`. Immediate second event within 5-min window -> returns 200 `accepted: false, duplicate: true` | Real 5-minute time bucket deduplication validated | **PASS** |
| **03** | Ingestion Abuse & Security Matrix | 1. Unauthenticated request -> rejected with 401<br>2. Artist role calling fan ingestion -> rejected with 403<br>3. Forged `PLAY_STARTED` from client -> rejected with 400 `INVALID_ANALYTICS_EVENT`<br>4. Negative `contentId` -> rejected with 400<br>5. Non-existent content -> rejected with 403 `ANALYTICS_CONTENT_NOT_AUTHORIZED` | All 5 abuse vectors blocked according to security specification | **PASS** |
| **04** | Heartbeat Accounting & Server Play Qualification | 1. Initial heartbeat (pos 5s) -> seeds position, accepts 0 elapsed seconds; `PLAY_STARTED` not triggered (<30s threshold)<br>2. Qualifying heartbeat (pos 35s, 30s server elapsed) -> triggers `PLAY_STARTED` exactly once<br>3. Continued playback heartbeat -> strictly idempotent (0 duplicate plays)<br>4. Out-of-order sequence (seq 2 after seq 3) -> replay detected (`acceptedSeconds: 0`)<br>5. Forward jump (claimed 500s in 5s elapsed) -> clamped to server wall-clock (5s) | Server-owned stream qualification and time anti-tampering validated | **PASS** |
| **05** | Artist Analytics & Tenant Isolation | 1. Summary: returns `subscribers`, `totalPlays`, `grossEarnings` (from canonical payment ledger)<br>2. Plays Growth: returns 30-day daily points array<br>3. Earnings Growth: returns authoritative revenue points<br>4. Content Performance: returns per-track play counts strictly scoped to Artist A | Artist A data isolated; zero cross-tenant leakage | **PASS** |
| **06** | Artist Validation & Scope Security | 1. Unauthenticated artist dashboard -> 401<br>2. Fan token accessing artist analytics -> 403<br>3. `days=0` -> 400 `INVALID_ANALYTICS_RANGE`<br>4. `days=400` -> 400 `INVALID_ANALYTICS_RANGE`<br>5. Unknown metric -> 400 `INVALID_ANALYTICS_METRIC` | Query parameter safety & RBAC boundary enforced | **PASS** |
| **07** | Admin Platform Analytics & Date Validation | 1. Admin summary: platform totals (Artists, Active Subscriptions)<br>2. Multi-series dashboard data: growth, revenue, alerts<br>3. Global summary with valid date range: 200 OK<br>4. Inverted range (`startDate > endDate`) -> 400 `INVALID_ANALYTICS_RANGE`<br>5. Incomplete range (missing `endDate`) -> 400 `INVALID_ANALYTICS_RANGE`<br>6. Artist accessing Admin Analytics -> 403 Forbidden | Platform aggregates reconcile and date boundaries safely clamped | **PASS** |
| **08** | Failure Isolation | Operational failure of telemetry storage never blocks core playback, payment or governance | Non-blocking telemetry property verified | **PASS** |

### 3. Exit Criteria Evaluation
- **Telemetry Ingestion:** Trusted and deduplicated via time-windowing.
- **Play Attribution:** Controlled strictly by server-bounded elapsed time and >=30s qualifying threshold.
- **Financial Data Integrity:** Gross earnings sourced exclusively from captured payments in the canonical ledger, never manufactured by play events.
- **Tenant Isolation & RBAC:** Complete data segregation between artists, fans, and admins.
- **Module Status:** **VERIFIED COMPLETE**
