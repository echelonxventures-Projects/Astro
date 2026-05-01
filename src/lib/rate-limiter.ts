/**
 * Rate limiting utility for StarPath Astrology
 * Uses rate-limiter-flexible with memory store for development
 * and Redis for production
 */

import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import type { RateLimiterAbstract } from 'rate-limiter-flexible';
import { logger } from './logger';
import {
  RATE_LIMIT_TIERS,
  type RateLimitTier,
  getRateLimitTierForPath,
} from './security';

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Redis configuration (production only)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false,
};

/**
 * Create a rate limiter instance for a specific tier
 * @param tier The rate limit tier
 * @returns Rate limiter instance
 */
function createRateLimiter(tier: RateLimitTier): RateLimiterAbstract {
  const config = RATE_LIMIT_TIERS[tier];

  // In production with Redis available, use Redis store
  if (isProduction && process.env.REDIS_HOST) {
    try {
      return new RateLimiterRedis({
        storeClient: redisConfig,
        keyPrefix: `rate_limit_${tier}`,
        points: config.points,
        duration: config.duration,
      });
    } catch (error) {
      logger.warn(
        { error, tier },
        'Failed to create Redis rate limiter, falling back to memory store'
      );
    }
  }

  // Fallback to memory store
  return new RateLimiterMemory({
    keyPrefix: `rate_limit_${tier}`,
    points: config.points,
    duration: config.duration,
  });
}

// Cache of rate limiter instances
const rateLimiters: Record<RateLimitTier, RateLimiterAbstract> = {
  default: createRateLimiter('default'),
  auth: createRateLimiter('auth'),
  api: createRateLimiter('api'),
  webhook: createRateLimiter('webhook'),
  admin: createRateLimiter('admin'),
  chat: createRateLimiter('chat'),
  chart: createRateLimiter('chart'),
};

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // Seconds until next request allowed
}

/**
 * Check if a request is allowed based on rate limits
 * @param identifier Unique identifier (IP + user ID combination)
 * @param tier Rate limit tier
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'default'
): Promise<RateLimitResult> {
  const limiter = rateLimiters[tier];
  const config = RATE_LIMIT_TIERS[tier];

  try {
    const rateLimitRes = await limiter.consume(identifier);

    // Request allowed
    return {
      allowed: true,
      limit: config.points,
      remaining: rateLimitRes.remainingPoints,
      resetTime: new Date(Date.now() + rateLimitRes.msBeforeNext),
    };
  } catch (rejRes) {
    // Request blocked - rate limit exceeded
    if (rejRes && typeof rejRes === 'object' && 'msBeforeNext' in rejRes) {
      const msBeforeNext = (rejRes as { msBeforeNext: number }).msBeforeNext;
      return {
        allowed: false,
        limit: config.points,
        remaining: 0,
        resetTime: new Date(Date.now() + msBeforeNext),
        retryAfter: Math.ceil(msBeforeNext / 1000),
      };
    }

    // Unknown error, block the request
    logger.error({ error: rejRes, identifier, tier }, 'Rate limiter error');
    return {
      allowed: false,
      limit: config.points,
      remaining: 0,
      resetTime: new Date(Date.now() + 60000),
      retryAfter: 60,
    };
  }
}

/**
 * Check rate limit for a specific path
 * @param identifier Unique identifier
 * @param path Request path
 * @returns Rate limit check result
 */
export async function checkRateLimitForPath(
  identifier: string,
  path: string
): Promise<RateLimitResult> {
  const tier = getRateLimitTierForPath(path);
  return checkRateLimit(identifier, tier);
}

/**
 * Get rate limit headers for response
 * @param result Rate limit result
 * @returns Headers object
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime.getTime() / 1000)),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Penalize a client by consuming extra points
 * Useful for detected abuse or suspicious behavior
 * @param identifier Client identifier
 * @param tier Rate limit tier
 * @param points Number of points to consume
 */
export async function penalizeClient(
  identifier: string,
  tier: RateLimitTier = 'default',
  points: number = 5
): Promise<void> {
  const limiter = rateLimiters[tier];

  try {
    // Consume the specified points
    for (let i = 0; i < points; i++) {
      await limiter.consume(identifier);
    }

    logger.warn(
      { identifier, tier, points },
      'Rate limit penalty applied'
    );
  } catch (error) {
    // Already at limit, which is fine for a penalty
    logger.info(
      { identifier, tier, points },
      'Rate limit penalty applied (client already at limit)'
    );
  }
}

/**
 * Reset rate limit for a specific client
 * @param identifier Client identifier
 * @param tier Rate limit tier (if not provided, resets all tiers)
 */
export async function resetRateLimit(
  identifier: string,
  tier?: RateLimitTier
): Promise<void> {
  if (tier) {
    const limiter = rateLimiters[tier];
    await limiter.delete(identifier);
  } else {
    // Reset all tiers
    await Promise.all(
      Object.values(rateLimiters).map((limiter) =>
        limiter.delete(identifier)
      )
    );
  }

  logger.info({ identifier, tier: tier || 'all' }, 'Rate limit reset');
}

/**
 * Get current rate limit status without consuming points
 * @param identifier Client identifier
 * @param tier Rate limit tier
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(
  identifier: string,
  tier: RateLimitTier = 'default'
): Promise<RateLimitResult> {
  const limiter = rateLimiters[tier];
  const config = RATE_LIMIT_TIERS[tier];

  try {
    const res = await limiter.get(identifier);

    if (!res) {
      // No record exists, full limit available
      return {
        allowed: true,
        limit: config.points,
        remaining: config.points,
        resetTime: new Date(Date.now() + config.duration * 1000),
      };
    }

    return {
      allowed: res.remainingPoints > 0,
      limit: config.points,
      remaining: res.remainingPoints,
      resetTime: new Date(Date.now() + res.msBeforeNext),
    };
  } catch (error) {
    logger.error({ error, identifier, tier }, 'Error getting rate limit status');
    return {
      allowed: false,
      limit: config.points,
      remaining: 0,
      resetTime: new Date(Date.now() + 60000),
    };
  }
}
