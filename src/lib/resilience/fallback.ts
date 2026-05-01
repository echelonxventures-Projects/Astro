import { logger } from '../logger';

export interface FallbackOptions<T> {
  fallbackValue?: T;
  fallbackFn?: () => Promise<T>;
  onFallback?: (error: Error) => void;
}

export class FallbackError extends Error {
  constructor(message = 'Primary operation failed and no fallback available') {
    super(message);
    this.name = 'FallbackError';
  }
}

/**
 * Execute an operation with a fallback value if it fails
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  options: FallbackOptions<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.warn('Primary operation failed, attempting fallback', {
      error: (error as Error).message
    });

    if (options.onFallback) {
      options.onFallback(error as Error);
    }

    // Try fallback function if provided
    if (options.fallbackFn) {
      try {
        const result = await options.fallbackFn();
        logger.info('Fallback function executed successfully');
        return result;
      } catch (fallbackError) {
        logger.error('Fallback function also failed', {
          error: (fallbackError as Error).message
        });
      }
    }

    // Return fallback value if provided
    if (options.fallbackValue !== undefined) {
      logger.info('Returning fallback value');
      return options.fallbackValue;
    }

    // Nothing worked, throw the original error
    throw error;
  }
}

/**
 * Chain multiple fallback strategies
 */
export async function withChainedFallback<T>(
  operations: Array<() => Promise<T>>,
  finalFallback?: T
): Promise<T> {
  const errors: Error[] = [];

  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await operations[i]();
      logger.debug(`Chained fallback: operation ${i + 1} succeeded`);
      return result;
    } catch (error) {
      logger.warn(`Chained fallback: operation ${i + 1} failed`, {
        error: (error as Error).message
      });
      errors.push(error as Error);
    }
  }

  if (finalFallback !== undefined) {
    logger.info('All operations failed, returning final fallback value');
    return finalFallback;
  }

  throw new FallbackError(
    `All ${operations.length} fallback operations failed. Last error: ${errors[errors.length - 1]?.message}`
  );
}

/**
 * Graceful degradation - return a simplified/partial result instead of failing completely
 */
export async function withGracefulDegradation<T, D>(
  fn: () => Promise<T>,
  degradeFn: (error: Error) => D
): Promise<T | D> {
  try {
    return await fn();
  } catch (error) {
    logger.warn('Operation failed, applying graceful degradation', {
      error: (error as Error).message
    });
    return degradeFn(error as Error);
  }
}

/**
 * Cache-based fallback - try cache if primary fails
 */
export async function withCacheFallback<T>(
  fn: () => Promise<T>,
  cache: {
    get: (key: string) => Promise<T | null>;
    set: (key: string, value: T) => Promise<void>;
  },
  cacheKey: string
): Promise<T> {
  try {
    const result = await fn();
    // Store successful result in cache for future fallbacks
    await cache.set(cacheKey, result);
    return result;
  } catch (error) {
    logger.warn('Primary operation failed, checking cache fallback', {
      error: (error as Error).message
    });

    const cached = await cache.get(cacheKey);
    if (cached !== null) {
      logger.info('Returning cached fallback value');
      return cached;
    }

    throw error;
  }
}

/**
 * Static fallback values for common scenarios
 */
export const FallbackValues = {
  // AI service fallbacks
  ai: {
    emptyResponse: '',
    genericHoroscope: 'The stars suggest a day of reflection and mindfulness. Trust your intuition and remain open to new possibilities.',
    genericNatalChart: 'Your unique astrological configuration reveals a complex interplay of planetary influences. Each aspect contributes to your individual path.',
    genericCompatibility: 'Relationships are journeys of mutual growth. Focus on open communication and shared values.',
    genericTransit: 'Current planetary movements encourage patience and strategic planning. Take time to assess your direction.'
  },

  // Payment fallbacks
  payment: {
    pendingStatus: { status: 'pending', retryable: true },
    failedStatus: { status: 'failed', retryable: false, requiresManualReview: true }
  },

  // User data fallbacks
  user: {
    emptyProfile: { name: '', email: '', preferences: {} },
    defaultPreferences: { theme: 'light', notifications: true, language: 'en' }
  },

  // Astrology fallbacks
  astrology: {
    defaultSign: 'aries',
    defaultHouse: 1,
    emptyChart: {
      sun: { sign: 'aries', degree: 0, house: 1 },
      moon: { sign: 'taurus', degree: 0, house: 2 },
      mercury: { sign: 'gemini', degree: 0, house: 3 }
    }
  }
} as const;
