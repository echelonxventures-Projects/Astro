import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error'
  responseTime?: number
  message?: string
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: HealthCheck
    redis?: HealthCheck
    stripe?: HealthCheck
    anthropic?: HealthCheck
  }
}

const START_TIME = Date.now()

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      status: 'ok',
      responseTime: Date.now() - start,
    }
  } catch (error) {
    logger.error({ error }, 'Health check: Database connection failed')
    return {
      status: 'error',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database connection failed',
    }
  }
}

async function checkStripe(): Promise<HealthCheck> {
  const start = Date.now()
  try {
    const { getStripe } = await import('@/lib/stripe')
    const stripe = getStripe()
    // Simple API call to check connectivity
    await stripe.customers.list({ limit: 1 })
    return {
      status: 'ok',
      responseTime: Date.now() - start,
    }
  } catch (error) {
    // Stripe errors are expected in development without keys
    if (process.env.NODE_ENV === 'development' && !process.env.STRIPE_SECRET_KEY) {
      return {
        status: 'ok',
        responseTime: Date.now() - start,
        message: 'Skipped - no API key in development',
      }
    }
    logger.error({ error }, 'Health check: Stripe connection failed')
    return {
      status: 'error',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Stripe connection failed',
    }
  }
}

async function checkAnthropic(): Promise<HealthCheck> {
  const start = Date.now()
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return {
        status: 'ok',
        responseTime: Date.now() - start,
        message: 'Skipped - no API key configured',
      }
    }

    // Simple connectivity check - just validate key format
    if (!apiKey.startsWith('sk-ant-')) {
      return {
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Invalid API key format',
      }
    }

    return {
      status: 'ok',
      responseTime: Date.now() - start,
    }
  } catch (error) {
    logger.error({ error }, 'Health check: Anthropic configuration failed')
    return {
      status: 'error',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Anthropic check failed',
    }
  }
}

export async function GET(): Promise<NextResponse> {
  const checks = await Promise.all([checkDatabase(), checkStripe(), checkAnthropic()])

  const [database, stripe, anthropic] = checks

  // Determine overall status
  let status: HealthStatus['status'] = 'healthy'
  const hasErrors = checks.some(c => c.status === 'error')
  const hasDegraded = checks.some(c => c.status === 'degraded')

  if (hasErrors) {
    status = 'unhealthy'
  } else if (hasDegraded) {
    status = 'degraded'
  }

  const healthStatus: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || '0.1.0',
    uptime: Date.now() - START_TIME,
    checks: {
      database,
      stripe,
      anthropic,
    },
  }

  // Return appropriate HTTP status
  const statusCode = status === 'unhealthy' ? 503 : status === 'degraded' ? 200 : 200

  return NextResponse.json(healthStatus, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

// HEAD request for simple health checks (load balancers)
export async function HEAD(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}
