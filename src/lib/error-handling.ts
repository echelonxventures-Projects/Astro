/**
 * Error Handling Utilities
 * Comprehensive error handling for StarPath Astrology
 */

import { logger, logError as logErrorToLogger } from './logger'

// Environment check
const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

// Error context for logging
export interface ErrorContext {
  userId?: string
  path?: string
  action?: string
  [key: string]: unknown
}

/**
 * Base Application Error Class
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly severity: ErrorSeverity
  public readonly isOperational: boolean
  public readonly context?: ErrorContext
  public readonly timestamp: string

  constructor(
    message: string,
    statusCode: number = 500,
    severity: ErrorSeverity = 'medium',
    isOperational: boolean = true,
    context?: ErrorContext
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.severity = severity
    this.isOperational = isOperational
    this.context = context
    this.timestamp = new Date().toISOString()

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/**
 * Validation Error - Invalid user input or data
 */
export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string[]>

  constructor(
    message: string = 'Validation failed',
    fieldErrors?: Record<string, string[]>,
    context?: ErrorContext
  ) {
    super(message, 400, 'low', true, context)
    this.fieldErrors = fieldErrors
  }
}

/**
 * Authentication Error - Login/Auth issues
 */
export class AuthError extends AppError {
  public readonly authType: 'login' | 'session' | 'permission' | 'token'

  constructor(
    message: string = 'Authentication failed',
    authType: 'login' | 'session' | 'permission' | 'token' = 'login',
    context?: ErrorContext
  ) {
    super(message, 401, 'medium', true, context)
    this.authType = authType
  }
}

/**
 * Not Found Error - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  public readonly resourceType?: string
  public readonly resourceId?: string

  constructor(
    message: string = 'Resource not found',
    resourceType?: string,
    resourceId?: string,
    context?: ErrorContext
  ) {
    super(message, 404, 'low', true, context)
    this.resourceType = resourceType
    this.resourceId = resourceId
  }
}

/**
 * Rate Limit Error - Too many requests
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter: number = 60,
    context?: ErrorContext
  ) {
    super(message, 429, 'medium', true, context)
    this.retryAfter = retryAfter
  }
}

/**
 * Database Error - Database operation failures
 */
export class DatabaseError extends AppError {
  public readonly operation: string

  constructor(
    message: string = 'Database operation failed',
    operation: string = 'unknown',
    context?: ErrorContext
  ) {
    super(message, 500, 'high', false, context)
    this.operation = operation
  }
}

/**
 * AI Service Error - AI/ML service failures
 */
export class AIServiceError extends AppError {
  public readonly service: string

  constructor(
    message: string = 'AI service error',
    service: string = 'unknown',
    context?: ErrorContext
  ) {
    super(message, 503, 'high', false, context)
    this.service = service
  }
}

/**
 * Payment Error - Payment processing failures
 */
export class PaymentError extends AppError {
  public readonly paymentId?: string
  public readonly gateway: string

  constructor(
    message: string = 'Payment processing failed',
    gateway: string = 'unknown',
    paymentId?: string,
    context?: ErrorContext
  ) {
    super(message, 402, 'high', true, context)
    this.gateway = gateway
    this.paymentId = paymentId
  }
}

/**
 * Error response structure for HTTP responses
 */
export interface ErrorResponse {
  status: number
  message: string
  code?: string
  details?: unknown
}

/**
 * Map error to HTTP response
 */
export function getErrorResponse(error: Error): ErrorResponse {
  // Handle known app errors
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      message: isProduction && !error.isOperational
        ? 'An unexpected error occurred'
        : error.message,
      code: error.constructor.name,
      details: error instanceof ValidationError ? error.fieldErrors : undefined,
    }
  }

  // Handle generic errors
  return {
    status: 500,
    message: isProduction ? 'An unexpected error occurred' : error.message,
    code: 'InternalError',
  }
}

/**
 * Structured error logger
 * Logs errors without exposing sensitive information
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  const errorData = {
    name: error.name,
    message: error.message,
    stack: isDevelopment ? error.stack : undefined,
    context,
    ...(error instanceof AppError && {
      statusCode: error.statusCode,
      severity: error.severity,
      isOperational: error.isOperational,
    }),
  }

  // Use structured logger
  logger.error(errorData, error.message)
}

/**
 * Report error to external service
 * For manual error reporting by users
 */
export async function reportError(
  error: Error,
  userDescription?: string
): Promise<{ success: boolean; reportId?: string }> {
  const reportId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Log the report
  logger.error({
    reportId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    userDescription,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  }, 'Error report submitted')
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  }, 'Error report submitted')

  // TODO: Send to error tracking service
  // if (process.env.ERROR_REPORTING_ENDPOINT) {
  //   try {
  //     await fetch(process.env.ERROR_REPORTING_ENDPOINT, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify(reportData),
  //     })
  //   } catch (e) {
  //     logger.error({ error: e }, 'Failed to send error report')
  //   }
  // }

  return { success: true, reportId }
}

/**
 * Create user-friendly error message
 */
export function getUserErrorMessage(error: Error): string {
  if (error instanceof ValidationError) {
    return error.message || 'Please check your input and try again.'
  }

  if (error instanceof AuthError) {
    switch (error.authType) {
      case 'login':
        return 'Invalid email or password. Please try again.'
      case 'session':
        return 'Your session has expired. Please sign in again.'
      case 'permission':
        return 'You do not have permission to access this resource.'
      case 'token':
        return 'Authentication token is invalid or expired.'
      default:
        return 'Authentication failed. Please try again.'
    }
  }

  if (error instanceof NotFoundError) {
    return error.resourceType
      ? `The requested ${error.resourceType} could not be found.`
      : 'The requested resource could not be found.'
  }

  if (error instanceof RateLimitError) {
    return `Too many requests. Please try again in ${error.retryAfter} seconds.`
  }

  if (error instanceof PaymentError) {
    return 'Payment processing failed. Please check your payment details and try again.'
  }

  if (error instanceof DatabaseError) {
    return 'We encountered a database error. Please try again later.'
  }

  if (error instanceof AIServiceError) {
    return 'Our AI service is temporarily unavailable. Please try again in a moment.'
  }

  // Generic error
  return 'Something went wrong. Please try again or contact support if the problem persists.'
}

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational
  }
  return false
}

/**
 * Async error wrapper for API routes
 */
export function asyncHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      logError(error as Error, { args })
      throw error
    }
  }) as T
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T
  } catch (error) {
    logError(error as Error, { json: json.substring(0, 100) })
    return defaultValue
  }
}

/**
 * Retry operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    retryableErrors?: string[]
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryableErrors = ['DatabaseError', 'AIServiceError', 'Error'],
  } = options

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Check if error is retryable
      const errorName = (error as Error).name
      if (!retryableErrors.includes(errorName)) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)

      // Log retry attempt
      logError(lastError, {
        retryAttempt: attempt + 1,
        maxRetries,
        nextRetryDelay: delay,
      })

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
