import rateLimit from "express-rate-limit";

const getClientIp = (req: any) => {
  const forwarded = (req.headers["x-forwarded-for"] as string | undefined) || "";
  const ip = forwarded.split(",")[0]?.trim();
  return (
    ip ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown"
  );
};

const isLocalOrPrivateIp = (ip: string) => {
  const normalized = (ip || "").replace("::ffff:", "").trim();
  if (!normalized) return false;

  if (normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost") {
    return true;
  }

  // RFC1918 private ranges
  if (normalized.startsWith("10.")) return true;
  if (normalized.startsWith("192.168.")) return true;

  const parts = normalized.split(".");
  if (parts.length === 4) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    if (first === 172 && second >= 16 && second <= 31) return true;
  }

  return false;
};

const maroonRateLimitHandler = (req: any, res: any) => {
  const ip = getClientIp(req);
  console.warn(`[SECURITY_ALERT] Rate limit exceeded by IP: ${ip}`);

  const correlationId = req?.correlationId || "-";

  return res.status(429).json({
    success: false,
    message: "Too many requests, please try again later.",
    theme: {
      primary: "#4b1927"
    },
    correlationId
  });
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => getClientIp(req),
  // In local development, React (StrictMode), hot reload, and API-driven UIs can
  // generate bursts of requests. Skip global limiting for local/private IPs to
  // avoid noisy 429s during development.
  skip: (req: any) => {
    const ip = getClientIp(req);
    return process.env.NODE_ENV !== "production" && isLocalOrPrivateIp(ip);
  },
  handler: maroonRateLimitHandler
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const ip = getClientIp(req);
    // Never collapse all users into a shared "unknown" bucket.
    if (ip && ip !== "unknown") return ip;
    return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
  },
  // In local development, Expo/React Native frequently triggers repeated requests,
  // and IP detection can be inconsistent. Skip auth limiting locally to avoid
  // blocking valid logins during development.
  skip: (req: any) => {
    const ip = getClientIp(req);
    return process.env.NODE_ENV !== "production" && isLocalOrPrivateIp(ip);
  },
  handler: maroonRateLimitHandler
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => getClientIp(req),
  handler: maroonRateLimitHandler
});
