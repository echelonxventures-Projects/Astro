import { logger } from '../logger'

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message)
    this.name = 'TimeoutError'
  }
}

export interface TimeoutOptions {
  ms: number
  errorMessage?: string
  onTimeout?: () => void
}

/**
 * Wrap a promise with a timeout
 */
export function withTimeout<T>(promise: Promise<T>, options: TimeoutOptions): Promise<T> {
  const { ms, errorMessage = `Operation timed out after ${ms}ms`, onTimeout } = options

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (onTimeout) {
        onTimeout()
      }
      reject(new TimeoutError(errorMessage))
    }, ms)

    promise
      .then(result => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

/**
 * Convenience function for simple timeout with milliseconds
 */
export function withTimeoutMs<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage?: string
): Promise<T> {
  return withTimeout(promise, { ms, errorMessage })
}

/**
 * Create a cancellable operation with timeout
 */
export interface CancellableOperation<T> {
  promise: Promise<T>
  cancel: () => void
}

export function withCancellableTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: TimeoutOptions
): CancellableOperation<T> {
  const { ms, errorMessage = `Operation timed out after ${ms}ms`, onTimeout } = options
  const abortController = new AbortController()

  const promise = new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      abortController.abort()
      if (onTimeout) {
        onTimeout()
      }
      reject(new TimeoutError(errorMessage))
    }, ms)

    fn(abortController.signal)
      .then(result => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          reject(new TimeoutError(errorMessage))
        } else {
          reject(error)
        }
      })
  })

  return {
    promise,
    cancel: () => abortController.abort(),
  }
}

/**
 * Timeout presets for common scenarios
 */
export const TimeoutPresets = {
  // Quick operations (database lookups, cache hits)
  quick: {
    ms: 5000,
    errorMessage: 'Quick operation timed out after 5 seconds',
  },

  // Standard operations (API calls, calculations)
  standard: {
    ms: 10000,
    errorMessage: 'Standard operation timed out after 10 seconds',
  },

  // AI service calls
  aiService: {
    ms: 30000,
    errorMessage: 'AI service request timed out after 30 seconds',
  },

  // Long running operations (complex calculations, batch jobs)
  longRunning: {
    ms: 120000,
    errorMessage: 'Long running operation timed out after 2 minutes',
  },

  // Payment operations
  payment: {
    ms: 30000,
    errorMessage: 'Payment operation timed out after 30 seconds',
  },

  // Chart generation
  chartGeneration: {
    ms: 45000,
    errorMessage: 'Chart generation timed out after 45 seconds',
  },
} as const

/**
 * Execute a function with automatic timeout
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  preset: keyof typeof TimeoutPresets
): Promise<T> {
  const options = TimeoutPresets[preset]
  return withTimeout(fn(), options)
}

/**
 * Wrap an async function to always have a timeout
 */
export function createTimeoutWrapper<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: TimeoutOptions
): (...args: T) => Promise<R> {
  return (...args: T) => withTimeout(fn(...args), options)
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: Error): boolean {
  return error instanceof TimeoutError || error.name === 'TimeoutError'
}

/**
 * Log timeout errors appropriately
 */
export function logTimeoutError(error: Error, context: string): void {
  if (isTimeoutError(error)) {
    logger.error({ error: error.message }, `Timeout in ${context}`)
  }
}
