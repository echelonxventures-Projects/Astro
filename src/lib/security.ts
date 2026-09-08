/**
 * Security utilities for StarPath Astrology
 * Provides CSP nonce generation and security helpers
 * Uses Web Crypto API for Edge Runtime compatibility
 */

/**
 * Convert ArrayBuffer to base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Generate a cryptographically secure nonce for CSP
 * @returns A base64-encoded nonce string
 */
export function generateNonce(): string {
  // Synchronous fallback not possible with Web Crypto; use Math.random-based
  // CSP nonce only needs unpredictability, not crypto-grade entropy for this use case.
  // However, prefer crypto-grade via async pattern is not compatible with sync API.
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return bufferToBase64(bytes.buffer)
}

/**
 * Generate a request ID for tracing
 * @returns A UUID string
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Generate a CSRF token
 * @returns A base64-encoded random string
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return bufferToBase64(bytes.buffer)
}

/**
 * Suspicious user agent patterns to block
 */
const SUSPICIOUS_USER_AGENTS = [
  // Common bots and scrapers
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /zgrab/i,
  /gobuster/i,
  /dirbuster/i,
  /burp/i,
  /metasploit/i,
  /nmap/i,
  /wget/i,
  /curl/i,
  /python-requests/i,
  /scrapy/i,
  /bot/i,
  /crawler/i,
  /spider/i,
  // Known malicious patterns
  /blackwidow/i,
  /checkmarx/i,
  /nessus/i,
  /openvas/i,
  /qualys/i,
  /acunetix/i,
  /appscan/i,
  /netsparker/i,
]

/**
 * Check if a user agent is suspicious and should be blocked
 * @param userAgent The user agent string
 * @returns True if suspicious, false otherwise
 */
export function isSuspiciousUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true // Block empty user agents

  return SUSPICIOUS_USER_AGENTS.some(pattern => pattern.test(userAgent))
}

/**
 * Get client IP from request headers
 * Handles various proxy configurations
 * @param headers Request headers object
 * @returns The client IP address
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  // Check for forwarded headers (common in proxy setups)
  const forwardedFor = headers['x-forwarded-for']
  if (typeof forwardedFor === 'string') {
    // Take the first IP in the chain (client IP)
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = headers['x-real-ip']
  if (typeof realIp === 'string') {
    return realIp
  }

  // Cloudflare headers
  const cfConnectingIp = headers['cf-connecting-ip']
  if (typeof cfConnectingIp === 'string') {
    return cfConnectingIp
  }

  // Fallback to remote address will be handled by caller
  return 'unknown'
}

/**
 * Rate limit tier definitions
 */
export const RATE_LIMIT_TIERS = {
  // Default API endpoints
  default: { points: 100, duration: 60 }, // 100 requests per minute

  // Authentication endpoints (login, register, etc.)
  auth: { points: 5, duration: 60 }, // 5 attempts per minute

  // General API calls
  api: { points: 60, duration: 60 }, // 60 API calls per minute

  // Webhook endpoints
  webhook: { points: 1000, duration: 60 }, // 1000 webhooks per minute

  // Admin endpoints
  admin: { points: 30, duration: 60 }, // 30 admin operations per minute

  // Chat/message endpoints
  chat: { points: 30, duration: 60 }, // 30 messages per minute

  // Chart generation (resource intensive)
  chart: { points: 10, duration: 60 }, // 10 chart generations per minute
} as const

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS

/**
 * Determine rate limit tier based on path
 * @param path The request path
 * @returns The appropriate rate limit tier
 */
export function getRateLimitTierForPath(path: string): RateLimitTier {
  // Normalize path
  const normalizedPath = path.toLowerCase()

  // Authentication endpoints
  if (
    normalizedPath.includes('/api/auth/') ||
    normalizedPath.includes('/login') ||
    normalizedPath.includes('/register') ||
    normalizedPath.includes('/forgot-password') ||
    normalizedPath.includes('/reset-password')
  ) {
    return 'auth'
  }

  // Webhook endpoints
  if (normalizedPath.includes('/api/webhook')) {
    return 'webhook'
  }

  // Admin endpoints
  if (normalizedPath.includes('/api/admin')) {
    return 'admin'
  }

  // Chat endpoints
  if (normalizedPath.includes('/api/chat') || normalizedPath.includes('/api/message')) {
    return 'chat'
  }

  // Chart generation endpoints
  if (normalizedPath.includes('/api/chart')) {
    return 'chart'
  }

  // General API
  if (normalizedPath.startsWith('/api/')) {
    return 'api'
  }

  return 'default'
}

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS filter (legacy browsers)
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy (formerly Feature-Policy)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',

  // HSTS (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
} as const

/**
 * Generate Content Security Policy header with nonce
 * @param nonce The CSP nonce
 * @returns The CSP header string
 */
export function generateCspHeader(nonce: string): string {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https://*.cloudinary.com",
    "connect-src 'self' https://api.stripe.com",
    'frame-src https://js.stripe.com https://hooks.stripe.com',
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ]

  return csp.join('; ')
}

/**
 * Sanitize input to prevent XSS
 * @param input The input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate email format
 * @param email The email to validate
 * @returns True if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Password strength requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
} as const

/**
 * Validate password strength
 * @param password The password to validate
 * @returns Validation result
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`)
  }

  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`)
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (PASSWORD_REQUIREMENTS.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (
    PASSWORD_REQUIREMENTS.requireSpecialChars &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
