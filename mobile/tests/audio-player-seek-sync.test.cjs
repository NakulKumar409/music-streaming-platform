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

test('stale progress read from before a seek is rejected deterministically', () => {
  const { evaluateAudioProgressSample } = loadTypeScriptModule(
    'apps/fan/src/utils/audioProgressSync.ts'
  );

  const decision = evaluateAudioProgressSample({
    positionMs: 2_000,
    generationAtRead: 4,
    currentGeneration: 5,
    pendingSeek: { generation: 5, targetMs: 199_000 },
  });

  assert.deepEqual(decision, { accept: false, confirmsSeek: false });
});

test('pre-seek position is rejected until the engine reaches the pending target', () => {
  const { evaluateAudioProgressSample } = loadTypeScriptModule(
    'apps/fan/src/utils/audioProgressSync.ts'
  );

  const oldSample = evaluateAudioProgressSample({
    positionMs: 3_000,
    generationAtRead: 7,
    currentGeneration: 7,
    pendingSeek: { generation: 7, targetMs: 180_000 },
  });
  assert.deepEqual(oldSample, { accept: false, confirmsSeek: false });

  const confirmedSample = evaluateAudioProgressSample({
    positionMs: 180_450,
    generationAtRead: 7,
    currentGeneration: 7,
    pendingSeek: { generation: 7, targetMs: 180_000 },
  });
  assert.deepEqual(confirmedSample, { accept: true, confirmsSeek: true });
});

test('rapid second seek invalidates first seek progress', () => {
  const { evaluateAudioProgressSample } = loadTypeScriptModule(
    'apps/fan/src/utils/audioProgressSync.ts'
  );

  const firstSeekSample = evaluateAudioProgressSample({
    positionMs: 90_000,
    generationAtRead: 11,
    currentGeneration: 12,
    pendingSeek: { generation: 12, targetMs: 15_000 },
  });
  assert.deepEqual(firstSeekSample, { accept: false, confirmsSeek: false });

  const secondSeekSample = evaluateAudioProgressSample({
    positionMs: 15_250,
    generationAtRead: 12,
    currentGeneration: 12,
    pendingSeek: { generation: 12, targetMs: 15_000 },
  });
  assert.deepEqual(secondSeekSample, { accept: true, confirmsSeek: true });
});

test('audio provider has one native progress owner and no fixed seek unlock', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const fullPlayer = read('apps/fan/src/screens/FullPlayerScreen.tsx');

  assert.match(provider, /evaluateAudioProgressSample/);
  assert.match(provider, /generationAtRead = seekGenerationRef\.current/);
  assert.match(provider, /await TrackPlayer\.getProgress\(\)/);
  assert.match(provider, /setTimeout\(\(\) => \{\s*void poll\(\);\s*\}, 250\)/s);

  assert.doesNotMatch(provider, /Event\?\.PlaybackProgress/);
  assert.doesNotMatch(provider, /setInterval\(/);
  assert.doesNotMatch(fullPlayer, /setTimeout\(/);
  assert.doesNotMatch(fullPlayer, /durationMs \|\| 1/);
});

test('unknown duration cannot render as 100 percent progress', () => {
  const fullPlayer = read('apps/fan/src/screens/FullPlayerScreen.tsx');

  assert.match(fullPlayer, /const durationKnown = hasFiniteDuration\(playerState\.durationMs\)/);
  assert.match(fullPlayer, /maximumValue=\{durationKnown \? playerState\.durationMs : 1\}/);
  assert.match(fullPlayer, /value=\{sliderValue\}/);
  assert.match(fullPlayer, /disabled=\{!durationKnown\}/);
  assert.match(fullPlayer, /: 0;/);
});


test('protected audio source recovery is event-driven, position-preserving, and timer-free', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const stream = read('apps/fan/src/services/streamService.ts');

  assert.match(provider, /getPlaybackUrlForRecovery/);
  assert.match(provider, /lastRecoveredAudioSourceRef\.current === input\.failedUrl/);
  assert.match(provider, /resumePositionMs: input\.resumePositionMs/);
  assert.match(provider, /recovery: true/);
  assert.match(provider, /Event\?\.PlaybackError/);
  assert.match(provider, /HTMLAudioElement error/);

  assert.doesNotMatch(provider, /scheduleTokenRefresh/);
  assert.doesNotMatch(provider, /decodeJwtExpMsFromUrl/);
  assert.doesNotMatch(provider, /setAudioSource/);
  assert.doesNotMatch(provider, /3000/);
  assert.doesNotMatch(provider, /preloadNextItem/);

  assert.match(stream, /export async function getPlaybackUrlForRecovery/);
  assert.match(stream, /reacquireExpiredPlaybackLease\(contentId\)/);
  assert.match(stream, /PLAYBACK_SESSION_EXPIRED/);
  assert.match(stream, /PLAYBACK_SESSION_MISMATCH/);
});

test('canonical duration metadata is optional, persisted, exposed, and consumed by audio queues', () => {
  const migration = read('../backend/db/migrations/20260928_0015_media_duration_metadata.sql');
  const schema = read('../backend/prisma/schema.prisma');
  const contentRoutes = read('../backend/src/modules/content/content.routes.ts');
  const upload = read('../backend/src/controllers/admin/adminMediaController.ts');
  const cloudinaryStorage = read('../backend/src/shared/storage/providers/cloudinary-storage.provider.ts');
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const audioScreen = read('apps/fan/src/screens/AudioScreen.tsx');
  const homeScreen = read('apps/fan/src/screens/HomeScreen.tsx');
  const artistService = read('apps/fan/src/services/artistService.ts');

  assert.match(migration, /ADD COLUMN IF NOT EXISTS duration_ms INTEGER/);
  assert.match(schema, /durationMs\s+Int\?\s+@map\("duration_ms"\)/);
  assert.match(cloudinaryStorage, /durationMs/);
  assert.match(upload, /duration_ms = \$12/);
  assert.match(contentRoutes, /c\.duration_ms/);
  assert.match(contentRoutes, /durationMs:/);

  assert.match(provider, /toFiniteDurationMs\(item\.duration\)/);
  assert.match(audioScreen, /duration: x\.durationMs/);
  assert.match(homeScreen, /duration: x\.durationMs/);
  assert.match(artistService, /durationMs/);
});
