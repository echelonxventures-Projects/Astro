'use client'

import { createContext, useContext, useEffect, useCallback, ReactNode } from 'react'
import { initPerformanceTracking, reportWebVitals, cleanupPerformanceTracking } from '@/lib/monitoring/performance'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

interface MonitoringContextType {
  trackEvent: (eventName: string, properties?: Record<string, unknown>) => void
  trackError: (error: Error, context?: Record<string, unknown>) => void
  trackPageView: (pageName: string, properties?: Record<string, unknown>) => void
  setUserProperties: (properties: Record<string, unknown>) => void
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined)

interface MonitoringProviderProps {
  children: ReactNode
  userId?: string
  userProperties?: Record<string, unknown>
}

/**
 * Monitoring Provider Component
 * Initializes performance tracking and provides monitoring utilities
 */
export function MonitoringProvider({
  children,
  userId,
  userProperties,
}: MonitoringProviderProps): JSX.Element {
  // Initialize performance tracking on mount
  useEffect(() => {
    initPerformanceTracking()

    // Report Next.js web vitals
    const reportWebVitalsHandler = (metric: {
      name: string
      value: number
      id: string
      label: string
    }) => {
      reportWebVitals({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        delta: metric.value,
        entries: [],
      })
    }

    // Make handler available globally for Next.js
    if (typeof window !== 'undefined') {
      (window as unknown as { webVitals: typeof reportWebVitalsHandler }).webVitals = reportWebVitalsHandler
    }

    return () => {
      cleanupPerformanceTracking()
    }
  }, [])

  // Set Sentry user context when userId changes
  useEffect(() => {
    if (userId) {
      Sentry.setUser({
        id: userId,
        ...(userProperties || {}),
      })
    } else {
      Sentry.setUser(null)
    }
  }, [userId, userProperties])

  const trackEvent = useCallback((eventName: string, properties?: Record<string, unknown>) => {
    // Track with Sentry
    Sentry.addBreadcrumb({
      category: 'analytics',
      message: eventName,
      data: properties,
      level: 'info',
    })

    // Send to analytics if configured
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', eventName, properties)
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug({ event: eventName, properties }, '[Analytics]')
    }
  }, [])

  const trackError = useCallback((error: Error, context?: Record<string, unknown>) => {
    Sentry.captureException(error, {
      contexts: {
        additional: context || {},
      },
    })

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      logger.error({ error: error.message, context }, '[Analytics Error]')
    }
  }, [])

  const trackPageView = useCallback((pageName: string, properties?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `Page view: ${pageName}`,
      data: properties,
      level: 'info',
    })

    // Send to analytics if configured
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
        page_title: pageName,
        page_location: typeof window !== 'undefined' ? window.location.href : '',
        ...properties,
      })
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug({ page: pageName, properties }, '[Page View]')
    }
  }, [])

  const setUserProps = useCallback((properties: Record<string, unknown>) => {
    Sentry.setUser({
      id: userId,
      ...properties,
    })
  }, [userId])

  const value: MonitoringContextType = {
    trackEvent,
    trackError,
    trackPageView,
    setUserProperties: setUserProps,
  }

  return (
    <MonitoringContext.Provider value={value}>
      {children}
    </MonitoringContext.Provider>
  )
}

/**
 * Hook to use monitoring context
 */
export function useMonitoring() {
  const context = useContext(MonitoringContext)
  if (context === undefined) {
    throw new Error('useMonitoring must be used within a MonitoringProvider')
  }
  return context
}

/**
 * Hook for tracking page views
 */
export function usePageTracking(pageName: string, properties?: Record<string, unknown>) {
  const { trackPageView } = useMonitoring()

  useEffect(() => {
    trackPageView(pageName, properties)
  }, [trackPageView, pageName, properties])
}

/**
 * Hook for tracking component events
 */
export function useEventTracking(eventName: string) {
  const { trackEvent } = useMonitoring()

  return useCallback(
    (properties?: Record<string, unknown>) => {
      trackEvent(eventName, properties)
    },
    [trackEvent, eventName]
  )
}

export default MonitoringProvider
