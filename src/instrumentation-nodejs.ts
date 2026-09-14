/**
 * Node.js-only instrumentation
 * Initializes monitoring and process-level error handlers on server start
 */

import { logger } from '@/lib/logger'

export async function register() {
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

    if (process.env.DOMAIN_MONITOR === '1') {
      const { startDomainMonitor } = await import('@/lib/domains/monitor')
      startDomainMonitor()
    }

    // Initialize metrics
    const { initMetrics } = await import('@/lib/monitoring/metrics')
    initMetrics()
    logger.info('Instrumentation: Metrics initialized')

    // Initialize error handlers
    setupErrorHandlers()

    logger.info('Instrumentation: Monitoring initialization complete')
  } catch (error) {
    logger.error({ error }, 'Instrumentation: Failed to initialize monitoring')
  }
}

/**
 * Setup global error handlers
 */
function setupErrorHandlers() {
  // Handle uncaught exceptions
  process.on('uncaughtException', error => {
    logger.error(
      {
        error,
        stack: error.stack,
      },
      'Uncaught exception'
    )

    // Give time for logs to flush before exiting
    setTimeout(() => {
      process.exit(1)
    }, 1000)
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      {
        reason,
        promise,
      },
      'Unhandled promise rejection'
    )
  })

  // Handle warnings
  process.on('warning', warning => {
    logger.warn(
      {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      },
      'Process warning'
    )
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
