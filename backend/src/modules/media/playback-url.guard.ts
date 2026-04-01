import { DeliveryFailedException } from "../../shared/exceptions/delivery.exception";
import { normalizePublicId } from "../../shared/utils/cloudinary.utils";

export function ensureValidPlaybackUrl(params: {
  playbackUrl: string;
  storageProvider: string;
  providerAssetId: string | null;
}): void {
  const { playbackUrl, storageProvider, providerAssetId } = params;

  let parsed: URL;
  try {
    parsed = new URL(playbackUrl);
  } catch {
    throw new DeliveryFailedException("Generated playback URL is invalid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DeliveryFailedException("Generated playback URL uses unsupported protocol");
  }

  if (storageProvider === "cloudinary") {
    if (!providerAssetId) {
      throw new DeliveryFailedException("Cloudinary provider asset identity missing");
    }
    const normalizedId = normalizePublicId(providerAssetId);
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (!parsed.hostname.endsWith("res.cloudinary.com")) {
      throw new DeliveryFailedException("Cloudinary playback URL host mismatch");
    }
    if (!decodedPath.includes("/video/")) {
      throw new DeliveryFailedException("Cloudinary playback URL resource type mismatch");
    }
    if (!decodedPath.includes(normalizedId)) {
      throw new DeliveryFailedException("Cloudinary playback URL does not match provider asset identity");
    }
  }
}

