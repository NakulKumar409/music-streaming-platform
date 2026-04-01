/**
 * Signed URL delivery for S3/Firebase. Section 22.2.
 * Backend generates short-lived signed URL after entitlement check.
 */

import type { IMediaDeliveryStrategy } from "../interfaces/media-delivery-strategy.interface";
import type { GeneratePlaybackAccessParams, PlaybackAccessResult } from "../interfaces/media-delivery-strategy.interface";
import { getStorageProvider } from "../../storage/factory/storage-provider.factory";
import { getStorageConfig } from "../../../config/storage.config";
import { DeliveryFailedException } from "../../exceptions/delivery.exception";

export class SignedUrlDeliveryStrategy implements IMediaDeliveryStrategy {
  async generatePlaybackAccess(params: GeneratePlaybackAccessParams): Promise<PlaybackAccessResult> {
    const { storageKey, contentType, contentLength, expiresInSeconds, storageProvider } = params;

    // Use the per-row storage provider, not the global config
    if (storageProvider === "s3") {
      return this.generateS3SignedUrl(storageKey, contentType, contentLength, expiresInSeconds);
    }

    if (storageProvider === "firebase") {
      return this.generateFirebaseSignedUrl(storageKey, contentType, expiresInSeconds);
    }

    throw new DeliveryFailedException("SignedUrlDeliveryStrategy only supports s3 or firebase storage");
  }

  private async generateS3SignedUrl(
    storageKey: string,
    contentType?: string,
    contentLength?: number,
    expiresInSeconds?: number
  ): Promise<PlaybackAccessResult> {
    const config = getStorageConfig();
    const expiresIn = expiresInSeconds ?? config.s3.signedUrlExpiresIn;
    try {
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { S3Client } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: config.s3.region,
        credentials: {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey
        }
      });
      const command = new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: storageKey
      });
      const playbackUrl = await getSignedUrl(client, command, { expiresIn });
      return {
        playbackUrl,
        expiresIn,
        contentType,
        contentLength
      };
    } catch (err: any) {
      throw new DeliveryFailedException(err?.message || "S3 signed URL generation failed");
    }
  }

  private async generateFirebaseSignedUrl(
    storageKey: string,
    contentType?: string,
    expiresInSeconds?: number
  ): Promise<PlaybackAccessResult> {
    const config = getStorageConfig();
    const expiresIn = expiresInSeconds ?? 300;
    try {
      const admin = await import("firebase-admin");
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.firebase.projectId,
            clientEmail: config.firebase.clientEmail,
            privateKey: config.firebase.privateKey
          })
        });
      }
      const bucket = admin.storage().bucket(config.firebase.storageBucket);
      const file = bucket.file(storageKey);
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + expiresIn * 1000
      });
      return {
        playbackUrl: signedUrl,
        expiresIn,
        contentType
      };
    } catch (err: any) {
      throw new DeliveryFailedException(err?.message || "Firebase signed URL generation failed");
    }
  }
}
