const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');

function loadTypeScriptModule(relativePath) {
  const source = read(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'require', output);
  fn(module, module.exports, require);
  return module.exports;
}

test('media identity resolves exact queue item through id or contentId', () => {
  const { findMediaQueueIndex, isSameMediaIdentity } = loadTypeScriptModule(
    'apps/fan/src/utils/mediaQueue.ts'
  );

  const queue = [
    { id: 'song-a', contentId: '101' },
    { id: 'song-b', contentId: '202' },
    { id: 'song-c', contentId: '303' },
  ];

  assert.equal(findMediaQueueIndex(queue, { id: 'song-b' }), 1);
  assert.equal(findMediaQueueIndex(queue, { contentId: '303' }), 2);
  assert.equal(findMediaQueueIndex(queue, { id: '202' }), 1);
  assert.equal(findMediaQueueIndex(queue, { id: 'missing' }), -1);
  assert.equal(
    isSameMediaIdentity(
      { id: '123:audio', contentId: '123' },
      { id: '123' }
    ),
    true
  );
});

test('audio entry points never silently fall back to queue index zero', () => {
  const audio = read('apps/fan/src/screens/AudioScreen.tsx');
  const home = read('apps/fan/src/screens/HomeScreen.tsx');
  const artist = read('apps/fan/src/screens/ArtistScreen.tsx');
  const album = read('apps/fan/src/screens/AlbumDetailScreen.tsx');

  for (const source of [audio, home, artist, album]) {
    assert.doesNotMatch(source, /Math\.max\(\s*0,\s*queue\.findIndex/);
    assert.doesNotMatch(source, /queueIndex:\s*idx\s*>=\s*0\s*\?\s*idx\s*:\s*0/);
  }

  assert.match(audio, /const queueIndex = findMediaQueueIndex\(queue, song\);/);
  assert.match(audio, /if \(queueIndex < 0\) return null;/);
  assert.match(home, /const idx = findMediaQueueIndex\(queue, item\);/);
  assert.match(home, /if \(idx < 0\) return null;/);
  assert.match(artist, /const idx = findMediaQueueIndex\(queue, song\);/);
  assert.match(artist, /if \(idx < 0\) return null;/);
  assert.match(album, /const queueIndex = findMediaQueueIndex\(queue, song\);/);
  assert.match(album, /if \(queueIndex < 0\)/);
});

test('locked audio remains represented in queue but is blocked before wrong-song navigation', () => {
  const audio = read('apps/fan/src/screens/AudioScreen.tsx');
  const artist = read('apps/fan/src/screens/ArtistScreen.tsx');

  assert.match(
    audio,
    /const queue: MediaItem\[\] = list\.map\(\(x\) => \(\{[\s\S]{0,900}isLocked: x\.isLocked \?\? false/
  );
  assert.match(
    audio,
    /if \(song\.isLocked\) \{[\s\S]{0,700}Subscription required[\s\S]{0,700}return;/
  );

  assert.match(
    artist,
    /const queue = filteredSongs[\s\S]{0,180}\.filter\(\(s\) => s\.mediaType === "audio"\)/
  );
  assert.match(
    artist,
    /if \(isSongLocked\) \{[\s\S]{0,400}showToast\([\s\S]{0,400}return;/
  );
});

test('player rejects invalid queue index instead of clamping to first track', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const start = provider.indexOf('const playQueue = useCallback');
  const end = provider.indexOf('const togglePlayPause = useCallback', start);
  const block = provider.slice(start, end);

  assert.match(block, /!Number\.isInteger\(index\)/);
  assert.match(block, /index < 0/);
  assert.match(block, /index >= queue\.length/);
  assert.match(block, /showToast\(/);
  assert.match(block, /const safeIndex = index;/);
  assert.doesNotMatch(block, /Math\.min\([\s\S]{0,120}Math\.max\(0, index\)/);
});

test('full player validates route selection before autoplay', () => {
  const fullPlayer = read('apps/fan/src/screens/FullPlayerScreen.tsx');

  assert.match(fullPlayer, /!Number\.isInteger\(queueIndex\)/);
  assert.match(fullPlayer, /queueIndex < 0/);
  assert.match(fullPlayer, /queueIndex >= queue\.length/);
  assert.match(fullPlayer, /const targetItem = queue\[queueIndex\];/);
});

test('premium toast is globally available for playback feedback', () => {
  const app = read('../mobile/App.tsx');
  const toast = read('apps/fan/src/ui/ToastProvider.tsx');
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const audio = read('apps/fan/src/screens/AudioScreen.tsx');
  const home = read('apps/fan/src/screens/HomeScreen.tsx');
  const artist = read('apps/fan/src/screens/ArtistScreen.tsx');
  const album = read('apps/fan/src/screens/AlbumDetailScreen.tsx');

  assert.match(app, /<ToastProvider>/);
  assert.match(app, /<MediaPlayerProvider>/);
  assert.match(toast, /actionLabel\?: string/);
  assert.match(toast, /accessibilityLiveRegion="polite"/);
  assert.match(toast, /maxWidth: 560/);
  assert.match(provider, /const showSubscriptionToast = useCallback/);
  assert.match(provider, /actionLabel: "View plan"/);
  assert.doesNotMatch(provider, /StatusModal/);
  assert.doesNotMatch(provider, /Alert\.alert/);

  for (const source of [audio, home, artist, album]) {
    assert.match(source, /useToast/);
    assert.match(source, /showToast/);
  }
});
