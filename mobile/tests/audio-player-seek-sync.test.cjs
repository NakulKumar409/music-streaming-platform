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
