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

  assert.match(provider, /getPlaybackDescriptorForRecovery/);
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

  assert.match(stream, /export async function getPlaybackDescriptorForRecovery/);
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


test('manual QA hardening keeps heartbeat, engine state and source load lifecycles independent', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.doesNotMatch(provider, /if \(lastRecordedRef\.current === key\) return/);
  assert.match(provider, /if \(lastRecordedRef\.current !== key\)/);
  assert.match(provider, /startHeartbeat\(\s*key,/s);

  assert.match(provider, /Ready\/Loading\/Buffering are transitional/);
  assert.match(provider, /nativeState === TrackPlayerState\?\.Paused/);
  assert.match(provider, /nativeState === TrackPlayerState\?\.Error/);
  assert.doesNotMatch(
    provider,
    /nativeState === TrackPlayerState\?\.Error[\s\S]{0,250}audioPlayIntentRef\.current = false/
  );

  assert.match(provider, /const isCurrentLoad = \(\) => loadToken === audioLoadTokenRef\.current/);
  assert.match(provider, /if \(!isCurrentLoad\(\)\) return/);
  assert.match(provider, /await TrackPlayer\.reset\(\);\s*if \(!isCurrentLoad\(\)\) return;/s);
  assert.match(provider, /await TrackPlayer\.add\(\[track\]\);\s*if \(!isCurrentLoad\(\)\) return;/s);

  assert.match(provider, /item\?\.mediaType === "audio" && audioSourceRef\.current/);
});

test('locked tracks cannot replace current playback and native audio end uses the same queue policy', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.match(
    provider,
    /if \(await blockLockedPlayback\(item\)\) return;\s*currentItemRef\.current = item;/s
  );
  assert.match(provider, /Event\?\.PlaybackQueueEnded/);
  assert.match(provider, /handleDidJustFinish\(\)\.catch/);
  assert.match(provider, /skipToIndexRef\.current\(nextIndex\)/);
});

test('full audio player cannot receive video items and does not restart the active logical track', () => {
  const artist = read('apps/fan/src/screens/ArtistScreen.tsx');
  const fullPlayer = read('apps/fan/src/screens/FullPlayerScreen.tsx');

  assert.match(
    artist,
    /s\.mediaType === "audio"[\s\S]{0,120}Boolean\(s\.mediaUrl\) \|\| s\.useStreamAccess/
  );
  assert.match(fullPlayer, /const sameTrack =/);
  assert.match(
    fullPlayer,
    /String\(currentItem\.contentId \?\? currentItem\.id \?\? ''\) ===[\s\S]{0,120}String\(targetItem\.contentId/
  );
});

test('background protected-audio recovery carries and re-adopts the exact playback session', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const service = read('apps/fan/src/services/playbackService.ts');
  const stream = read('apps/fan/src/services/streamService.ts');

  assert.match(provider, /playbackSessionId: playbackSessionId \?\? undefined/);
  assert.match(provider, /adoptActivePlaybackLease/);
  assert.match(service, /getPlaybackDescriptorForSessionRecovery/);
  assert.match(service, /AppState\.currentState === 'active'/);
  assert.match(service, /await TrackPlayer\.load\(replacementTrack\)/);
  assert.match(service, /await TrackPlayer\.seekTo\(resumePosition\)/);
  assert.match(stream, /export async function getPlaybackDescriptorForSessionRecovery/);
  assert.match(stream, /export function adoptActivePlaybackLease/);
});

test('remote capability contract does not advertise a native queue that is not mirrored', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const service = read('apps/fan/src/services/playbackService.ts');

  const providerOptions = provider.slice(
    provider.indexOf('await TrackPlayer.updateOptions'),
    provider.indexOf('TrackPlayer setup complete')
  );
  const serviceOptions = service.slice(
    service.indexOf('await TrackPlayer.updateOptions'),
    service.indexOf("Failed to enforce remote capabilities")
  );

  assert.doesNotMatch(providerOptions, /Capability\?\.SkipToNext/);
  assert.doesNotMatch(providerOptions, /Capability\?\.SkipToPrevious/);
  assert.doesNotMatch(serviceOptions, /Capability\.SkipToNext/);
  assert.doesNotMatch(serviceOptions, /Capability\.SkipToPrevious/);
});


test('manual QA fixes protect reset events, heartbeat resume, and explicit source retry', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.match(
    provider,
    /item\?\.mediaType === "audio" && audioSourceRef\.current/
  );
  assert.match(provider, /if \(lastRecordedRef\.current !== key\)/);
  assert.match(provider, /startHeartbeat\(\s*key,/s);
  assert.match(
    provider,
    /!audioSourceRef\.current[\s\S]{0,300}loadAndPlayAudio\(item, \{[\s\S]{0,160}resumePositionMs: stateRef\.current\.positionMs/s
  );
});

test('background service allows an explicit remote Play to retry a previously failed source', () => {
  const service = read('apps/fan/src/services/playbackService.ts');

  assert.match(service, /Event\.RemotePlay/);
  assert.match(service, /servicePlayIntent = true/);
});


test('stream recovery exports stay unique and unused RNTP progress events remain disabled', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const service = read('apps/fan/src/services/playbackService.ts');
  const stream = read('apps/fan/src/services/streamService.ts');

  assert.equal(
    (stream.match(/export function adoptActivePlaybackLease\s*\(/g) || []).length,
    1
  );
  assert.equal(
    (stream.match(/export async function getPlaybackDescriptorForSessionRecovery\s*\(/g) || []).length,
    1
  );

  assert.doesNotMatch(provider, /progressUpdateEventInterval/);
  assert.doesNotMatch(service, /progressUpdateEventInterval/);
  assert.doesNotMatch(provider, /Event\?\.PlaybackProgress/);
});
