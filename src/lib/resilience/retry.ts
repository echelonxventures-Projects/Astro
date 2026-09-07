import { logger } from '../logger'

export class RetryExhaustedError extends Error {
  constructor(
    message = 'Max retries exceeded',
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message)
    this.name = 'RetryExhaustedError'
  }
}

export interface RetryOptions {
  maxAttempts: number
  backoff: 'fixed' | 'exponential'
  initialDelay: number
  maxDelay: number
  retryableErrors?: string[]
  onRetry?: (attempt: number, error: Error, delay: number) => void
}

const DEFAULT_RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EPIPE',
  'ERR_SOCKET_CLOSED',
  'ERR_CONNECTION_RESET',
]

function isRetryable(error: Error, retryableErrors?: string[]): boolean {
  const errorMessage = error.message || ''
  const errorCode = (error as any).code || ''

  const errorsToCheck = retryableErrors || DEFAULT_RETRYABLE_ERRORS

  return errorsToCheck.some(pattern => errorMessage.includes(pattern) || errorCode === pattern)
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  if (options.backoff === 'fixed') {
    return options.initialDelay
  }

  // Exponential backoff with jitter to prevent thundering herd
  const exponential = options.initialDelay * Math.pow(2, attempt - 1)
  const jitter = Math.random() * 100 // Random jitter up to 100ms
  return Math.min(exponential + jitter, options.maxDelay)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let attempt = 0
  let lastError: Error | null = null

  while (attempt < options.maxAttempts) {
    try {
      return await fn()
    } catch (error) {
      attempt++
      lastError = error as Error

      if (attempt >= options.maxAttempts) {
        logger.error(
          {
            lastError: lastError.message,
          },
          `All ${options.maxAttempts} retry attempts exhausted`
        )
        throw new RetryExhaustedError(
          `Max retries exceeded after ${options.maxAttempts} attempts`,
          attempt,
          lastError
        )
      }

      if (!isRetryable(lastError, options.retryableErrors)) {
        logger.debug(`Non-retryable error encountered, giving up: ${lastError.message}`)
        throw lastError
      }

      const delay = calculateDelay(attempt, options)

      logger.info(
        {
          error: lastError.message,
        },
        `Retry attempt ${attempt}/${options.maxAttempts} after ${delay}ms delay`
      )

      if (options.onRetry) {
        options.onRetry(attempt, lastError, delay)
      }

      await sleep(delay)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new RetryExhaustedError('Max retries exceeded', attempt, lastError!)
}

// Convenience function for quick retries
export function withDefaultRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  return withRetry(fn, {
    maxAttempts,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
  })
}

// Retry with immediate execution for critical operations
export function withImmediateRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  return withRetry(fn, {
    maxAttempts,
    backoff: 'fixed',
    initialDelay: 500,
    maxDelay: 500,
  })
}

// Retry configuration presets
export const RetryPresets = {
  // For API calls to external services
  externalApi: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
  },

  // For database operations
  database: {
    maxAttempts: 5,
    backoff: 'exponential',
    initialDelay: 500,
    maxDelay: 30000,
  },

  // For AI service calls
  aiService: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 2000,
    maxDelay: 15000,
  },

  // For payment operations
  payment: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 500,
    maxDelay: 5000,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit', 'gateway_timeout'] as string[],
  },
} satisfies { [K: string]: RetryOptions }
