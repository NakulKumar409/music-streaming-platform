import assert from "node:assert/strict";
import { CloudinaryDeliveryStrategy } from "../shared/delivery/strategies/cloudinary-delivery.strategy";
import { DeliveryFailedException } from "../shared/exceptions/delivery.exception";

function makeStrategy() {
  const calls: Array<{ providerAssetId: string; fileType: "audio" | "video" }> = [];
  const strategy = new CloudinaryDeliveryStrategy({
    async generateSignedPlaybackUrl(providerAssetId, fileType) {
      calls.push({ providerAssetId, fileType });
      return {
        playbackUrl: `https://res.cloudinary.com/demo/video/authenticated/v1/${providerAssetId}.mp4`,
        expiryTime: Math.floor(Date.now() / 1000) + 300,
        mediaType: fileType
      };
    }
  });
  return { strategy, calls };
}

async function testUsesProviderAssetIdOnly() {
  const { strategy, calls } = makeStrategy();
  const response = await strategy.generatePlaybackAccess({
    mediaId: 1,
    storageProvider: "cloudinary",
    storageKey: "artists/2/media/wrong-storage-key.mp4",
    providerAssetId: "artists/2/media/public_id_real",
    visibility: "PUBLIC",
    userId: 13,
    token: "x",
    expiresInSeconds: 300,
    kind: "video"
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].providerAssetId, "artists/2/media/public_id_real");
  assert.equal(calls[0].fileType, "video");
  assert.match(response.playbackUrl, /^https:\/\/res\.cloudinary\.com\//);
}

async function testMissingProviderAssetIdFails() {
  const { strategy } = makeStrategy();
  await assert.rejects(
    () =>
      strategy.generatePlaybackAccess({
        mediaId: 2,
        storageProvider: "cloudinary",
        storageKey: "artists/2/media/legacy-key",
        visibility: "PUBLIC",
        userId: 13,
        token: "x",
        expiresInSeconds: 300,
        kind: "video"
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeliveryFailedException);
      assert.match((err as Error).message, /providerAssetId is required/i);
      return true;
    }
  );
}

async function run() {
  await testUsesProviderAssetIdOnly();
  await testMissingProviderAssetIdFails();
  console.log("test-cloudinary-delivery-strategy: all assertions passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
