import { NextResponse } from 'next/server'
import { registry } from '@/lib/monitoring/metrics'

/**
 * Prometheus metrics endpoint
 * Returns metrics in Prometheus exposition format
 */
export async function GET(): Promise<NextResponse> {
  const metrics = registry.getPrometheusMetrics()

  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

/**
 * Metrics as JSON for debugging
 */
export async function POST(): Promise<NextResponse> {
  const metrics = registry.getMetricsAsJSON()

  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
