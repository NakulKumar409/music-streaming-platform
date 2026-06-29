import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Disable queue if Redis is not configured
const redisEnabled = process.env.REDIS_URL && process.env.REDIS_URL !== "" && process.env.REDIS_URL !== "disabled";

export const uploadQueue = redisEnabled ? new Queue("media-upload", {
  connection: redisUrl.startsWith("redis://")
    ? { url: redisUrl }
    : {
        host: "127.0.0.1",
        port: 6379,
      },
}) : null as any;

