import Redis from "ioredis";

import dotenv from "dotenv";



dotenv.config();



const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";



// Disable Redis completely if REDIS_URL is not set or is disabled
const redisEnabled = process.env.REDIS_URL && process.env.REDIS_URL !== "" && process.env.REDIS_URL !== "disabled";

export const redis = redisEnabled ? new Redis(redisUrl, {

  // lazyConnect: true means we control when the first connection attempt happens.

  // The module-level import will NOT attempt a connection on its own.

  lazyConnect: true,

  enableOfflineQueue: false,

  maxRetriesPerRequest: 0,          // Don't retry individual commands — fail fast for cache

  commandTimeout: 2000,

  connectTimeout: 5000,

  retryStrategy(times) {

    // ioredis auto-reconnect: exponential backoff capped at 10s

    const delay = Math.min(times * 500, 10_000);

    // console.log(`[Redis] reconnect attempt #${times} in ${delay}ms`);

    return delay;

  },

}) : null as any;



// ── Event listeners must be attached BEFORE connect() is called ──

if (redis) {

  redis.on("connect", () => {

    // console.log("[Redis] ✅ connected");

  });



  redis.on("ready", () => {

    // console.log("[Redis] ✅ ready — cache operational");

  });



  redis.on("reconnecting", (delay: number) => {

    // console.warn(`[Redis] ⚠️ reconnecting in ${delay}ms...`);

  });



  // Absorb all errors — never let an unhandled Redis error bubble to uncaughtException

  redis.on("error", (err) => {

    // console.warn("[Redis] ⚠️ error (cache bypassed, falling back to DB):", err.message);

  });



  redis.on("close", () => {

    // console.warn("[Redis] connection closed");

  });

}



/**

 * Attempt to connect to Redis with bounded exponential backoff.

 * Resolves regardless — failure is non-fatal (app falls back to DB for uncached routes).

 *

 * @param maxAttempts Max connection attempts before giving up and running without cache

 */

export async function connectRedisWithRetry(maxAttempts = 10): Promise<void> {

  // If Redis is disabled, skip connection attempts entirely

  if (!redis) {

    return;

  }

  const workerLabel = `[Redis][worker-${process.env.NODE_APP_INSTANCE ?? "?"}]`;



  for (let attempt = 1; attempt <= maxAttempts; attempt++) {

    try {

      // redis.status is "wait" on first call, "close" after a disconnect

      if (redis.status === "ready") {

        // console.log(`${workerLabel} already connected — skipping connect()`);

        return;

      }



      await redis.connect();

      await redis.ping();                                   // Verify the connection is actually live

      // console.log(`${workerLabel} ✅ connected on attempt ${attempt}`);

      return;



    } catch (err: any) {

      const isLastAttempt = attempt === maxAttempts;

      const delay = Math.min(attempt * 500, 5_000);        // 500ms → 5s, capped



      if (isLastAttempt) {

        // console.warn(

        //   `${workerLabel} ⚠️ could not connect after ${maxAttempts} attempts. ` +

        //   `Server will start WITHOUT Redis cache — DB fallback active.`

        // );

        return;                                            // Non-fatal — never throw

      }



      // console.warn(

        // `${workerLabel} ⚠️ connect attempt ${attempt}/${maxAttempts} failed ` +

        // `(${err.message}). Retrying in ${delay}ms...`
        // );

      await new Promise((resolve) => setTimeout(resolve, delay));

    }

  }

}

