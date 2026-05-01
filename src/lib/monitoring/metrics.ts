/**
 * Prometheus Metrics for StarPath Astrology
 * Collects and exposes application metrics for monitoring
 */

import { logger } from '@/lib/logger'

// Metric types
interface Counter {
  name: string
  help: string
  labelNames: string[]
  values: Map<string, number>
}

interface Gauge {
  name: string
  help: string
  labelNames: string[]
  values: Map<string, number>
}

interface Histogram {
  name: string
  help: string
  labelNames: string[]
  buckets: number[]
  values: Map<string, number[]>
}

// Registry to store all metrics
class MetricsRegistry {
  private counters: Map<string, Counter> = new Map()
  private gauges: Map<string, Gauge> = new Map()
  private histograms: Map<string, Histogram> = new Map()

  /**
   * Create or get a counter metric
   */
  createCounter(name: string, help: string, labelNames: string[] = []): Counter {
    if (this.counters.has(name)) {
      return this.counters.get(name)!
    }

    const counter: Counter = {
      name,
      help,
      labelNames,
      values: new Map(),
    }

    this.counters.set(name, counter)
    return counter
  }

  /**
   * Create or get a gauge metric
   */
  createGauge(name: string, help: string, labelNames: string[] = []): Gauge {
    if (this.gauges.has(name)) {
      return this.gauges.get(name)!
    }

    const gauge: Gauge = {
      name,
      help,
      labelNames,
      values: new Map(),
    }

    this.gauges.set(name, gauge)
    return gauge
  }

  /**
   * Create or get a histogram metric
   */
  createHistogram(name: string, help: string, labelNames: string[] = [], buckets: number[] = [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100]): Histogram {
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!
    }

    const histogram: Histogram = {
      name,
      help,
      labelNames,
      buckets,
      values: new Map(),
    }

    this.histograms.set(name, histogram)
    return histogram
  }

  /**
   * Increment a counter
   */
  increment(counter: Counter, labels: Record<string, string> = {}, value: number = 1) {
    const key = this.formatLabels(counter.labelNames, labels)
    const current = counter.values.get(key) || 0
    counter.values.set(key, current + value)
  }

  /**
   * Set a gauge value
   */
  setGauge(gauge: Gauge, labels: Record<string, string> = {}, value: number) {
    const key = this.formatLabels(gauge.labelNames, labels)
    gauge.values.set(key, value)
  }

  /**
   * Observe a histogram value
   */
  observe(histogram: Histogram, labels: Record<string, string> = {}, value: number) {
    const key = this.formatLabels(histogram.labelNames, labels)
    const values = histogram.values.get(key) || []
    values.push(value)
    histogram.values.set(key, values)
  }

  /**
   * Format labels into a consistent key
   */
  private formatLabels(labelNames: string[], labels: Record<string, string>): string {
    if (labelNames.length === 0) return ''

    return labelNames
      .map(name => `${name}="${labels[name] || ''}"`)
      .join(',')
  }

  /**
   * Generate Prometheus-formatted metrics
   */
  getPrometheusMetrics(): string {
    const lines: string[] = []

    // Counters
    this.counters.forEach((counter) => {
      lines.push(`# HELP ${counter.name} ${counter.help}`)
      lines.push(`# TYPE ${counter.name} counter`)

      if (counter.values.size === 0) {
        lines.push(`${counter.name} 0`)
      } else {
        counter.values.forEach((value, key) => {
          const labelStr = key ? `{${key}}` : ''
          lines.push(`${counter.name}${labelStr} ${value}`)
        })
      }
      lines.push('')
    })

    // Gauges
    this.gauges.forEach((gauge) => {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`)
      lines.push(`# TYPE ${gauge.name} gauge`)

      if (gauge.values.size === 0) {
        lines.push(`${gauge.name} 0`)
      } else {
        gauge.values.forEach((value, key) => {
          const labelStr = key ? `{${key}}` : ''
          lines.push(`${gauge.name}${labelStr} ${value}`)
        })
      }
      lines.push('')
    })

    // Histograms
    this.histograms.forEach((histogram) => {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`)
      lines.push(`# TYPE ${histogram.name} histogram`)

      histogram.values.forEach((values, key) => {
        const labelStr = key ? `{${key}}` : ''

        // Calculate bucket counts
        histogram.buckets.forEach((bucket) => {
          const count = values.filter(v => v <= bucket).length
          const bucketLabel = key ? `{${key},le="${bucket}"}` : `{le="${bucket}"}`
          lines.push(`${histogram.name}_bucket${bucketLabel} ${count}`)
        })

        // +Inf bucket
        const infLabel = key ? `{${key},le="+Inf"}` : `{le="+Inf"}`
        lines.push(`${histogram.name}_bucket${infLabel} ${values.length}`)

        // Sum and count
        const sum = values.reduce((a, b) => a + b, 0)
        lines.push(`${histogram.name}_sum${labelStr} ${sum}`)
        lines.push(`${histogram.name}_count${labelStr} ${values.length}`)
      })

      // If no values, emit empty buckets
      if (histogram.values.size === 0) {
        histogram.buckets.forEach((bucket) => {
          lines.push(`${histogram.name}_bucket{le="${bucket}"} 0`)
        })
        lines.push(`${histogram.name}_bucket{le="+Inf"} 0`)
        lines.push(`${histogram.name}_sum 0`)
        lines.push(`${histogram.name}_count 0`)
      }

      lines.push('')
    })

    return lines.join('\n')
  }

  /**
   * Get metrics as JSON for debugging
   */
  getMetricsAsJSON(): object {
    return {
      counters: Object.fromEntries(
        Array.from(this.counters.entries()).map(([name, counter]) => [
          name,
          Object.fromEntries(counter.values),
        ])
      ),
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([name, gauge]) => [
          name,
          Object.fromEntries(gauge.values),
        ])
      ),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, histogram]) => [
          name,
          Object.fromEntries(
            Array.from(histogram.values.entries()).map(([key, values]) => [
              key,
              {
                count: values.length,
                sum: values.reduce((a, b) => a + b, 0),
                avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
                min: values.length > 0 ? Math.min(...values) : 0,
                max: values.length > 0 ? Math.max(...values) : 0,
              },
            ])
          ),
        ])
      ),
    }
  }
}

// Global registry instance
const registry = new MetricsRegistry()

// Define application metrics
export const httpRequestsTotal = registry.createCounter(
  'http_requests_total',
  'Total number of HTTP requests',
  ['method', 'route', 'status']
)

export const httpRequestDuration = registry.createHistogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  ['method', 'route', 'status'],
  [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
)

export const activeUsers = registry.createGauge(
  'active_users',
  'Number of active users',
  ['type'] // type can be 'total', 'premium', 'free'
)

export const aiRequestsTotal = registry.createCounter(
  'ai_requests_total',
  'Total number of AI requests',
  ['provider', 'model', 'status']
)

export const aiRequestDuration = registry.createHistogram(
  'ai_request_duration_seconds',
  'AI request duration in seconds',
  ['provider', 'model'],
  [0.5, 1, 2.5, 5, 10, 30, 60]
)

export const paymentTransactionsTotal = registry.createCounter(
  'payment_transactions_total',
  'Total number of payment transactions',
  ['gateway', 'status', 'plan']
)

export const dbQueryDuration = registry.createHistogram(
  'db_query_duration_seconds',
  'Database query duration in seconds',
  ['operation', 'table'],
  [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
)

export const errorsTotal = registry.createCounter(
  'errors_total',
  'Total number of errors',
  ['type', 'source']
)

export const rateLimitHits = registry.createCounter(
  'rate_limit_hits_total',
  'Total number of rate limit hits',
  ['endpoint', 'user_type']
)

export const cacheOperationsTotal = registry.createCounter(
  'cache_operations_total',
  'Total number of cache operations',
  ['operation', 'result']
)

export const authAttemptsTotal = registry.createCounter(
  'auth_attempts_total',
  'Total number of authentication attempts',
  ['method', 'result']
)

// Metrics tracking functions
export function trackHttpRequest(
  method: string,
  route: string,
  status: number,
  durationMs: number
) {
  const statusClass = `${Math.floor(status / 100)}xx`
  registry.increment(httpRequestsTotal, { method, route, status: statusClass })
  registry.observe(httpRequestDuration, { method, route, status: statusClass }, durationMs / 1000)
}

export function trackAIRequest(
  provider: string,
  model: string,
  status: 'success' | 'error',
  durationMs: number
) {
  registry.increment(aiRequestsTotal, { provider, model, status })
  registry.observe(aiRequestDuration, { provider, model }, durationMs / 1000)
}

export function trackPayment(
  gateway: string,
  status: 'success' | 'failed' | 'pending',
  plan: string
) {
  registry.increment(paymentTransactionsTotal, { gateway, status, plan })
}

export function trackDBQuery(
  operation: string,
  table: string,
  durationMs: number
) {
  registry.observe(dbQueryDuration, { operation, table }, durationMs / 1000)
}

export function trackError(type: string, source: string) {
  registry.increment(errorsTotal, { type, source })
}

export function trackRateLimit(endpoint: string, userType: 'anonymous' | 'authenticated') {
  registry.increment(rateLimitHits, { endpoint, user_type: userType })
}

export function trackCacheOperation(operation: 'get' | 'set' | 'delete', result: 'hit' | 'miss' | 'error') {
  registry.increment(cacheOperationsTotal, { operation, result })
}

export function trackAuthAttempt(method: string, result: 'success' | 'failure') {
  registry.increment(authAttemptsTotal, { method, result })
}

export function setActiveUsers(type: 'total' | 'premium' | 'free', count: number) {
  registry.setGauge(activeUsers, { type }, count)
}

// Export registry for metrics endpoint
export { registry }

// Initialize metrics
export function initMetrics() {
  logger.info('Metrics: Initialized Prometheus metrics registry')
}
