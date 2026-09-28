# Audio Player Seek & Progress Hardening Tracker

Branch: `fix/audio-player-seek-sync-hardening`
Baseline: `fix/production-hardening-main@73bec9815555df5a9b76fe5bf22956d23ce74cdd`
Status: **IN PROGRESS — CORE P0 IMPLEMENTED, VERIFICATION + P1 DELIVERY HARDENING PENDING**
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
| APS-07 | P1 | Normalize audio MIME delivery (especially M4A) | DONE | `d52d5495`: stream response strips invalid parameters and normalizes M4A to `audio/mp4`, MP3 aliases to `audio/mpeg`. |
| APS-08 | P1 | Persist/expose canonical media duration metadata | NOT STARTED | Catalog/API can return duration; runtime player metadata remains authoritative after load. |
| APS-09 | P1 | Verify seekable HTTP Range behavior across local + configured provider delivery | NOT STARTED | Seek requests support byte ranges / provider equivalent without entitlement bypass. |
| APS-10 | P1 | Harden signed playback lease/source refresh during long audio playback | NOT STARTED | Refresh cannot reset position or replace active source unsafely. |
| APS-11 | P0 | Add deterministic regression tests for stale-progress-after-seek and rapid repeated seeks | IN PROGRESS | `049ba53c`: executable stale-read, convergence, rapid-second-seek and source-contract tests added. Local test execution + paused/buffering coverage still pending. |
| APS-12 | P0 | Final source review + local/manual Web/Android/iOS acceptance matrix | NOT STARTED | No regression to background audio, mini player, next/previous, entitlement, heartbeat/progress persistence. |

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

### Verification note

No local build/typecheck/device command is claimed as passed from this remote review session. Source review and committed regression tests are complete for the rows marked DONE; APS-11/APS-12 remain open until local execution and physical-device/browser verification evidence exists.
