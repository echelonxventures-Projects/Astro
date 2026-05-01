/**
 * Next.js Instrumentation Hook
 * Initializes monitoring on server start
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { logger } from '@/lib/logger'

export async function register() {
  // Only run in Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    logger.info('Instrumentation: Initializing server-side monitoring...')

    try {
      // Initialize Sentry
      if (process.env.SENTRY_DSN) {
        const { initSentry } = await import('@/lib/monitoring/sentry')
        initSentry()
        logger.info('Instrumentation: Sentry initialized')
      } else {
        logger.info('Instrumentation: SENTRY_DSN not configured, skipping Sentry')
      }

      // Initialize metrics
      const { initMetrics } = await import('@/lib/monitoring/metrics')
      initMetrics()
      logger.info('Instrumentation: Metrics initialized')

      // Initialize error handlers
      setupErrorHandlers()

      logger.info('Instrumentation: Monitoring initialization complete')
    } catch (error) {
      logger.error('Instrumentation: Failed to initialize monitoring', { error })
    }
  }
}

/**
 * Setup global error handlers
 */
function setupErrorHandlers() {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error,
      stack: error.stack,
    })

    // Give time for logs to flush before exiting
    setTimeout(() => {
      process.exit(1)
    }, 1000)
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      reason,
      promise,
    })
  })

  // Handle warnings
  process.on('warning', (warning) => {
    logger.warn('Process warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    })
  })

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`)

    // Close any open connections, flush logs, etc.
    setTimeout(() => {
      logger.info('Graceful shutdown complete')
      process.exit(0)
    }, 500)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  logger.info('Error handlers configured')
}

/**
 * Called when instrumentation is being unregistered (e.g., during hot reload)
 */
export async function onRequest() {
  // This can be used to track request-level metrics
  // Currently handled by middleware
}
