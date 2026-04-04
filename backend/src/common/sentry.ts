import * as Sentry from "@sentry/node";

/**
 * Initializes Sentry error tracking.
 *
 * Activation: Set the SENTRY_DSN environment variable.
 * If SENTRY_DSN is absent, this is a no-op — zero impact on the app.
 *
 * Usage after init:
 *   import { captureError } from "./sentry";
 *   captureError(err, { extra: { route: "/artists" } });
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("[Sentry] SENTRY_DSN not set — Sentry disabled.");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    // Only sample 100% in dev; reduce in production to control quota
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    // Redact sensitive headers from breadcrumbs
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  console.log(`[Sentry] Initialized (env=${process.env.NODE_ENV || "development"})`);
}

/**
 * Capture an error explicitly — safe to call even if Sentry is disabled.
 */
export function captureError(
  err: unknown,
  context?: Record<string, unknown>
): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(err);
  });
}
