import {
  MediaAccessDeniedException,
  MediaInvalidTokenException,
  MediaNotFoundException,
  MediaNotReadyException
} from "../../shared/exceptions/media.exception";
import {
  DeliveryFailedException,
  DeliveryStrategyNotAvailableException
} from "../../shared/exceptions/delivery.exception";

export interface StreamAccessErrorPayload {
  status: number;
  code: string;
  message: string;
}

export function mapStreamAccessError(err: unknown): StreamAccessErrorPayload {
  if (err instanceof MediaNotFoundException) {
    return { status: 404, code: "CONTENT_NOT_FOUND", message: "Content not found" };
  }
  if (err instanceof MediaNotReadyException) {
    return { status: 409, code: "CONTENT_NOT_READY", message: err.message };
  }
  if (err instanceof MediaAccessDeniedException) {
    return { status: 403, code: "ACCESS_DENIED", message: err.message };
  }
  if (err instanceof MediaInvalidTokenException) {
    return { status: 401, code: "INVALID_TOKEN", message: err.message };
  }
  if (err instanceof DeliveryStrategyNotAvailableException) {
    return {
      status: 503,
      code: "DELIVERY_PROVIDER_UNAVAILABLE",
      message: "Playback provider is unavailable for this media"
    };
  }
  if (err instanceof DeliveryFailedException) {
    return {
      status: 502,
      code: "PLAYBACK_URL_GENERATION_FAILED",
      message: err.message || "Failed to generate playback URL"
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Failed to get playback access"
  };
}

