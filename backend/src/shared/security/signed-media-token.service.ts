/**
 * Short-lived signed media tokens. Section 20.
 * JWT with mediaId, userId, exp, purpose. Tamper-proof, secret from env.
 */

import jwt from "jsonwebtoken";
import { getMediaConfig } from "../../config/media.config";
import { MediaInvalidTokenException } from "../exceptions/media.exception";

const PURPOSE_PLAYBACK = "playback";

export interface SignedMediaTokenPayload {
  mediaId: number;
  userId: number;
  purpose: string;
  exp: number;
  iat: number;
}

export function createPlaybackToken(mediaId: number, userId: number, expiresInSeconds: number): string {
  const config = getMediaConfig();
  return jwt.sign(
    {
      mediaId,
      userId,
      purpose: PURPOSE_PLAYBACK
    },
    config.mediaSignedTokenSecret,
    { expiresIn: expiresInSeconds }
  );
}

export function verifyPlaybackToken(token: string): SignedMediaTokenPayload {
  const config = getMediaConfig();
  try {
    const decoded = jwt.verify(token, config.mediaSignedTokenSecret) as any;
    const mediaId = Number(decoded?.mediaId);
    const userId = Number(decoded?.userId);
    const hasUserId = decoded != null && Object.prototype.hasOwnProperty.call(decoded, "userId");
    if (
      decoded?.purpose !== PURPOSE_PLAYBACK ||
      !Number.isFinite(mediaId) ||
      mediaId <= 0 ||
      !hasUserId ||
      !Number.isFinite(userId) ||
      userId < 0
    ) {
      throw new MediaInvalidTokenException("Invalid token payload");
    }
    return {
      mediaId,
      userId,
      purpose: decoded.purpose,
      exp: decoded.exp,
      iat: decoded.iat
    };
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      throw new MediaInvalidTokenException("Playback token expired");
    }
    throw new MediaInvalidTokenException(err?.message || "Invalid token");
  }
}
