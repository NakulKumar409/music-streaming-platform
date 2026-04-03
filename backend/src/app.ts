import dotenv from "dotenv";
dotenv.config();
import "./common/db";

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
  ensureSubscriptionsSchema,
  ensureArtistStatsSchema
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
import "./workers/upload.worker";



const app = express();
app.set("trust proxy", 1);

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    pid: process.pid,
    port: process.env.PORT || 8000,
    workerId: process.env.NODE_APP_INSTANCE ?? "N/A",
  });
});

app.get("/health/redis", async (req, res) => {
  try {
    await redis.ping();
    res.json({ status: "redis ok" });
  } catch {
    res.status(500).json({ status: "redis down" });
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

app.use(
  morgan("dev", {
    stream: {
      write: (message: string) => {
        process.stdout.write(
          `--------------------------------------------------\n${message.trimEnd()}\n`
        );
      }
    }
  })
);

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

app.use((req: any, res, next) => {
  const incomingCorrelationId =
    (req.headers["x-correlation-id"] as string | undefined) ||
    (req.headers["x-request-id"] as string | undefined);

  const correlationId = incomingCorrelationId || uuidv4();
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);

  const startNs = process.hrtime.bigint();

  res.on("finish", () => {
    const endNs = process.hrtime.bigint();
    const responseTimeMs = Number(endNs - startNs) / 1_000_000;
    const contentLength =
      (res.getHeader("content-length") as string | number | undefined) ?? "-";

    const payload =
      req.body && Object.keys(req.body).length ? sanitizeBody(req.body) : null;

    let tokenUser: any = req.user ?? null;
    if (!tokenUser) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          tokenUser = jwt.verify(token, process.env.JWT_SECRET as string);
        } catch {
          tokenUser = null;
        }
      }
    }

    const userId = tokenUser?.id ?? tokenUser?.userId ?? null;
    const role = tokenUser?.role ?? null;

    const details = {
      timestamp: formatTimestamp(),
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTimeMs: Number(responseTimeMs.toFixed(2)),
      contentLength,
      user: userId || role ? { userId, role } : null,
      payload
    };

    const roleLabel = role ?? "-";
    console.log(
      `--------------------------------------------------\n[REQUEST] ${details.timestamp} ${details.method} ${details.url} role=${roleLabel} ${details.responseTimeMs}ms\n${JSON.stringify(
        details,
        null,
        2
      )}`
    );
  });

  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

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

  console.error(
    `--------------------------------------------------\n[ERROR] ${timestamp} correlationId=${correlationId}\n${message}\n${stack}`
  );

  if (res.headersSent) return next(err);

  const status = Number(err?.status || err?.statusCode || 500);
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
  await connectRedisWithRetry(10);

  // ── Start HTTP server ──────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log("--- Logger Initialized Successfully ---");
    console.log(`[Startup] Server running on port ${PORT}`);
    console.log(`[Startup] STORAGE_PROVIDER=${storageConfig.storageProvider}`);

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
    await ensureSubscriptionsSchema();
    await ensureArtistStatsSchema();
    console.log("[Startup] Database schema ensured ✅");
  } catch (err) {
    console.error("[Startup] WARNING: DB schema migration failed — check DATABASE_URL:", (err as any)?.message ?? err);
    console.error("[Startup] The server is still running but some features may not work until the DB is reachable.");
  }
})().catch((err) => {
  console.error("[Startup] Fatal:", err);
  process.exit(1);
});
