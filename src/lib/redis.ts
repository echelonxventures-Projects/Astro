import Redis, { type RedisOptions } from 'ioredis'
import { logger } from './logger'

/**
 * Redis Client Configuration for StarPath Astrology
 *
 * Provides connection handling for different environments with
 * fallback to in-memory LRU cache when Redis is unavailable.
 */

/**
 * Get Redis configuration based on environment variables
 */
const getRedisConfig = (): RedisOptions => {
  // If REDIS_URL is provided, use it (preferred for production/Docker)
  if (process.env.REDIS_URL) {
    return {
      retryStrategy: (times: number): number => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Distinguish auth failures (misconfiguration) from transient outages
      enableOfflineQueue: true,
    }
  }

  // Use individual connection parameters
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times: number): number => {
      const delay = Math.min(times * 50, 2000)
      return delay
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  }
}

/**
 * Check if caching is enabled
 */
const isCacheEnabled = (): boolean => {
  return process.env.CACHE_ENABLED !== 'false'
}

/**
 * Redis client instance
 * Exported for direct access when needed
 */
export let redis: Redis | null = null

/**
 * Track Redis connection state
 */
let isRedisConnected = false
let redisConnectionError: Error | null = null

/**
 * Initialize Redis connection
 */
const initRedis = async (): Promise<void> => {
  if (!isCacheEnabled()) {
    logger.info('Cache is disabled via CACHE_ENABLED env var')
    return
  }

  try {
    const config = getRedisConfig()

    // Create Redis instance
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL, config)
    } else {
      redis = new Redis(config)
    }

    // Event handlers
    redis.on('connect', () => {
      isRedisConnected = true
      redisConnectionError = null
      logger.info('Redis connected successfully')
    })

    redis.on('ready', () => {
      logger.info('Redis is ready to accept commands')
    })

    redis.on('error', err => {
      isRedisConnected = false
      redisConnectionError = err
      if (err.message.includes('NOAUTH') || err.message.includes('invalid password')) {
        logger.error(
          { error: err.message },
          'Redis authentication failed - check REDIS_URL credentials (redis://:PASSWORD@host:port)'
        )
      } else {
        logger.error({ error: err.message }, 'Redis error')
      }
    })

    redis.on('close', () => {
      isRedisConnected = false
      logger.warn('Redis connection closed')
    })

    redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...')
    })

    // Test connection
    await redis.ping()
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Failed to initialize Redis')
    isRedisConnected = false
    redisConnectionError = error as Error
    redis = null
  }
}

/**
 * Check if Redis is connected and healthy
 */
export const isRedisHealthy = (): boolean => {
  return isRedisConnected && redis !== null
}

/**
 * Get last Redis connection error
 */
export const getRedisError = (): Error | null => {
  return redisConnectionError
}

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (): Promise<void> => {
  if (redis) {
    logger.info('Closing Redis connection...')
    try {
      await redis.quit()
      logger.info('Redis connection closed gracefully')
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Error closing Redis connection')
    }
  }
}

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Initialize on module load (but don't block)
initRedis().catch(error => {
  logger.error({ error: (error as Error).message }, 'Redis initialization failed')
})

export default redis
