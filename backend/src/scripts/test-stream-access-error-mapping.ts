import assert from "node:assert/strict";
import { mapStreamAccessError } from "../modules/streaming/stream-access-error";
import { MediaNotReadyException } from "../shared/exceptions/media.exception";
import { DeliveryFailedException } from "../shared/exceptions/delivery.exception";

function testMediaNotReadyMapsTo409() {
  const result = mapStreamAccessError(new MediaNotReadyException(42, "PROCESSING"));
  assert.equal(result.status, 409);
  assert.equal(result.code, "CONTENT_NOT_READY");
}

function testDeliveryFailureMapsTo502() {
  const result = mapStreamAccessError(new DeliveryFailedException("Firebase provider misconfigured"));
  assert.equal(result.status, 502);
  assert.equal(result.code, "PLAYBACK_URL_GENERATION_FAILED");
}

function testUnknownMapsTo500() {
  const result = mapStreamAccessError(new Error("unknown"));
  assert.equal(result.status, 500);
  assert.equal(result.code, "INTERNAL_ERROR");
}

function run() {
  testMediaNotReadyMapsTo409();
  testDeliveryFailureMapsTo502();
  testUnknownMapsTo500();
  console.log("test-stream-access-error-mapping: all assertions passed");
}

run();

