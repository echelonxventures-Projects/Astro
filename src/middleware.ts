/**
 * Next.js Middleware for StarPath Astrology
 * Handles security headers, rate limiting, and request logging
 */

import { NextResponse, NextRequest } from 'next/server'
import { logger, logSecurity } from './lib/logger'
import {
  checkRateLimitForPath,
  getRateLimitHeaders,
  type RateLimitResult,
} from './lib/rate-limiter'
import {
  generateNonce,
  generateRequestId,
  getClientIp,
  isSuspiciousUserAgent,
  SECURITY_HEADERS,
  generateCspHeader,
} from './lib/security'

// ============================================================================
// Configuration
// ============================================================================

// Paths that bypass rate limiting
const RATE_LIMIT_EXEMPT_PATHS = [
  '/_next',
  '/static',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/health',
  '/api/health',
]

// Paths that are always public (for future use in auth middleware)
// const PUBLIC_PATHS = [
//   '/',
//   '/login',
//   '/register',
//   '/forgot-password',
//   '/reset-password',
//   '/about',
//   '/pricing',
//   '/privacy',
//   '/terms',
//   '/api/auth',
//   '/api/webhook',
// ];

// File extensions to skip middleware processing
const STATIC_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.json',
  '.xml',
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if path should bypass rate limiting
 */
function isRateLimitExempt(path: string): boolean {
  return RATE_LIMIT_EXEMPT_PATHS.some(exempt => path.startsWith(exempt) || path === exempt)
}

/**
 * Check if path is a static file
 */
function isStaticFile(path: string): boolean {
  return STATIC_EXTENSIONS.some(ext => path.endsWith(ext))
}

/**
 * Get user identifier for rate limiting
 * Combines IP and user ID if available
 */
function getUserIdentifier(request: NextRequest): string {
  const ip = getClientIp(Object.fromEntries(request.headers.entries()))
  const userId = request.cookies.get('user_id')?.value

  if (userId) {
    return `${ip}:${userId}`
  }

  return ip
}

/**
 * Log security event with context
 */
function logSecurityEvent(
  event: string,
  severity: 'info' | 'warn' | 'error',
  request: NextRequest,
  context?: Record<string, unknown>
): void {
  logSecurity(event, severity, {
    path: request.nextUrl.pathname,
    method: request.method,
    ip: getClientIp(Object.fromEntries(request.headers.entries())),
    userAgent: request.headers.get('user-agent')?.slice(0, 200),
    requestId: request.headers.get('x-request-id'),
    ...context,
  })
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(result: RateLimitResult, requestId: string): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        ...getRateLimitHeaders(result),
        'X-Request-Id': requestId,
      },
    }
  )

  return response
}

/**
 * Create forbidden response for suspicious requests
 */
function createForbiddenResponse(requestId: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      message: 'Request blocked due to security policy',
    },
    {
      status: 403,
      headers: {
        'X-Request-Id': requestId,
      },
    }
  )
}

// ============================================================================
// Main Middleware
// ============================================================================

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now()
  const requestId = generateRequestId()
  const path = request.nextUrl.pathname
  const method = request.method

  // Generate CSP nonce for this request
  const nonce = generateNonce()

  // Skip middleware for static files
  if (isStaticFile(path)) {
    return NextResponse.next()
  }

  // Check for suspicious user agents
  const userAgent = request.headers.get('user-agent')
  if (isSuspiciousUserAgent(userAgent)) {
    logSecurityEvent('suspicious_user_agent', 'warn', request, {
      userAgent: userAgent?.slice(0, 200),
    })

    return createForbiddenResponse(requestId)
  }

  // Check rate limit for this request (disabled only in CI e2e via RATE_LIMIT_DISABLED)
  if (process.env.RATE_LIMIT_DISABLED !== 'true' && !isRateLimitExempt(path)) {
    const identifier = getUserIdentifier(request)
    const rateLimitResult = await checkRateLimitForPath(identifier, path)

    if (!rateLimitResult.allowed) {
      logSecurityEvent('rate_limit_exceeded', 'warn', request, {
        identifier: identifier.slice(0, 50), // Partial for privacy
        retryAfter: rateLimitResult.retryAfter,
      })

      return createRateLimitResponse(rateLimitResult, requestId)
    }

    // Continue with rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult)

    // Process the request
    const response = await processRequest(request, requestId, nonce)

    // Add rate limit headers to response
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    // Log request completion
    const duration = Math.round(performance.now() - startTime)
    logger.info(
      {
        requestId,
        method,
        path,
        duration,
        rateLimitRemaining: rateLimitResult.remaining,
      },
      `${method} ${path} - ${duration}ms`
    )

    return response
  }

  // Process without rate limiting
  const response = await processRequest(request, requestId, nonce)

  const duration = Math.round(performance.now() - startTime)
  logger.debug(
    {
      requestId,
      method,
      path,
      duration,
    },
    `${method} ${path} - ${duration}ms (exempt)`
  )

  return response
}

/**
 * Process the request and add security headers
 */
async function processRequest(
  request: NextRequest,
  requestId: string,
  nonce: string
): Promise<NextResponse> {
  // Clone headers and add request ID
  const headers = new Headers(request.headers)
  headers.set('x-request-id', requestId)
  // Next.js reads the CSP from the request headers to extract the nonce
  // and inject it into its own <script> tags (documented pattern)
  headers.set('content-security-policy', generateCspHeader(nonce))

  // Create modified request
  const modifiedRequest = new NextRequest(request.url, {
    headers,
    method: request.method,
    body: request.body,
    cache: request.cache,
    credentials: request.credentials,
    integrity: request.integrity,
    keepalive: request.keepalive,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
  })

  // Get the response
  const response = NextResponse.next({
    request: modifiedRequest,
  })

  // Add security headers
  addSecurityHeaders(response, nonce)

  // Add request ID to response
  response.headers.set('X-Request-Id', requestId)

  return response
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse, nonce: string): void {
  // Add standard security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add Content Security Policy with nonce
  const cspHeader = generateCspHeader(nonce)
  response.headers.set('Content-Security-Policy', cspHeader)

  // Add additional headers
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Download-Options', 'noopen')
}

// ============================================================================
// Matcher Configuration
// ============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-action' },
        { type: 'header', key: 'next-router-prefetch' },
      ],
    },
  ],
}
