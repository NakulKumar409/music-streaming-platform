const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

test('VideoScreen enforces mutual exclusion: awaits pauseAudio before video play and pauses on blur', () => {
  const videoScreen = read('apps/fan/src/screens/VideoScreen.tsx');

  // 1. safePlay must be async and strictly await pauseAudio before calling target.play()
  assert.match(videoScreen, /const safePlay = useCallback\(async/);
  assert.match(videoScreen, /await pauseAudio\?\.\(\);/);
  assert.match(videoScreen, /const maybePromise = target\.play\(\);/);

  // 2. onPressVideo must pause audio before starting new video
  assert.match(videoScreen, /onPressVideo[\s\S]{0,400}await pauseAudio\?\.\(\);/);

  // 3. navigation blur listener must pause video when navigating to other screens/tabs
  assert.match(
    videoScreen,
    /navigation\.addListener\(["']blur["'][\s\S]{0,350}playerRef\.current\.pause\(\);/s
  );

  // 4. pauseInlineVideoIfNeeded must pause native player
  assert.match(videoScreen, /pauseInlineVideoIfNeeded = useCallback\(async/);
});

test('MediaPlayerProvider enforces mutual exclusion: stops video before playing audio and in togglePlayPause', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  // 1. registerInlineVideoPauseHandler supports async promise
  assert.match(
    provider,
    /registerInlineVideoPauseHandler: \(handler: \(\(\) => Promise<void> \| void\) \| null\) => void;/
  );

  // 2. stopVideo awaits inlineVideoPauseHandlerRef
  assert.match(
    provider,
    /const stopVideo = useCallback\(async \(\) => \{[\s\S]{0,500}await inlineVideoPauseHandlerRef\.current\(\);/s
  );

  // 3. playQueue stops video before loading audio
  assert.match(
    provider,
    /if \(item\.mediaType === "audio"\) \{[\s\S]{0,150}await stopVideo\(\);[\s\S]{0,100}await loadAndPlayAudio\(item\);/s
  );

  // 4. togglePlayPause stops video before resuming audio
  assert.match(
    provider,
    /togglePlayPause = useCallback\(async \(\) => \{[\s\S]*?await stopVideo\(\);\s*await TrackPlayer\.play\(\);/s
  );

  // 5. togglePlayPause pauses audio before resuming video
  assert.match(
    provider,
    /togglePlayPause = useCallback\(async \(\) => \{[\s\S]*?await pauseAudio\(\);\s*videoPlayer\.play\(\);/s
  );
});
