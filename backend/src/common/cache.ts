import { redis } from "./redis";

export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (data) {
      console.log("[CACHE HIT]", key);
      return JSON.parse(data) as T;
    }
    console.log("[CACHE MISS]", key);
    return null;
  } catch (err: any) {
    console.warn("[CACHE ERROR GET]", key, err.message);
    return null;
  }
}

export async function setCache(key: string, value: any, ttl: number = 120): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
    console.log("[CACHE SET]", key);
  } catch (err: any) {
    console.warn("[CACHE ERROR SET]", key, err.message);
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
    console.log("[CACHE DELETE]", key);
  } catch (err: any) {
    console.warn("[CACHE ERROR DELETE]", key, err.message);
  }
}

/**
 * Fetch data with Redis caching wrapper utilizing getCache and setCache.
 * Logs CACHE HIT / CACHE MISS / CACHE SET for easy debugging.
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 120
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached) return cached;

  const data = await fetcher();

  if (data !== undefined && data !== null) {
    await setCache(key, data, ttlSeconds);
  }

  return data;
}

export const invalidateCache = deleteCache; // Alias for backward compatibility if needed

/**
 * Invalidate all cache keys matching a specific pattern.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[CACHE INVALIDATED] pattern ${pattern} matched ${keys.length} keys`);
    }
  } catch (err: any) {
    console.warn(`[Redis] pattern DEL error for ${pattern}`, err.message);
  }
}
