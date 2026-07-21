import dotenv from "dotenv";

dotenv.config();

import { pool } from "./common/db"; // Trigger restart for .env



import express from "express";

import morgan from "morgan";

import jwt from "jsonwebtoken";

import { v4 as uuidv4 } from "uuid";

import path from "path";

import compression from "compression";

import { globalLimiter } from "./common/security/rateLimit";

import { validateEnv } from "./config/env.validation";

import {

  ensureUsersSchema,

  ensureContentSchema,

  ensurePlaysSchema,

  ensureReactionsSchema,

  ensureSessionsSchema,

  ensureSubscriptionsSchema,

  ensureArtistStatsSchema,

  ensureUpsellSchema,

  ensureUserStatsSchema,

  ensurePlatformConfigSchema,

  ensureAuditLogsSchema,

  ensureFeaturedArtistsSchema

} from "./config/ensure-schema";

import fanRoutes from "./routes/fan";

import artistRoutes from "./routes/artist";

import adminRoutes from "./routes/admin";

import authRoutes from "./routes/auth";

import contentRoutes from "./routes/content";

import searchRoutes from "./routes/search";

import mediaRoutes from "./routes/media";

import { razorpayWebhook } from "./controllers/paymentController";

import mediaStreamRoutes from "./modules/media/media-stream.routes";

import { createStorageProvider } from "./shared/storage/factory/storage-provider.factory";

import { getDeliveryStrategyForProvider } from "./shared/delivery/services/media-delivery.service";

import { MediaProviderFactory } from "./services/providers/MediaProviderFactory";

import { redis, connectRedisWithRetry } from "./common/redis";

import { initSentry, captureError } from "./common/sentry";

import { logger, httpLogger } from "./common/logger";

import "./workers/upload.worker";

import { NotificationService } from "./shared/notifications/notification.service";

import { WinBackService } from "./shared/subscriptions/win-back.service";



// Initialise Sentry as early as possible (no-op if SENTRY_DSN is unset)

initSentry();







const app = express();

app.set("trust proxy", 1);



process.on("uncaughtException", (err) => {

  console.error("Uncaught Exception:", err);

  process.exit(1);

});



process.on("unhandledRejection", (err) => {

  console.error("Unhandled Rejection:", err);

});



app.get("/health", async (req, res) => {

  const startMs = Date.now();

  const checks: Record<string, any> = { db: "unknown", redis: "unknown" };



  // DB check

  try {

    await pool.query("SELECT 1");

    checks.db = "ok";

  } catch (err: any) {

    checks.db = { status: "error", message: err?.message };

  }



  // Redis check

  try {

    const pong = await redis.ping();

    checks.redis = pong === "PONG" ? "ok" : "degraded";

  } catch (err: any) {

    checks.redis = { status: "error", message: err?.message };

  }



  const allOk = checks.db === "ok" && checks.redis === "ok";

  const httpStatus = allOk ? 200 : 503;



  return res.status(httpStatus).json({

    status: allOk ? "ok" : "degraded",

    pid: process.pid,

    uptime: Math.floor(process.uptime()),

    responseTimeMs: Date.now() - startMs,

    checks,

  });

});



app.get("/health/db", async (req, res) => {

  try {

    const result = await pool.query("SELECT current_database(), current_schema() FROM (SELECT 1) AS dummy");

    const countAll = await pool.query("SELECT COUNT(*) FROM public.users");

    res.json({ 

      status: "ok",

      database: result.rows[0]?.current_database,

      schema: result.rows[0]?.current_schema,

      totalUsers: Number(countAll.rows[0].count)

    });

  } catch (err: any) {

    res.status(503).json({ status: "error", message: err?.message });

  }

});



app.get("/health/redis", async (req, res) => {

  try {

    const pong = await redis.ping();

    if (pong !== "PONG") throw new Error(`Unexpected PING response: ${pong}`);

    const dbSize = await redis.dbsize();

    res.json({ status: "ok", pong, keyCount: dbSize });

  } catch (err: any) {

    res.status(503).json({ status: "error", message: err?.message });

  }

});

if (process.env.NODE_ENV !== "production") {

  app.set("etag", false);

}



app.use((req, res, next) => {

  res.header("Access-Control-Allow-Origin", "*");

  res.header(

    "Access-Control-Allow-Headers",

    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Auth-Token, Cache-Control, Pragma, Expires"

  );

  res.header(

    "Access-Control-Allow-Methods",

    "GET, POST, PUT, PATCH, DELETE, OPTIONS"

  );

  if (req.method === "OPTIONS") return res.sendStatus(204);

  next();

});



app.post(

  "/api/v1/payments/webhook",

  express.raw({ type: "application/json" }),

  (req, res) => razorpayWebhook(req as any, res)

);



app.use(compression());

app.use(express.json());



app.use(globalLimiter);



app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));



app.use("/media/stream", mediaStreamRoutes);



app.use(httpLogger);



const formatTimestamp = () => {

  const d = new Date();

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(

    d.getHours()

  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

};



const sanitizeBody = (body: any) => {

  const SENSITIVE_KEYS = new Set([

    "password",

    "pass",

    "token",

    "accessToken",

    "refreshToken"

  ]);



  const walk = (value: any): any => {

    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) return value.map(walk);

    if (typeof value !== "object") return value;



    const out: any = {};

    for (const [k, v] of Object.entries(value)) {

      if (SENSITIVE_KEYS.has(k)) {

        out[k] = "[REDACTED]";

      } else {

        out[k] = walk(v);

      }

    }

    return out;

  };



  return walk(body);

};



// Custom correlation ID middleware

app.use((req: any, res, next) => {

  const incomingCorrelationId =

    (req.headers["x-correlation-id"] as string | undefined) ||

    (req.headers["x-request-id"] as string | undefined);



  const correlationId = incomingCorrelationId || uuidv4();

  req.correlationId = correlationId;

  res.setHeader("X-Correlation-Id", correlationId);

  next();

});



// Stub removed — comprehensive /health is registered above before middleware



app.use("/api/v1/fan", fanRoutes);

app.use("/api/v1/artist", artistRoutes);

app.use("/api/v1/admin", adminRoutes);

app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/content", contentRoutes);

app.use("/api/v1/search", searchRoutes);

app.use("/api/v1/media", mediaRoutes);



app.use((req: any, res: any, next: any) => {

  const err: any = new Error(`Route not found: ${req.method} ${req.originalUrl || req.url}`);

  err.status = 404;

  next(err);

});



app.use((err: any, req: any, res: any, next: any) => {

  const correlationId = req?.correlationId || "-";

  const timestamp = formatTimestamp();

  const message = err?.message || String(err);

  const stack = err?.stack || err;

  const status = Number(err?.status || err?.statusCode || 500);



  // Structured JSON error log for log aggregators

  logger.error({

    correlationId,

    method: req?.method,

    url: req?.originalUrl || req?.url,

    statusCode: status,

    message,

    stack: process.env.NODE_ENV !== "production" ? stack : undefined,

  }, `[ERROR] ${message}`);



  // Forward to Sentry (no-op when SENTRY_DSN is not set)

  captureError(err, {

    correlationId,

    method: req?.method,

    url: req?.originalUrl || req?.url,

    statusCode: status,

  });



  if (res.headersSent) return next(err);



  return res.status(status).json({

    success: false,

    message: err?.message || "Internal Server Error",

    correlationId

  });

});



const PORT = process.env.PORT || 8000;



(async () => {

  console.log(`[Startup] ── Booting worker (pid=${process.pid} port=${PORT}) ──`);



  validateEnv();

  createStorageProvider();

  const storageConfig = validateEnv();

  getDeliveryStrategyForProvider(storageConfig.storageProvider);



  // Initialize and fail-fast for the new configurable media provider

  MediaProviderFactory.initialize();



  // ── Wait for Redis before opening traffic ──────────────────────────────

  // Retries up to 10 times with backoff. Never crashes — falls back to DB.

  // await connectRedisWithRetry(10); // Disabled Redis - not running on this system



  // ── Start HTTP server ──────────────────────────────────────────────────

  app.listen(PORT, () => {

    logger.info(`[Startup] Server running on port ${PORT}`);

    logger.info(`[Startup] STORAGE_PROVIDER=${storageConfig.storageProvider}`);



    try {

      const routes: string[] = [];

      const stack = (app as any)?._router?.stack || [];

      for (const layer of stack) {

        if (layer?.route?.path && layer?.route?.methods) {

          const methods = Object.keys(layer.route.methods)

            .filter((m) => layer.route.methods[m])

            .map((m) => m.toUpperCase());

          routes.push(`${methods.join(",")} ${layer.route.path}`);

        } else if (layer?.name === "router" && layer?.handle?.stack) {

          const mountPath = layer?.regexp?.toString?.() || "";

          for (const handler of layer.handle.stack) {

            if (!handler?.route) continue;

            const methods = Object.keys(handler.route.methods)

              .filter((m) => handler.route.methods[m])

              .map((m) => m.toUpperCase());

            routes.push(`${methods.join(",")} ${mountPath} ${handler.route.path}`);

          }

        }

      }

      console.log("Registered routes:");

      for (const r of routes) console.log(r);

    } catch (e) {

      console.warn("Failed to list routes", e);

    }

  });



  // Run schema migrations after server is up (non-fatal on transient DB issues)

  try {

    await ensureUsersSchema();

    await ensureContentSchema();

    await ensurePlaysSchema();

    await ensureReactionsSchema();

    await ensureSessionsSchema();

    await ensureSubscriptionsSchema();

    await ensureArtistStatsSchema();

    await ensureUpsellSchema();

    await ensureUserStatsSchema();

    await ensurePlatformConfigSchema();

    await ensureAuditLogsSchema();

    await ensureFeaturedArtistsSchema();

    console.log("[Startup] All database schemas ensured or updated ✅");



    // ── Subscription Lifecycle Management ────────────────────────────────

    // Sweeps for subscriptions where grace_ends_at < now() and updates to EXPIRED.

    // Runs every 6 hours.

    const sweepExpiredSubscriptions = async () => {

      console.log("[Sweeper] Running subscription expiry sweep...");

      try {

        const result = await pool.query(`

          UPDATE subscriptions

          SET status = 'EXPIRED', updated_at = now()

          WHERE status IN ('ACTIVE', 'GRACE', 'PAST_DUE')

            AND next_billing_date < now()

          RETURNING id, user_id, type, artist_id

        `);

        if (result.rowCount && result.rowCount > 0) {

          console.log(`[Sweeper] Expired ${result.rowCount} stale subscriptions.`);

          

          // Trigger Win-back offers for newly expired subs

          for (const row of result.rows) {

            WinBackService.processChurnedUser(

              row.id, 

              row.user_id, 

              row.type, 

              row.artist_id

            ).catch(e => console.error("[WinBack] Failed to trigger offer:", e));

          }

        }

      } catch (err) {

        console.error("[Sweeper] Failed to sweep subscriptions:", err);

      }

    };



    const notifyExpiringSubscriptions = async () => {

      console.log("[Notifier] Checking for expiring subscriptions...");

      try {

        // Find subscriptions expiring in precisely 48 hours (+/- 1 hour margin to avoid double notify if run slightly off)

        // Or simpler: Find subs expiring in < 48 hours that haven't been notified yet.

        // For simplicity here, we'll find subs arriving at exactly the 48h mark.

        const result = await pool.query(`

          SELECT s.user_id, s.type, s.artist_id, u.name as artist_name

          FROM subscriptions s

          LEFT JOIN users u ON u.id = s.artist_id

          WHERE s.status = 'ACTIVE'

            AND s.next_billing_date > now()

            AND s.next_billing_date <= now() + interval '48 hours'

            AND s.next_billing_date > now() + interval '47 hours'

        `);



        for (const row of result.rows) {

          NotificationService.sendToUser({

            userId: String(row.user_id),

            title: "Subscription Expiring Soon! ⏳",

            body: `Your subscription to ${row.type === 'PLATFORM' ? 'the Platform' : row.artist_name || 'your artist'} will expire in 2 days. Renew now to stay premium!`,

            data: { type: "expiry_warning", artistId: row.artist_id }

          }).catch(e => logger.error(e, "[Notifier] Expiry warning failed"));

        }

      } catch (err) {

        console.error("[Notifier] Failed to send expiry notifications:", err);

      }

    };



    const sweepStaleSessions = async () => {

      console.log("[Sweeper] Running stale session cleanup...");

      try {

        const result = await pool.query(`

          DELETE FROM user_sessions

          WHERE last_active_at < now() - interval '30 days'

        `);

        if (result.rowCount && result.rowCount > 0) {

          console.log(`[Sweeper] Removed ${result.rowCount} stale user sessions.`);

        }

      } catch (err) {

        console.error("[Sweeper] Failed to sweep sessions:", err);

      }

    };



    // Run immediately on boot then every 6 hours

    sweepExpiredSubscriptions();

    setInterval(sweepExpiredSubscriptions, 6 * 60 * 60 * 1000);



    // Run expiry notifications every hour (since it checks for a narrow window)

    notifyExpiringSubscriptions();

    setInterval(notifyExpiringSubscriptions, 60 * 60 * 1000);



    // Run session cleanup every 24 hours

    sweepStaleSessions();

    setInterval(sweepStaleSessions, 24 * 60 * 60 * 1000);



  } catch (err) {

    console.error("[Startup] WARNING: DB schema migration failed — check DATABASE_URL:", (err as any)?.message ?? err);

    console.error("[Startup] The server is still running but some features may not work until the DB is reachable.");

  }

})().catch((err) => {

  console.error("[Startup] Fatal:", err);

  process.exit(1);

});

