import assert from "node:assert/strict";
import {
  normalizeStreamContentType,
  parseSingleByteRange,
} from "../modules/media/progressive-media-http";

assert.equal(
  normalizeStreamContentType("audio/x-m4a; codecs=", "artists/1/audio/file.m4a", null),
  "audio/mp4"
);
assert.equal(
  normalizeStreamContentType("audio/mp3", "artists/1/audio/file.mp3", null),
  "audio/mpeg"
);
assert.equal(
  normalizeStreamContentType("application/octet-stream", "artists/1/audio/file.m4a", null),
  "audio/mp4"
);

assert.deepEqual(parseSingleByteRange("bytes=100-199", 1000), {
  start: 100,
  end: 199,
});
assert.deepEqual(parseSingleByteRange("bytes=100-", 1000), {
  start: 100,
  end: 999,
});
assert.deepEqual(parseSingleByteRange("bytes=-100", 1000), {
  start: 900,
  end: 999,
});
assert.deepEqual(parseSingleByteRange("bytes=-5000", 1000), {
  start: 0,
  end: 999,
});
assert.equal(parseSingleByteRange("bytes=1000-", 1000), null);
assert.equal(parseSingleByteRange("bytes=200-100", 1000), null);
assert.equal(parseSingleByteRange("bytes=0-1,3-4", 1000), null);
assert.equal(parseSingleByteRange("bytes=-0", 1000), null);

console.log("audio progressive HTTP contract: PASS");
