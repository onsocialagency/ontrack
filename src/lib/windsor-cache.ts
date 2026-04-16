/**
 * Windsor API — In-memory TTL cache (server-side only)
 *
 * Each fetch type (creatives, keywords, search terms, RSA assets, TikTok)
 * is cached independently with a 1-hour TTL.
 *
 * Lives in the Node.js process memory. On Vercel this is per-Lambda.
 * For development this is perfectly fine — prevents hammering Windsor
 * on every page reload.
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/** Build a deterministic cache key from fetch parameters. */
export function buildCacheKey(
  type: string,
  apiKey: string,
  days: number,
  dateFrom?: string,
  dateTo?: string,
): string {
  // Hash the API key so we don't store it in plain text
  const keyHash = apiKey.slice(-6);
  const dateStr = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : `last${days}d`;
  return `windsor:${type}:${keyHash}:${dateStr}`;
}

/** Get a cached value if it exists and hasn't expired. */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/** Store a value in the cache with an optional TTL. */
export function setCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Clear cache entries. If keyPrefix is given, only clear matching keys. */
export function clearCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) {
      cache.delete(key);
    }
  }
}
