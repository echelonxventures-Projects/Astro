import * as Sentry from '@sentry/nextjs'
import { logger } from '../logger'

// Sentry DSN from environment
const SENTRY_DSN = process.env.SENTRY_DSN
const ENVIRONMENT = process.env.NODE_ENV || 'development'

// Sensitive data patterns to filter
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /auth/i,
  /credit[_-]?card/i,
  /ssn/i,
  /email/i,
  /session/i,
]

/**
 * Sanitize event data to remove sensitive information
 */
function sanitizeEvent(event: Sentry.Event): Sentry.Event {
  if (event.request) {
    // Sanitize headers
    if (event.request.headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(event.request.headers).map(([key, value]) => {
          if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
            return [key, '[FILTERED]']
          }
          return [key, value]
        })
      )
    }

    // Sanitize cookies
    if (event.request.cookies) {
      event.request.cookies = Object.fromEntries(
        Object.entries(event.request.cookies).map(([key, value]) => {
          if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
            return [key, '[FILTERED]']
          }
          return [key, value]
        })
      )
    }

    // Sanitize query string
    if (event.request.query_string) {
      const queryString = event.request.query_string
      if (typeof queryString === 'string') {
        // Parse and sanitize
        const params = new URLSearchParams(queryString)
        const sanitized = new URLSearchParams()
        params.forEach((value, key) => {
          if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
            sanitized.set(key, '[FILTERED]')
          } else {
            sanitized.set(key, value)
          }
        })
        event.request.query_string = sanitized.toString()
      }
    }
  }

  // Sanitize exception values
  if (event.exception?.values) {
    event.exception.values.forEach(exception => {
      if (exception.stacktrace?.frames) {
        exception.stacktrace.frames.forEach(frame => {
          if (frame.vars) {
            frame.vars = Object.fromEntries(
              Object.entries(frame.vars).map(([key, value]) => {
                if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
                  return [key, '[FILTERED]']
                }
                return [key, value]
              })
            )
          }
        })
      }
    })
  }

  // Sanitize breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
      if (breadcrumb.data) {
        breadcrumb.data = Object.fromEntries(
          Object.entries(breadcrumb.data).map(([key, value]) => {
            if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
              return [key, '[FILTERED]']
            }
            return [key, value]
          })
        )
      }
      return breadcrumb
    })
  }

  return event
}

/**
 * Initialize Sentry for the application
 * Called during instrumentation
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    logger.info('Sentry: No DSN configured, skipping initialization')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version,

    // Performance monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Error sampling
    sampleRate: 1.0,

    // Session replay
    replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      // Browser tracing integration
      Sentry.browserTracingIntegration({
        // Enable automatic instrumentation for navigation and requests
        instrumentNavigation: true,
        instrumentPageLoad: true,
      }),
      // Session replay
      Sentry.replayIntegration({
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],

    // Before send hook for sanitization
    beforeSend: (event, _hint) => {
      // Filter out specific errors
      if (
        event.exception?.values?.some(
          e =>
            e.value?.includes('ResizeObserver loop') ||
            e.value?.includes('Network request failed') ||
            e.value?.includes('AbortError')
        )
      ) {
        return null
      }

      return sanitizeEvent(event) as Sentry.ErrorEvent
    },

    // Ignore certain errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
      'Network request failed',
      'AbortError: The user aborted a request.',
      'The operation was aborted',
      'Non-Error promise rejection captured',
    ],

    // Deny URLs for specific errors
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i],

    // Max breadcrumbs
    maxBreadcrumbs: 50,

    // Attach stack trace to messages
    attachStacktrace: true,

    // Debug mode in development
    debug: ENVIRONMENT === 'development',
  })

  logger.info('Sentry: Initialized successfully')
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(userId: string, email?: string, username?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username,
  })
}

/**
 * Clear user context
 */
export function clearSentryUser() {
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  level?: Sentry.SeverityLevel,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  })
}

/**
 * Capture message
 */
export function captureMessage(message: string, level?: Sentry.SeverityLevel) {
  Sentry.captureMessage(message, level)
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope(scope => {
      scope.setContext('additional', context)
      Sentry.captureException(error)
    })
  } else {
    Sentry.captureException(error)
  }
}

/**
 * Capture event
 */
export function captureEvent(event: Sentry.Event) {
  Sentry.captureEvent(event)
}

export { Sentry }
