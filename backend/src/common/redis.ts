import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: 1000,
  retryStrategy(times) {
    // Keep trying to reconnect globally so cache comes back online when Redis does
    return Math.min(times * 500, 5000);
  }
});

redis.on("connect", () => {
  console.log("[Redis] connected");
});

// Avoid crashing the app if redis reconnects fail
redis.on("error", (err) => {
  console.warn("[Redis] connection error, falling back to DB:", err.message);
});

// Explicit opt-in connect
redis.connect().catch((err) => {
  console.warn("[Redis] initial connect failed, cache bypassed");
});
