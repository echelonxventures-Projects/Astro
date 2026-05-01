/**
 * Web Vitals Performance Tracking
 * Tracks Core Web Vitals and other performance metrics
 */

import { logger } from '@/lib/logger'

// Types for Web Vitals
interface Metric {
  name: string
  value: number
  id: string
  delta: number
  entries: PerformanceEntry[]
}

type WebVitalName = 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP'

// Thresholds for Web Vitals (from Google)
const WEB_VITAL_THRESHOLDS: Record<WebVitalName, { good: number; poor: number }> = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
}

// Performance observer for tracking
let observers: PerformanceObserver[] = []

/**
 * Get rating for a metric value
 */
function getRating(name: WebVitalName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITAL_THRESHOLDS[name]
  if (!thresholds) return 'needs-improvement'

  if (value <= thresholds.good) return 'good'
  if (value >= thresholds.poor) return 'poor'
  return 'needs-improvement'
}

/**
 * Send metric to analytics (placeholder for actual analytics integration)
 */
function sendToAnalytics(metric: Metric) {
  const rating = getRating(metric.name as WebVitalName, metric.value)

  // Log locally in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Web Vital:', {
      name: metric.name,
      value: metric.value,
      rating,
      id: metric.id,
    })
  }

  // Send to your analytics service
  // Example: Google Analytics, Vercel Analytics, custom endpoint
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'web_vitals', {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.value),
      custom_parameter_1: metric.name,
      custom_parameter_2: rating,
    })
  }

  // Send to custom endpoint if configured
  const analyticsEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT
  if (analyticsEndpoint && typeof navigator !== 'undefined') {
    // Use sendBeacon for reliable delivery
    if (navigator.sendBeacon) {
      const data = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating,
        id: metric.id,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : '',
      })
      navigator.sendBeacon(analyticsEndpoint, new Blob([data], { type: 'application/json' }))
    }
  }
}

/**
 * Report Web Vitals to console and analytics
 */
export function reportWebVitals(metric: Metric) {
  sendToAnalytics(metric)
}

/**
 * Initialize Core Web Vitals tracking
 */
export function initPerformanceTracking() {
  if (typeof window === 'undefined') return

  // Clean up existing observers
  observers.forEach(obs => obs.disconnect())
  observers = []

  // CLS - Cumulative Layout Shift
  if ('PerformanceObserver' in window) {
    try {
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        let clsValue = 0

        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        })

        reportWebVitals({
          name: 'CLS',
          value: clsValue,
          id: entryId(entries[entries.length - 1]),
          delta: clsValue,
          entries: entries as PerformanceEntry[],
        })
      })

      clsObserver.observe({ type: 'layout-shift', buffered: true })
      observers.push(clsObserver)
    } catch (e) {
      logger.warn('CLS observation not supported')
    }
  }

  // LCP - Largest Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as PerformanceEntry

        reportWebVitals({
          name: 'LCP',
          value: lastEntry.startTime,
          id: entryId(lastEntry),
          delta: lastEntry.startTime,
          entries: entries as PerformanceEntry[],
        })
      })

      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      observers.push(lcpObserver)
    } catch (e) {
      logger.warn('LCP observation not supported')
    }
  }

  // FID - First Input Delay
  if ('PerformanceObserver' in window) {
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const firstEntry = entries[0] as PerformanceEntry & { processingStart: number }

        reportWebVitals({
          name: 'FID',
          value: firstEntry.processingStart - firstEntry.startTime,
          id: entryId(firstEntry),
          delta: firstEntry.processingStart - firstEntry.startTime,
          entries: entries as PerformanceEntry[],
        })
      })

      fidObserver.observe({ type: 'first-input', buffered: true })
      observers.push(fidObserver)
    } catch (e) {
      logger.warn('FID observation not supported')
    }
  }

  // FCP - First Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const firstEntry = entries[0] as PerformanceEntry

        reportWebVitals({
          name: 'FCP',
          value: firstEntry.startTime,
          id: entryId(firstEntry),
          delta: firstEntry.startTime,
          entries: entries as PerformanceEntry[],
        })
      })

      fcpObserver.observe({ type: 'paint', buffered: true })
      observers.push(fcpObserver)
    } catch (e) {
      logger.warn('FCP observation not supported')
    }
  }

  // TTFB - Time to First Byte
  if (typeof performance !== 'undefined' && performance.timing) {
    const timing = performance.timing
    const ttfb = timing.responseStart - timing.requestStart

    reportWebVitals({
      name: 'TTFB',
      value: ttfb,
      id: 'ttfb',
      delta: ttfb,
      entries: [],
    })
  }

  // INP - Interaction to Next Paint (newer metric)
  if ('PerformanceObserver' in window) {
    try {
      const inpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        // Calculate INP from interaction entries
        const interactions = entries.filter(e => (e as any).interactionId)
        if (interactions.length > 0) {
          const longest = interactions.reduce((max, entry) => {
            const duration = (entry as any).duration
            return duration > max ? duration : max
          }, 0)

          reportWebVitals({
            name: 'INP',
            value: longest,
            id: entryId(interactions[interactions.length - 1]),
            delta: longest,
            entries: entries as PerformanceEntry[],
          })
        }
      })

      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 0 })
      observers.push(inpObserver)
    } catch (e) {
      logger.warn('INP observation not supported')
    }
  }

  // Long Task tracking
  if ('PerformanceObserver' in window) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          logger.warn('Long task detected:', {
            duration: (entry as any).duration,
            startTime: entry.startTime,
          })
        })
      })

      longTaskObserver.observe({ type: 'longtask', buffered: true })
      observers.push(longTaskObserver)
    } catch (e) {
      logger.warn('Long task observation not supported')
    }
  }

  logger.info('Performance tracking initialized')
}

/**
 * Generate a unique ID for a performance entry
 */
function entryId(entry: PerformanceEntry | undefined): string {
  if (!entry) return 'unknown'
  // Use a combination of entry properties for uniqueness
  return `${entry.name}-${entry.startTime}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Measure custom performance mark
 */
export function measureMark(name: string, startMark?: string, endMark?: string) {
  if (typeof performance === 'undefined') return

  try {
    if (startMark && endMark) {
      performance.measure(name, startMark, endMark)
    } else {
      performance.mark(name)
    }
  } catch (e) {
    logger.warn('Performance mark failed:', e)
  }
}

/**
 * Get navigation timing information
 */
export function getNavigationTiming(): Record<string, number> | null {
  if (typeof performance === 'undefined' || !performance.timing) return null

  const timing = performance.timing
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined

  return {
    // Navigation timing
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    connection: timing.connectEnd - timing.connectStart,
    response: timing.responseEnd - timing.responseStart,
    domInteractive: timing.domInteractive - timing.navigationStart,
    domComplete: timing.domComplete - timing.navigationStart,
    loadComplete: timing.loadEventEnd - timing.navigationStart,

    // Modern navigation timing if available
    redirect: navigation?.redirectEnd ? navigation.redirectEnd - navigation.redirectStart : 0,
    fetch: navigation?.fetchStart ? navigation.fetchStart - navigation.startTime : 0,
    worker: navigation?.workerStart ? navigation.workerStart - navigation.startTime : 0,
  }
}

/**
 * Track resource loading performance
 */
export function getResourceTiming(): Array<Record<string, unknown>> {
  if (typeof performance === 'undefined') return []

  const resources = performance.getEntriesByType('resource')
  return resources.map((resource) => ({
    name: resource.name,
    type: (resource as PerformanceResourceTiming).initiatorType,
    duration: resource.duration,
    size: (resource as PerformanceResourceTiming).transferSize,
    startTime: resource.startTime,
  }))
}

/**
 * Cleanup performance observers
 */
export function cleanupPerformanceTracking() {
  observers.forEach(obs => obs.disconnect())
  observers = []
}
