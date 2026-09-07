/**
 * Request/Response Logging Middleware for Next.js
 * Logs all incoming requests and their responses with timing
 */

import { NextRequest } from 'next/server'
import { logger, createRequestLogger } from './logger'

// Track active requests for cleanup
const requestMetrics = new Map<string, { startTime: number; path: string }>()

/**
 * Generate a unique request ID
 */
export const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}`
}

/**
 * Extract client IP from request headers
 */
const getClientIP = (request: NextRequest): string => {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

/**
 * Extract user agent info
 */
const getUserAgentInfo = (request: NextRequest) => {
  const ua = request.headers.get('user-agent') || 'unknown'
  return {
    userAgent: ua.substring(0, 200), // Truncate long UA strings
    isMobile: /Mobile|Android|iPhone/i.test(ua),
  }
}

/**
 * Request logging middleware for API routes
 * Call this at the start of your API route handler
 */
export const logRequest = (request: NextRequest, additionalContext?: Record<string, unknown>) => {
  const requestId = generateRequestId()
  const url = new URL(request.url)
  const { userAgent, isMobile } = getUserAgentInfo(request)

  const context = {
    requestId,
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    ip: getClientIP(request),
    userAgent,
    isMobile,
    ...additionalContext,
  }

  // Store for response logging
  requestMetrics.set(requestId, {
    startTime: performance.now(),
    path: url.pathname,
  })

  // Create child logger with request context
  const requestLogger = createRequestLogger(requestId, context)

  // Log the incoming request
  requestLogger.info(
    {
      type: 'request.start',
      ...context,
    },
    `→ ${request.method} ${url.pathname}`
  )

  return { requestId, requestLogger }
}

/**
 * Response logging
 * Call this at the end of your API route handler
 */
export const logResponse = (
  requestId: string,
  response: Response,
  additionalContext?: Record<string, unknown>
) => {
  const metrics = requestMetrics.get(requestId)
  const duration = metrics ? Math.round((performance.now() - metrics.startTime) * 100) / 100 : 0

  const status = response.status
  const statusText = response.statusText

  // Determine log level based on status
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

  logger[level](
    {
      type: 'request.complete',
      requestId,
      status,
      statusText,
      durationMs: duration,
      ...additionalContext,
    },
    `← ${status} ${statusText} (${duration}ms)`
  )

  // Clean up
  requestMetrics.delete(requestId)
}

/**
 * Log an error response
 */
export const logResponseError = (
  requestId: string,
  error: unknown,
  statusCode: number,
  additionalContext?: Record<string, unknown>
) => {
  const metrics = requestMetrics.get(requestId)
  const duration = metrics ? Math.round((performance.now() - metrics.startTime) * 100) / 100 : 0

  const errorObj =
    error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
        }
      : { error: String(error) }

  logger.error(
    {
      type: 'request.error',
      requestId,
      status: statusCode,
      durationMs: duration,
      ...errorObj,
      ...additionalContext,
    },
    `← ERROR ${statusCode} (${duration}ms)`
  )

  requestMetrics.delete(requestId)
}

/**
 * Higher-order function to wrap API handlers with logging
 * Usage:
 *   export const GET = withLogging(async (request, { requestLogger }) => {
 *     // your handler code
 *   });
 */
export const withLogging = (
  handler: (
    request: NextRequest,
    context: { requestId: string; requestLogger: ReturnType<typeof createRequestLogger> }
  ) => Promise<Response>
) => {
  return async (request: NextRequest): Promise<Response> => {
    const { requestId, requestLogger } = logRequest(request)

    try {
      const response = await handler(request, { requestId, requestLogger })
      logResponse(requestId, response)
      return response
    } catch (error) {
      logResponseError(requestId, error, 500)
      throw error
    }
  }
}

/**
 * Cleanup old request metrics periodically
 * Prevents memory leaks in long-running processes
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = performance.now()
    const timeout = 5 * 60 * 1000 // 5 minutes

    for (const [id, metrics] of requestMetrics.entries()) {
      if (now - metrics.startTime > timeout) {
        logger.warn(
          {
            type: 'cleanup',
            requestId: id,
            path: metrics.path,
            age: Math.round((now - metrics.startTime) / 1000),
          },
          'Cleaning up stale request metrics'
        )
        requestMetrics.delete(id)
      }
    }
  }, 60000) // Run every minute
}

export default { logRequest, logResponse, logResponseError, withLogging, generateRequestId }
