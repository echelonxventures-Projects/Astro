/**
 * Structured Logger for StarPath Astrology
 * Uses Pino for JSON logging with redaction and pretty printing in development
 */

import pino from 'pino'

/**
 * Redact sensitive data from log output
 */
const redactOptions = {
  paths: [
    'password',
    '*.password',
    'apiKey',
    'apiSecret',
    'token',
    'authorization',
    '*.authorization',
    'secret',
    '*.secret',
    'access_token',
    'refresh_token',
    'id_token',
    'session_token',
    'csrf_token',
    'cookie',
    'x-api-key',
    'stripeKey',
    'razorpayKey',
    'paypalSecret',
    'nonce',
    'email',
    '*.email',
  ],
  censor: (value: unknown, path: string[]) => {
    const pathStr = path.join('.')
    const strValue = String(value)

    // Passwords: completely remove
    if (pathStr.includes('password')) {
      return '[REDACTED]'
    }

    // API keys: mask most of it (e.g., sk_live_***)
    if (
      pathStr.includes('api') ||
      pathStr.includes('key') ||
      pathStr.includes('secret') ||
      pathStr.includes('token')
    ) {
      if (strValue.length > 8) {
        return strValue.substring(0, 7) + '***'
      }
      return '***'
    }

    // Emails: mask username (e.g., u***@example.com)
    if (strValue.includes('@')) {
      const [user, domain] = strValue.split('@')
      if (user && user.length > 1) {
        return user.charAt(0) + '***@' + domain
      }
      return '***@' + domain
    }

    return '[REDACTED]'
  },
  remove: true,
}

/**
 * Create base logger configuration
 */
const createLoggerConfig = (): pino.LoggerOptions => {
  const config: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
    redact: redactOptions,
    base: {
      env: process.env.NODE_ENV || 'development',
      service: 'starpath-astrology',
      version: process.env.APP_VERSION || '0.1.0',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }

  // Pretty printing in development
  if (process.env.NODE_ENV === 'development') {
    config.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  }

  return config
}

/**
 * Global logger instance
 */
export const logger = pino(createLoggerConfig())

/**
 * Create a child logger with request context
 */
export const createRequestLogger = (
  requestId: string,
  additionalContext?: Record<string, unknown>
) => {
  return logger.child({
    requestId,
    ...additionalContext,
  })
}

/**
 * Create a child logger with user context
 */
export const createUserLogger = (
  userId: string,
  additionalContext?: Record<string, unknown>
) => {
  return logger.child({
    userId,
    ...additionalContext,
  })
}

/**
 * Performance timer helper
 * Returns a function that logs the elapsed time when called
 */
export const startTimer = (
  operationName: string,
  context?: Record<string, unknown>
) => {
  const start = performance.now()

  return (additionalContext?: Record<string, unknown>) => {
    const duration = performance.now() - start
    logger.info({
      operation: operationName,
      durationMs: Math.round(duration * 100) / 100,
      ...context,
      ...additionalContext,
    }, `${operationName} completed`)
    return duration
  }
}

/**
 * Log an error with full context
 */
export const logError = (
  message: string,
  error: unknown,
  context?: Record<string, unknown>
) => {
  const isDev = process.env.NODE_ENV === 'development'
  const errorObj = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: isDev ? error.stack : undefined,
      }
    : { error: String(error) }

  logger.error({
    ...errorObj,
    ...context,
  }, message)
}

/**
 * Log a security event
 */
export const logSecurity = (
  event: string,
  severity: 'info' | 'warn' | 'error' = 'info',
  context?: Record<string, unknown>
) => {
  logger[severity]({
    type: 'security',
    event,
    ...context,
  }, `Security: ${event}`)
}

/**
 * Log an audit event (user actions)
 */
export const logAudit = (
  action: string,
  userId: string,
  resource?: string,
  context?: Record<string, unknown>
) => {
  logger.info({
    type: 'audit',
    action,
    userId,
    resource,
    ...context,
  }, `Audit: ${action}`)
}

/**
 * Log a warning message
 */
export const logWarn = (
  message: string,
  context?: Record<string, unknown>
) => {
  logger.warn({
    ...context,
  }, message)
}

/**
 * Log an info message
 */
export const logInfo = (
  message: string,
  context?: Record<string, unknown>
) => {
  logger.info({
    ...context,
  }, message)
}

/**
 * Log a debug message
 */
export const logDebug = (
  message: string,
  context?: Record<string, unknown>
) => {
  logger.debug({
    ...context,
  }, message)
}

export default logger
