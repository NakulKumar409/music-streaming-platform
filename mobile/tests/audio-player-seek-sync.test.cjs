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
  assert.match(
    stream,
    /reacquireExpiredPlaybackLease\(\s*contentId,\s*observedLease\?\.sessionId\s*\)/s
  );
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
  const app = read('../mobile/App.tsx');

  assert.doesNotMatch(provider, /if \(lastRecordedRef\.current === key\) return/);
  assert.match(provider, /if \(lastRecordedRef\.current !== key\)/);
  assert.doesNotMatch(provider, /startHeartbeat\(/);
  assert.match(app, /function PlaybackHeartbeatLifecycleBridge\(\)/);
  assert.match(app, /startHeartbeat\(\s*contentKey,/s);

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
    /if \(await blockLockedPlayback\(item\)\) return;[\s\S]{0,260}currentItemRef\.current = item;/s
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
  assert.match(
    service,
    /if \(appState === 'active'\) return;/
  );
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
  const app = read('../mobile/App.tsx');
  assert.match(app, /startHeartbeat\(\s*contentKey,/s);
  assert.match(
    provider,
    /!audioSourceRef\.current[\s\S]{0,300}loadAndPlayAudio\(item, \{[\s\S]{0,160}resumePositionMs: stateRef\.current\.positionMs/s
  );
});

test('background service allows an explicit remote Play to retry a previously failed source', () => {
  const service = read('apps/fan/src/services/playbackService.ts');

  assert.match(service, /Event\.RemotePlay/);
  assert.match(service, /lastRecoveredSourceUrl = null/);
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


test('remote seek and jump controls all enter the same pending-seek generation', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.match(provider, /Event\?\.RemoteSeek[\s\S]{0,300}beginPendingSeek\(pos\)/);
  assert.match(
    provider,
    /Event\?\.RemoteJumpForward[\s\S]{0,500}beginPendingSeek\(target\)/
  );
  assert.match(
    provider,
    /Event\?\.RemoteJumpBackward[\s\S]{0,400}beginPendingSeek/
  );
});

test('audio loading does not report playing before the engine accepts play', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.match(
    provider,
    /durationMs: seededDuration > 0 \? seededDuration : s\.durationMs,\s*isPlaying: false,/s
  );
  assert.match(
    provider,
    /await TrackPlayer\.play\(\);\s*if \(isCurrentLoad\(\)\) \{\s*setState\(\(s\) => \(\{ \.\.\.s, isPlaying: true \}\)\);/s
  );
  assert.match(
    provider,
    /clearPendingSeek\(restoreSeekGeneration\)/
  );
});

test('MIME is canonical at upload, local delivery, and signed-provider delivery', () => {
  const metadata = read('../backend/src/shared/storage/utils/file-metadata.util.ts');
  const validation = read('../backend/src/modules/content/media-upload-validation.ts');
  const upload = read('../backend/src/controllers/admin/adminMediaController.ts');
  const progressive = read('../backend/src/modules/media/progressive-media-http.ts');
  const signed = read('../backend/src/shared/delivery/strategies/signed-url-delivery.strategy.ts');

  assert.match(metadata, /normalizeMediaMimeType/);
  assert.match(metadata, /audio\/x-m4a/);
  assert.match(validation, /normalizeMediaMimeType\(input\.mimeType\)/);
  assert.match(upload, /contentType: mediaMimeType/);
  assert.match(upload, /duration_ms = NULL/);
  assert.match(progressive, /normalizeMediaMimeType/);
  assert.match(signed, /ResponseContentType: canonicalContentType/);
  assert.match(signed, /responseType: canonicalContentType/);
});

test('foreground and background recovery owners cannot intentionally overlap', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const service = read('apps/fan/src/services/playbackService.ts');

  assert.match(
    provider,
    /if \(AppState\.currentState !== "active"\) \{\s*return;\s*\}/s
  );
  assert.match(
    service,
    /if \(appState === 'active'\) return;/
  );
});


test('heartbeat and media recovery share one expired-lease replacement', () => {
  const stream = read('apps/fan/src/services/streamService.ts');
  const heartbeat = read('apps/fan/src/services/heartbeatService.ts');

  assert.match(stream, /leaseRecoveryInFlight/);
  assert.match(
    stream,
    /if \(leaseRecoveryInFlight\?\.contentId === numericContentId\)[\s\S]{0,120}return leaseRecoveryInFlight\.promise/
  );
  assert.match(
    stream,
    /return reacquireExpiredPlaybackLease\(\s*numericContentId,\s*existing\.sessionId\s*\)/s
  );
  assert.match(
    heartbeat,
    /reacquireExpiredPlaybackLease\(\s*contentId,\s*lease\.sessionId\s*\)/s
  );
});


test('late saved-position hydration cannot overwrite a newer seek decision', () => {
  const app = read('../mobile/App.tsx');

  assert.match(app, /pendingSeekPositionMs/);
  assert.match(app, /seekBeforeResumeKeyRef/);
  assert.match(
    app,
    /if \(seekBeforeResumeKeyRef\.current === contentKey\)[\s\S]{0,180}resumeAppliedKeyRef\.current = contentKey/s
  );
});


test('manual QA locks rapid-load and duplicate-recovery races', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const stream = read('apps/fan/src/services/streamService.ts');

  assert.match(
    provider,
    /await stopVideo\(\);[\s\S]{0,180}if \(!isCurrentLoad\(\)\) return;[\s\S]{0,180}await unloadAudio\(\);/
  );
  assert.match(
    provider,
    /await TrackPlayer\.seekTo\(resumePositionMs \/ 1000\);[\s\S]{0,180}if \(!isCurrentLoad\(\)\) return;/
  );
  assert.match(provider, /foregroundRecoveryInFlightRef/);
  assert.match(
    provider,
    /foregroundRecoveryInFlightRef\.current = true;[\s\S]{0,700}\.finally\(\(\) => \{[\s\S]{0,100}foregroundRecoveryInFlightRef\.current = false/
  );

  assert.match(
    stream,
    /const observedLease = getActivePlaybackLease\(contentId\)/
  );
  assert.match(
    stream,
    /reacquireExpiredPlaybackLease\([\s\S]{0,120}observedLease\?\.sessionId/
  );
});

test('web audio does not force anonymous CORS and syncs cached metadata', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.doesNotMatch(provider, /\.crossOrigin\s*=/);
  assert.match(provider, /wa\.src = playbackUrl;\s*wa\.load\(\)/);
  assert.match(
    provider,
    /if \(wa\.readyState >= 1\) \{\s*syncDuration\(\);\s*void restoreAndMaybePlay\(\);/
  );
});

test('remote play waits for RNTP playback-state confirmation', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const remotePlayBlock = provider.slice(
    provider.indexOf('const remotePlaySubscription'),
    provider.indexOf('const remotePauseSubscription')
  );

  assert.match(remotePlayBlock, /audioPlayIntentRef\.current = true/);
  assert.doesNotMatch(remotePlayBlock, /isPlaying: true/);
  assert.match(
    provider,
    /nativeState === TrackPlayerState\?\.Playing[\s\S]{0,180}isPlaying: true/
  );
});


test('foreground resume reconciles lock-screen native play and pause state', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.match(
    provider,
    /const nativeState = await TrackPlayer\.getState\(\)/
  );
  assert.match(
    provider,
    /nativeState === TrackPlayerState\?\.Playing[\s\S]{0,220}audioPlayIntentRef\.current = true/
  );
  assert.match(
    provider,
    /nativeState === TrackPlayerState\?\.Paused[\s\S]{0,350}audioPlayIntentRef\.current = false/
  );
});


test('persisted audio resume waits for confirmed engine playback rather than catalog duration', () => {
  const app = read('../mobile/App.tsx');

  assert.match(app, /currentItem\?\.mediaType === 'audio'/);
  assert.match(
    app,
    /if \(currentItem\?\.mediaType === 'audio'\) \{\s*if \(!state\.isPlaying\) return;\s*\}/s
  );
});

test('close video switch and unmount invalidate stale audio loads', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.match(provider, /const cancelPendingAudioLoad = useCallback/);
  assert.match(
    provider,
    /const prepareVideo = useCallback[\s\S]{0,180}cancelPendingAudioLoad\(\)/
  );
  assert.match(
    provider,
    /const close = useCallback[\s\S]{0,200}cancelPendingMediaSelection\(\);[\s\S]{0,100}cancelPendingAudioLoad\(\)/
  );
  assert.match(
    provider,
    /return \(\) => \{\s*cancelPendingMediaSelection\(\);\s*cancelPendingAudioLoad\(\);/s
  );
});

test('cross-media selections are latest-wins before and after async video preparation', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.match(provider, /mediaSelectionTokenRef/);
  assert.match(provider, /const isCurrentSelection = \(\) =>/);
  assert.match(
    provider,
    /const url = await getPlaybackUrl[\s\S]{0,180}if \(!isCurrentSelection\(\)\) return;/s
  );
  assert.match(
    provider,
    /await prepareVideo\(\);\s*if \(!isCurrentSelection\(\)\) return;/s
  );
});

test('out-of-order playback access cannot overwrite the newest media or lease', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');
  const stream = read('apps/fan/src/services/streamService.ts');

  assert.match(stream, /export type PlaybackDescriptorOptions/);
  assert.match(stream, /isStillRelevant\?: \(\) => boolean/);
  assert.match(stream, /PLAYBACK_REQUEST_SUPERSEDED/);
  assert.match(
    provider,
    /getPlaybackDescriptorForRecovery[\s\S]{0,260}\{ isStillRelevant: isCurrentLoad \}/s
  );
  assert.match(
    provider,
    /getPlaybackUrl\([\s\S]{0,220}"video"[\s\S]{0,180}\{ isStillRelevant: isCurrentSelection \}/s
  );
  assert.match(
    stream,
    /previousDifferentContentLease[\s\S]{0,900}Playback request was superseded/s
  );
});

test('foreground reconciliation never overwrites a newer recovered lease with stale native metadata', () => {
  const provider = read('apps/fan/src/providers/MediaPlayerProvider.tsx');

  assert.match(provider, /const cachedLease = getActivePlaybackLease\(contentId\)/);
  assert.match(
    provider,
    /!cachedLease \|\|\s*cachedLease\.sessionId === nativeSessionId[\s\S]{0,160}adoptActivePlaybackLease/s
  );
  assert.match(provider, /Preserving newer foreground playback lease/);
});


test('legacy ContentPlayer route no longer owns a second audio engine', () => {
  const legacy = read('apps/fan/src/screens/ContentPlayerScreen.tsx');

  assert.doesNotMatch(legacy, /expo-audio/);
  assert.doesNotMatch(legacy, /createAudioPlayer/);
  assert.doesNotMatch(legacy, /setInterval\(/);
  assert.doesNotMatch(legacy, /\/stream\/access/);
  assert.match(legacy, /navigation\.replace\('FullPlayer'/);
  assert.match(legacy, /resolveGenerationRef/);
});

test('different-content access preserves current playback until replacement is authorized', () => {
  const stream = read('apps/fan/src/services/streamService.ts');

  assert.match(stream, /const previousDifferentContentLease/);
  assert.match(
    stream,
    /Keep the currently playing different-content lease alive until the new[\s\S]{0,180}access = await requestNewAccess\(\)/s
  );
  assert.match(
    stream,
    /error\.code === 'PLAYBACK_SESSION_LIMIT'[\s\S]{0,500}terminatePlaybackAccess/s
  );
  assert.match(
    stream,
    /storeActiveLease\(numericContentId, access\.sessionId\)[\s\S]{0,400}previousDifferentContentLease\.sessionId/s
  );
});

test('expired lease recovery never returns a different-content winner to its caller', () => {
  const stream = read('apps/fan/src/services/streamService.ts');

  assert.match(
    stream,
    /winner && winner\.contentId !== numericContentId[\s\S]{0,300}PLAYBACK_REQUEST_SUPERSEDED/s
  );
  assert.match(
    stream,
    /winner &&[\s\S]{0,180}expectedSessionId[\s\S]{0,300}return \{ \.\.\.winner \}/s
  );
});
