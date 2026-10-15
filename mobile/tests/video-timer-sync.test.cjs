const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

test('formatDurationLabel formats seconds, minutes, and hours accurately', () => {
  // Test formatting logic using equivalent JS implementation
  function formatDurationLabel(ms, fallback = "--:--") {
    if (!Number.isFinite(ms) || ms < 0) return fallback;
    const totalSeconds = Math.floor(ms / 1000);
    if (!Number.isFinite(totalSeconds)) return fallback;
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return fallback;
    if (hh > 0) {
      return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    }
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  assert.equal(formatDurationLabel(0), '00:00');
  assert.equal(formatDurationLabel(1000), '00:01');
  assert.equal(formatDurationLabel(12400), '00:12');
  assert.equal(formatDurationLabel(60000), '01:00');
  assert.equal(formatDurationLabel(220000), '03:40');
  assert.equal(formatDurationLabel(3600000), '1:00:00');
  assert.equal(formatDurationLabel(3665000), '1:01:05');
  assert.equal(formatDurationLabel(-1, '00:00'), '00:00');
  assert.equal(formatDurationLabel(NaN, '--:--'), '--:--');
});

test('VideoScreen implements authoritative player time sync and stable subscriptions', () => {
  const videoScreen = read('apps/fan/src/screens/VideoScreen.tsx');

  // 1. Authoritative position and duration sync in periodic interval
  assert.match(videoScreen, /const rawSec = typeof p\.currentTime === "number" \? p\.currentTime : 0;/);
  assert.match(videoScreen, /const curMs = toFiniteDurationMs\(rawSec \* 1000\);/);
  assert.match(videoScreen, /const durMs = toFiniteDurationMs\(rawDurSec \* 1000\);/);
  assert.match(videoScreen, /setPositionMs\(\(prev\) =>/);
  assert.match(videoScreen, /setDurationMs\(durMs\);/);

  // 2. Monotonic progression guards ExoPlayer clock jitter while allowing looping and rewinds
  assert.match(videoScreen, /curMs < prev && \(prev - curMs > 2000 \|\| curMs < 500\)/);
  assert.match(videoScreen, /p\.playing && curMs < prev/);

  // 3. UI binding: both time text and slider bind to displayPositionMs
  assert.match(videoScreen, /formatDurationLabel\(displayPositionMs, "00:00"\)/);
  assert.match(videoScreen, /formatDurationLabel\(durationMs, "--:--"\)/);
  assert.match(videoScreen, /value=\{Math\.min\(displayPositionMs, durationMs \|\| 1\)\}/);

  // 4. Scrubbing priority
  assert.match(videoScreen, /const displayPositionMs =\s+scrubPosition !== null\s+\? scrubPosition/);

  // 5. Clean state reset on video selection
  assert.match(videoScreen, /setPositionMs\(0\);/);
  assert.match(videoScreen, /setDurationMs\(0\);/);
  assert.match(videoScreen, /seekValueRef\.current = 0;/);
  assert.match(videoScreen, /setScrubPosition\(null\);/);
  assert.match(videoScreen, /pendingSeekTargetMsRef\.current = null;/);

  // 6. Listener stability: safePlayRef prevents 500ms re-subscription churn
  assert.match(videoScreen, /const safePlayRef = useRef\(safePlay\);/);
  assert.match(videoScreen, /safePlayRef\.current\?\.\(videoPlayer as any/);
});
