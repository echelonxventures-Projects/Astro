/**
 * Cache Key Patterns for StarPath Astrology
 *
 * Centralized cache key generation to ensure consistency
 * and prevent key collisions across the application.
 */

export const cacheKeys = {
  /**
   * Birth Charts
   */
  // Individual chart by user and chart ID
  chart: (userId: string, chartId: string) => `chart:${userId}:${chartId}`,

  // All charts for a user
  userCharts: (userId: string) => `charts:${userId}`,

  // Chart calculation result (by birth data hash)
  chartCalculation: (hash: string) => `calc:${hash}`,

  /**
   * AI Responses
   */
  // AI-generated response by type and input hash
  aiResponse: (type: string, hash: string) => `ai:${type}:${hash}`,

  // AI chat conversation history
  chatHistory: (sessionId: string) => `chat:${sessionId}`,

  // Generated horoscope readings
  horoscope: (userId: string, type: string, date: string) =>
    `horoscope:${userId}:${type}:${date}`,

  /**
   * User Data
   */
  // User session data
  userSession: (sessionId: string) => `session:${sessionId}`,

  // User profile
  userProfile: (userId: string) => `profile:${userId}`,

  // User preferences
  userPreferences: (userId: string) => `prefs:${userId}`,

  // User subscription
  userSubscription: (userId: string) => `sub:${userId}`,

  /**
   * Plans and Features
   */
  // All subscription plans
  subscriptionPlans: () => 'plans:all',

  // Features for a specific plan
  planFeatures: (planId: string) => `plan:${planId}:features`,

  // Plan pricing
  planPricing: (planId: string) => `plan:${planId}:pricing`,

  /**
   * Rate Limiting
   */
  // Rate limit counter
  rateLimit: (key: string) => `ratelimit:${key}`,

  // Rate limit window
  rateLimitWindow: (key: string) => `ratelimit:${key}:window`,

  /**
   * Astrology Data
   */
  // Ephemeris data for a specific date
  ephemeris: (date: string) => `eph:${date}`,

  // Planetary positions
  planetaryPositions: (date: string) => `planets:${date}`,

  // Transit data
  transits: (date: string) => `transits:${date}`,

  /**
   * General
   */
  // Health check status
  health: () => 'health:status',

  // Application configuration
  config: (key: string) => `config:${key}`,

  // Feature flags
  featureFlag: (flag: string) => `feature:${flag}`,

  // System stats
  stats: (metric: string) => `stats:${metric}`,

  /**
   * Compatibility Readings
   */
  // Synastry reading between two users
  compatibility: (userId1: string, userId2: string) =>
    `compat:${[userId1, userId2].sort().join(':')}`,

  // Composite chart
  compositeChart: (hash: string) => `composite:${hash}`,

  /**
   * Palmistry and Face Reading
   */
  // Image analysis results
  imageAnalysis: (imageHash: string) => `img:${imageHash}`,

  // Reading history
  readingHistory: (userId: string, type: string) => `readings:${userId}:${type}`,
} as const;

/**
 * Cache key prefix for namespacing in multi-tenant or shared Redis instances
 */
export const CACHE_KEY_PREFIX = process.env.CACHE_KEY_PREFIX || 'starpath:';

/**
 * Add prefix to a cache key
 */
export const withPrefix = (key: string): string => `${CACHE_KEY_PREFIX}${key}`;

/**
 * Remove prefix from a cache key (for debugging/logging)
 */
export const withoutPrefix = (key: string): string =>
  key.startsWith(CACHE_KEY_PREFIX) ? key.slice(CACHE_KEY_PREFIX.length) : key;

/**
 * Generate a hash from input data for cache keys
 * Useful for creating deterministic keys from complex objects
 */
export const generateInputHash = (input: Record<string, unknown>): string => {
  const sorted = Object.keys(input)
    .sort()
    .reduce((acc, key) => {
      acc[key] = input[key];
      return acc;
    }, {} as Record<string, unknown>);

  // Simple hash function
  const str = JSON.stringify(sorted);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 16);
};

export default cacheKeys;
