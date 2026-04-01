import assert from "node:assert/strict";
import { ensureValidPlaybackUrl } from "../modules/media/playback-url.guard";
import { DeliveryFailedException } from "../shared/exceptions/delivery.exception";

function testValidCloudinaryUrlPasses() {
  ensureValidPlaybackUrl({
    playbackUrl:
      "https://res.cloudinary.com/dtwkuhn2j/video/authenticated/s--abc--/sp_auto/v1/artists/2/media/asset_123.m3u8",
    storageProvider: "cloudinary",
    providerAssetId: "artists/2/media/asset_123"
  });
}

function testCloudinaryHostMismatchFails() {
  assert.throws(
    () =>
      ensureValidPlaybackUrl({
        playbackUrl: "https://example.com/video/authenticated/v1/artists/2/media/asset_123.m3u8",
        storageProvider: "cloudinary",
        providerAssetId: "artists/2/media/asset_123"
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeliveryFailedException);
      assert.match((err as Error).message, /host mismatch/i);
      return true;
    }
  );
}

function testInvalidUrlFails() {
  assert.throws(
    () =>
      ensureValidPlaybackUrl({
        playbackUrl: "not-a-url",
        storageProvider: "cloudinary",
        providerAssetId: "artists/2/media/asset_123"
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeliveryFailedException);
      assert.match((err as Error).message, /invalid/i);
      return true;
    }
  );
}

function run() {
  testValidCloudinaryUrlPasses();
  testCloudinaryHostMismatchFails();
  testInvalidUrlFails();
  console.log("test-playback-url-guard: all assertions passed");
}

run();

