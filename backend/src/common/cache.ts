import { redis } from "./redis";

export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data) as T;
    }
    return null;
  } catch (err: any) {
    return null;
  }
}

export async function setCache(key: string, value: any, ttl: number = 120): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err: any) {
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err: any) {
  }
}

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

export const invalidateCache = deleteCache;

/**
 * Invalidate all cache keys matching a specific pattern using non-blocking SCAN.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    let cursor = "0";
    let deletedCount = 0;
    
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      
      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    if (deletedCount > 0) {
      console.log(`[CACHE INVALIDATED] pattern ${pattern} matched ${deletedCount} keys`);
    }
  } catch (err: any) {
    console.warn(`[Redis] pattern DEL error for ${pattern}`, err.message);
  }
}

/**
 * Invalidate artist-related caches.
 */
export async function invalidateArtistCache(): Promise<void> {
  await Promise.all([
    invalidateCachePattern("artist_search:*"),
    invalidateCachePattern("featured_artists:*"),
    invalidateCachePattern("home_content_feed_rows*"),
  ]);
}

/**
 * Invalidate content-related caches.
 */
export async function invalidateContentCache(): Promise<void> {
  await invalidateCachePattern("home_content_feed_rows*");
}
