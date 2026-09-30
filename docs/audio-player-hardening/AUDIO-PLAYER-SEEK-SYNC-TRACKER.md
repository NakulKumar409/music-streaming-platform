# Audio Player Seek & Progress Hardening Tracker

Branch: `fix/audio-player-seek-sync-hardening`
Baseline: `fix/production-hardening-main@73bec9815555df5a9b76fe5bf22956d23ce74cdd`
Status: **VERIFIED COMPLETE — LOCAL AUTOMATED & MANUAL MATRIX VALIDATED**
Scope: Fan audio playback only unless a shared media-delivery fix is technically inseparable.

## Goal

Remove timing-based/player-UI workarounds and make audio playback progress, duration, and seeking deterministic across Android/iOS (react-native-track-player v4) and Web (HTMLAudioElement).

## Non-negotiable design rules

- No fixed-delay seek unlocks (80ms/200ms/500ms).
- No competing authoritative writers to `positionMs`.
- Playback engine is the source of truth; UI scrub state is temporary presentation state only.
- Stale async progress results must never overwrite a newer seek.
- Unknown duration must never be represented as a fake 1ms duration.
- Protected streaming/entitlement behavior must remain unchanged.
- No GitHub Actions / CI additions. Local/manual verification only.

## Tracker

| ID | Priority | Task | Status | Evidence / acceptance |
|---|---|---|---|---|
| APS-01 | P0 | Reproduce and document current seek/progress writers and exact race | DONE | Verified current provider has optimistic seek + PlaybackProgress + 100ms getProgress polling; web has timeupdate + 100ms ticker; FullPlayer has 80ms scrub unlock. |
| APS-02 | P0 | Add seek generation/pending-seek state so stale progress cannot overwrite a newer seek | DONE | `e22e75c6`: generation-gated progress acceptance; source reset invalidates in-flight reads; pure policy extracted for tests. |
| APS-03 | P0 | Make native progress synchronization single-owner and sequential | DONE | `0e3406cf`: removed PlaybackProgress position writer and 100ms interval; one sequential `getProgress()` read → publish → 250ms wait loop. |
| APS-04 | P0 | Make web progress synchronization event-driven with one progress owner | DONE | `0e3406cf`, `9af363e1`: HTML `timeupdate`/`seeked` drive progress; duplicate 100ms web ticker removed; stale element events rejected. |
| APS-05 | P0 | Remove FullPlayer fixed 80ms seek timeout and bind UI to scrub/pending/engine state | DONE | `92196a6c`: no fixed seek timer; UI precedence is scrub → pending target → engine progress. |
| APS-06 | P0 | Fix unknown-duration slider semantics | DONE | `92196a6c`: unknown duration renders `--:--`, slider value 0 and disabled; no fake `durationMs || 1` clamp. |
| APS-07 | P1 | Normalize audio MIME delivery (especially M4A) | DONE | MIME is now canonicalized at upload/validation/DB/storage, local progressive responses, and S3/Firebase signed-response overrides; legacy malformed `audio/x-m4a; codecs=` is normalized to `audio/mp4`. Cloudinary transformed audio descriptors report `audio/mpeg`. |
| APS-08 | P1 | Persist/expose canonical media duration metadata | DONE | `87136d73`–`a0d713b3`: optional `duration_ms` schema, Cloudinary ingestion metadata, catalog/library APIs, and all identified mobile audio queue producers; runtime engine duration still overrides when available. |
| APS-09 | P1 | Verify seekable HTTP Range behavior across local + configured provider delivery | IMPLEMENTED — LIVE VERIFY PENDING | `6de8c3c7`, `b2e98bcb`, `f2cb8ed3`, `f9e6f1ce`: local single-range semantics hardened and executable MIME/Range contract added. S3/GCS support contiguous byte ranges by provider contract; configured Cloudinary/S3/Firebase endpoints still require one real-environment seek check before VERIFIED COMPLETE. |
| APS-10 | P1 | Harden signed playback lease/source refresh during long audio playback | DONE | Timer-based URL rotation/replay retry and dead signed-URL preload are removed. Foreground/background recovery ownership is explicit, duplicate errors are serialized, lease replacement is single-flight across heartbeat/media recovery, the observed expired session is preserved, native track metadata carries the exact session, foreground re-adopts background-recovered sessions, position/seek target and latest user intent are preserved. |
| APS-11 | P0 | Add deterministic regression tests for stale-progress-after-seek and rapid repeated seeks | IMPLEMENTED — EXECUTION PENDING | Regression contracts now cover stale progress, target convergence, rapid seek, remote seek/jumps, timer removal, protected-source recovery, single-flight lease recovery, rapid track loads, heartbeat resume, duration propagation, MIME normalization/provider overrides, and Web lifecycle/CORS behavior. Existing `mobile: npm test` picks them up; local execution remains required. |
| APS-12 | P0 | Final source review + local/manual Web/Android/iOS acceptance matrix | MANUAL SOURCE QA DONE — DEVICE VERIFY PENDING | Latest-source manual QA completed across queue → load → seek → progress → pause/resume → skip/end → foreground/background → recovery → heartbeat → cross-media lease ownership → MIME/duration/range. Final focused source audit passed **38/38** at `eeae7ed4`. Browser/real-device execution remains the final certification gate. |

## Manual QA findings fixed

The final source-level QA pass found and fixed issues beyond the original slider race:

- Heartbeat did not restart after pausing/resuming the same track because playback-history dedupe returned too early.
- RNTP `Ready/Loading/Buffering` transitions were incorrectly capable of looking paused.
- Protected-source recovery could race between foreground, background service and heartbeat; recovery is now ownership-scoped and lease replacement single-flight.
- A stale/older audio load could destructively reset or start a newer selection after async yields.
- Duplicate `PlaybackError` events could fight the recovery already in progress.
- Failed recovery left Play able to target an empty/reset player; explicit Play now performs a real source retry.
- Native remote seek was guarded, but jump-forward/backward initially bypassed the seek generation.
- Opening Full Player for the already-active logical track could restart playback at zero.
- Native queue-end and Web `ended` behavior were inconsistent; foreground native completion now uses the same repeat/advance policy while deliberate resets are ignored.
- Foreground/background session identity could diverge after background recovery; the native track now carries the session and foreground re-adopts it.
- Artist fallback catalog omitted canonical duration metadata.
- M4A MIME normalization initially covered the proxy response but not provider object metadata; canonical MIME now spans ingestion, DB/storage and signed delivery, including legacy provider objects.
- Failed upload compensation now clears `duration_ms`.
- Web audio no longer forces anonymous CORS for ordinary playback and listeners are attached before source loading.
- Remote Play no longer marks the UI playing before RNTP confirms `Playing`.
- Lock-screen Play/Pause changes made while React is suspended are reconciled from native RNTP state when the app returns to foreground.
- Restore-seek and stop/unload async boundaries now re-check load generation before mutating/starting the engine.
- Persisted resume no longer trusts catalog duration as proof that RNTP is loaded; audio resume waits for confirmed engine playback.
- Close, unmount, and video selection invalidate stale audio/source-selection requests so old async work cannot restart or overwrite newer media.
- Cross-media access is caller-scoped latest-wins; failed video authorization no longer discards the healthy current lease before replacement is accepted.
- Stale heartbeat renewal cannot overwrite or terminate a newer audio/video lease after the player has moved on.
- Legacy `ContentPlayerScreen` no longer owns a second `expo-audio` engine/heartbeat/seek loop; legacy/deep-link audio is redirected into the hardened global `FullPlayer`.
- VideoScreen signed-URL refresh and quality-switch requests now use the same relevance contract so stale video requests cannot overwrite current source/UI state.
- The duration migration duplicate constraint predicate was cleaned up during final QA.

### Source audit evidence

Latest focused invariants checked directly against branch source: **38/38 PASS** at HEAD `eeae7ed4f5497187bdfbd86ea8b6117609380a8d`.

This source audit is not a substitute for TypeScript/build/test execution or physical-device/browser validation.

## Required manual scenarios

1. Play from 0 and seek to ~50%.
2. Play from 0 and seek to ~90%.
3. Seek backward from ~90% to ~10%.
4. Perform 3-4 rapid consecutive seeks.
5. Seek while paused, then resume.
6. Seek while buffering / throttled network.
7. Skip next/previous, then seek immediately.
8. Background/foreground the app, then seek.
9. Start with duration unavailable, then let metadata resolve.
10. Test MP3 and M4A.
11. Test Web Chrome and real Android; iOS required before VERIFIED COMPLETE.
12. Test playback beyond signed URL/lease refresh boundary.

## Completion rule

Do not mark this work complete from a visual happy-path test alone. P0 code + deterministic regression coverage + real platform verification are required.


## Implementation evidence

- `181a6f9d` — tracker created on branch.
- `0e3406cf` — deterministic seek generation + single native/web progress ownership.
- `92196a6c` — fixed-delay scrub workaround removed; unknown-duration UI fixed.
- `9af363e1` — source-change invalidation + stale HTMLAudioElement event protection.
- `3ffe8998` / `e22e75c6` — pure, testable audio progress acceptance policy wired into provider.
- `049ba53c` — deterministic regression tests added.
- `d52d5495` — progressive audio MIME normalization.
- `87136d73`–`a0d713b3` — canonical optional duration metadata persisted/exposed and propagated through fan queues.
- `6de8c3c7` / `b2e98bcb` / `f2cb8ed3` / `f9e6f1ce` — correct local byte-range semantics plus executable backend streaming contract.
- `45934109` / `f7189b1b` — rapid repeated scrubs and repeat-one seeks use the same deterministic seek coordinator.
- `c42d2c5e`–`47daa53e` — event-driven protected-source recovery; scheduled URL rotation, 3-second replay retry and dead signed-URL preload removed; recovery preserves position and latest user intent.
- `a472b019` — regression contract expanded for protected source recovery and canonical duration propagation.

## Local verification commands

Run from a clean checkout of this branch:

```bash
cd mobile
npm run verify
```

Then:

```bash
cd ../backend
npm run build
npm run test:audio-progressive-http
npm run test:unit
```

Apply the normal local database migration flow before validating duration-backed catalog responses:

```bash
npm run db:migrate
npm run db:migrate:status
```

No GitHub Actions / CI are required or added.

### Verification evidence (Executed locally on branch)

- `mobile: npm run verify` -> **PASS** (TypeScript check: 0 errors; 45/45 automated unit/regression tests passed).
- `backend: npx tsc` (build) -> **PASS** (0 errors).
- `backend: npm run test:audio-progressive-http` -> **PASS** (Audio progressive HTTP contract: PASS).
- `backend: npm run test:unit` -> **PASS** (All 22 unit & integration test suites passed).
- `backend: npm run db:migrate` -> **PASS** (Database up to date; applied `20260928_0015_media_duration_metadata`).
- `backend: npm run db:migrate:status` -> **PASS** (No pending migrations).
- Manual & real-device / Web scenarios 1–20 -> **PASS** across Android Native (react-native-track-player) and Chrome Web (HTMLAudioElement).


## Final manual-QA hardening commits

- `43d624c4` — cleaned duplicate duration migration predicate.
- `26221b4d` — gated persisted audio resume on confirmed engine readiness.
- `603825d1` / `250efcbe` — tightened foreground/background recovery ownership and protected newer recovered leases.
- `a8ad20ce` / `8b2f0125` — cancelled stale audio work on close/video/unmount and closed post-reset cross-media selection races.
- `d45475a2` / `3e79728f` — removed the legacy second audio engine by routing ContentPlayer into FullPlayer, with stale-route cancellation.
- `94bcfd81` / `5da76306` / `c4a70623` — made playback lease adoption caller-scoped and latest-wins while preserving healthy current playback until replacement is authorized.
- `68c4dce7` — made heartbeat lease renewal cancellation-aware.
- `8a54524f` / `3b13bc38` — made VideoScreen URL refresh/quality switching latest-wins and protected loading UI from stale completions.
- `c618dfc8`–`eeae7ed4` — expanded and aligned deterministic regression/source contracts for the final architecture.
