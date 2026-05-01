import { LRUCache } from 'lru-cache';
import { redis, isRedisHealthy } from './redis';
import { logger } from './logger';
import { withPrefix } from './cache-keys';

/**
 * Cache Utilities for StarPath Astrology
 *
 * Provides caching strategies with Redis as primary and in-memory LRU as fallback.
 * Supports multiple cache patterns: cache-first, stale-while-revalidate, write-through.
 */

/**
 * Default TTL values (in seconds)
 */
export const DEFAULT_TTLS = {
  // Chart calculations: 1 hour
  CHART_CALCULATION: 3600,

  // AI responses: 24 hours
  AI_RESPONSE: 86400,

  // User sessions: 7 days
  USER_SESSION: 604800,

  // Rate limits: 1 minute
  RATE_LIMIT: 60,

  // Feature flags: 5 minutes
  FEATURE_FLAG: 300,

  // General data: 15 minutes
  GENERAL: 900,

  // Static data (plans, features): 1 hour
  STATIC: 3600,

  // Short-lived: 5 minutes
  SHORT: 300,
} as const;

/**
 * In-memory LRU cache as fallback when Redis is unavailable
 */
const memoryCache = new LRUCache<string, { value: unknown; expiresAt: number }>({
  max: 1000, // Maximum number of items
  ttl: 1000 * 60 * 60, // Default TTL: 1 hour in milliseconds
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

/**
 * Check if caching is enabled
 */
const isCacheEnabled = (): boolean => {
  return process.env.CACHE_ENABLED !== 'false';
};

/**
 * Serialize value for storage
 */
const serialize = (value: unknown): string => {
  return JSON.stringify(value);
};

/**
 * Deserialize value from storage
 */
const deserialize = <T>(data: string): T => {
  return JSON.parse(data) as T;
};

/**
 * Get value from cache (Redis or memory fallback)
 */
export async function get<T>(key: string): Promise<T | null> {
  if (!isCacheEnabled()) {
    return null;
  }

  const prefixedKey = withPrefix(key);

  // Try Redis first
  if (redis && isRedisHealthy()) {
    try {
      const data = await redis.get(prefixedKey);
      if (data) {
        logger.debug({ key: prefixedKey }, 'Cache hit (Redis)');
        return deserialize<T>(data);
      }
    } catch (error) {
      logger.error({ error: (error as Error).message, key: prefixedKey }, 'Redis get error');
    }
  }

  // Fallback to memory cache
  const memoryItem = memoryCache.get(prefixedKey);
  if (memoryItem && memoryItem.expiresAt > Date.now()) {
    logger.debug({ key: prefixedKey }, 'Cache hit (memory)');
    return memoryItem.value as T;
  }

  // Remove expired item from memory cache
  if (memoryItem) {
    memoryCache.delete(prefixedKey);
  }

  logger.debug({ key: prefixedKey }, 'Cache miss');
  return null;
}

/**
 * Set value in cache (Redis and memory)
 */
export async function set(
  key: string,
  value: unknown,
  ttl?: number
): Promise<void> {
  if (!isCacheEnabled()) {
    return;
  }

  const prefixedKey = withPrefix(key);
  const ttlSeconds = ttl || DEFAULT_TTLS.GENERAL;
  const serialized = serialize(value);

  // Always store in memory cache as backup
  memoryCache.set(prefixedKey, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // Try to store in Redis
  if (redis && isRedisHealthy()) {
    try {
      await redis.setex(prefixedKey, ttlSeconds, serialized);
      logger.debug({ key: prefixedKey, ttl: ttlSeconds }, 'Cache set (Redis)');
    } catch (error) {
      logger.error({ error: (error as Error).message, key: prefixedKey }, 'Redis set error');
    }
  } else {
    logger.debug({ key: prefixedKey, ttl: ttlSeconds }, 'Cache set (memory only)');
  }
}

/**
 * Delete value from cache
 */
export async function del(key: string): Promise<void> {
  const prefixedKey = withPrefix(key);

  // Remove from memory cache
  memoryCache.delete(prefixedKey);

  // Remove from Redis
  if (redis && isRedisHealthy()) {
    try {
      await redis.del(prefixedKey);
      logger.debug({ key: prefixedKey }, 'Cache deleted (Redis)');
    } catch (error) {
      logger.error({ error: (error as Error).message, key: prefixedKey }, 'Redis del error');
    }
  }
}

/**
 * Get value from cache or compute it using factory function
 * Implements cache-first strategy
 */
export async function getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Compute value
  const value = await factory();

  // Store in cache
  await set(key, value, ttl);

  return value;
}

/**
 * Cache-first strategy: Try cache, fallback to fetch function
 */
export async function cacheFirst<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  return getOrSet(key, fetchFn, ttl);
}

/**
 * Stale-while-revalidate strategy: Return stale data immediately, update in background
 */
export async function staleWhileRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number,
  _staleTtl?: number
): Promise<T> {
  const cached = await get<T>(key);

  if (cached !== null) {
    // Check if we should revalidate in background
    const prefixedKey = withPrefix(key);
    const revalidateKey = `${prefixedKey}:revalidate`;

    // Check if we're already revalidating
    const isRevalidating = redis && isRedisHealthy()
      ? await redis.get(revalidateKey)
      : memoryCache.has(revalidateKey);

    if (!isRevalidating) {
      // Trigger background revalidation
      (async () => {
        try {
          // Set revalidation lock
          if (redis && isRedisHealthy()) {
            await redis.setex(revalidateKey, 30, '1');
          } else {
            memoryCache.set(revalidateKey, { value: '1', expiresAt: Date.now() + 30000 });
          }

          // Fetch new data
          const fresh = await fetchFn();
          await set(key, fresh, ttl);

          logger.debug({ key: prefixedKey }, 'Background revalidation complete');
        } catch (error) {
          logger.error({ error: (error as Error).message, key: prefixedKey }, 'Revalidation error');
        }
      })();
    }

    return cached;
  }

  // No cached data, fetch and cache
  const value = await fetchFn();
  await set(key, value, ttl);
  return value;
}

/**
 * Write-through strategy: Write to cache and execute write operation simultaneously
 */
export async function writeThrough<T>(
  key: string,
  value: T,
  writeFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Execute write operation
  const result = await writeFn();

  // Update cache with new value
  await set(key, value, ttl);

  return result;
}

/**
 * Invalidate all keys matching a pattern
 * Note: This can be expensive on large datasets
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  if (!isCacheEnabled()) {
    return 0;
  }

  const prefixedPattern = withPrefix(pattern);
  let deletedCount = 0;

  // Clear from memory cache (scan all keys)
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefixedPattern) || key.includes(pattern)) {
      memoryCache.delete(key);
      deletedCount++;
    }
  }

  // Clear from Redis using scan and delete
  if (redis && isRedisHealthy()) {
    try {
      const keys: string[] = [];
      let cursor = '0';

      do {
        const result = await redis.scan(cursor, 'MATCH', `${prefixedPattern}*`, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
        logger.info({ pattern: prefixedPattern, count: keys.length }, 'Invalidated cache pattern');
      }
    } catch (error) {
      logger.error({ error: (error as Error).message, pattern: prefixedPattern }, 'Redis pattern invalidation error');
    }
  }

  return deletedCount;
}

/**
 * Clear all cache (use with caution)
 */
export async function clearAll(): Promise<void> {
  // Clear memory cache
  memoryCache.clear();

  // Clear Redis (use FLUSHDB - only clears current DB)
  if (redis && isRedisHealthy()) {
    try {
      await redis.flushdb();
      logger.info('Cache cleared (Redis FLUSHDB)');
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Redis clear error');
    }
  }
}

/**
 * Get cache statistics
 */
export function getStats(): {
  memorySize: number;
  redisConnected: boolean;
  cacheEnabled: boolean;
} {
  return {
    memorySize: memoryCache.size,
    redisConnected: isRedisHealthy(),
    cacheEnabled: isCacheEnabled(),
  };
}

/**
 * Cache decorator for methods
 * Usage:
 *   @cache('user', 3600)
 *   async getUser(id: string) { ... }
 */
export function cache(
  prefix: string,
  ttl?: number
): (
  _target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor
) => PropertyDescriptor {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const key = `${prefix}:${propertyKey}:${JSON.stringify(args)}`;
      return getOrSet(key, () => originalMethod.apply(this, args), ttl);
    };

    return descriptor;
  };
}

const cacheModule = {
  get,
  set,
  delete: del,
  getOrSet,
  cacheFirst,
  staleWhileRevalidate,
  writeThrough,
  invalidatePattern,
  clearAll,
  getStats,
  DEFAULT_TTLS,
};

export default cacheModule;
