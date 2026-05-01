/**
 * Fraud Detection System
 * Simple rule-based fraud detection for payment transactions
 */

import { logger } from '@/lib/logger'

export interface FraudCheck {
  riskScore: number // 0-100
  flags: string[]
  action: 'allow' | 'review' | 'block'
  recommendations?: string[]
}

export interface FraudCheckParams {
  userId: string
  email: string
  amount: number
  currency: string
  ipAddress?: string
  userAgent?: string
  billingAddress?: {
    country?: string
    postalCode?: string
    city?: string
  }
  shippingAddress?: {
    country?: string
    postalCode?: string
    city?: string
  }
  cardFingerprint?: string
  deviceFingerprint?: string
  isFirstTransaction?: boolean
  transactionCount24h?: number
  transactionAmount24h?: number
}

// Known bad patterns
const BAD_EMAIL_DOMAINS = [
  'tempmail.com',
  'throwaway.com',
  'fakeinbox.com',
  'mailinator.com',
  'guerrillamail.com',
  'sharklasers.com',
  'spam4.me',
  'trashmail.com',
  'yopmail.com',
  'getairmail.com',
]

const HIGH_RISK_COUNTRIES = [
  'AF', 'BY', 'CF', 'CU', 'IR', 'IQ', 'KP', 'LY', 'ML', 'MM',
  'RU', 'SO', 'SS', 'SD', 'SY', 'VE', 'YE', 'ZW',
]

const VELOCITY_LIMITS = {
  transactionsPerHour: 5,
  transactionsPerDay: 10,
  amountPerHour: 50000, // cents = $500
  amountPerDay: 200000, // cents = $2000
}

/**
 * Check transaction for fraud risk
 */
export async function checkTransaction(params: FraudCheckParams): Promise<FraudCheck> {
  let score = 0
  const flags: string[] = []
  const recommendations: string[] = []

  const {
    userId,
    email,
    amount,
    currency,
    ipAddress,
    billingAddress,
    shippingAddress,
    isFirstTransaction = false,
    transactionCount24h = 0,
    transactionAmount24h = 0,
  } = params

  // 1. Check amount thresholds
  const maxTransactionAmount = parseInt(process.env.MAX_TRANSACTION_AMOUNT || '100000') // Default $1000
  if (amount > maxTransactionAmount) {
    score += 30
    flags.push('amount_exceeds_limit')
    recommendations.push('Require manual review for large amounts')
  }

  // 2. Check for suspicious amounts (common test amounts)
  const suspiciousAmounts = [100, 999, 1000, 1337, 666, 1234]
  if (suspiciousAmounts.includes(amount)) {
    score += 10
    flags.push('suspicious_amount')
  }

  // 3. Email domain check
  const emailDomain = email.split('@')[1]?.toLowerCase()
  if (emailDomain && BAD_EMAIL_DOMAINS.includes(emailDomain)) {
    score += 25
    flags.push('temporary_email')
    recommendations.push('Block disposable email addresses')
  }

  // 4. High-risk country check
  if (billingAddress?.country && HIGH_RISK_COUNTRIES.includes(billingAddress.country)) {
    score += 20
    flags.push('high_risk_country')
    recommendations.push('Additional verification required for high-risk countries')
  }

  // 5. Billing/Shipping address mismatch
  if (billingAddress && shippingAddress) {
    if (billingAddress.country !== shippingAddress.country) {
      score += 15
      flags.push('address_country_mismatch')
    }
    if (billingAddress.postalCode !== shippingAddress.postalCode) {
      score += 10
      flags.push('address_postal_mismatch')
    }
  }

  // 6. Velocity checks
  if (transactionCount24h > VELOCITY_LIMITS.transactionsPerDay) {
    score += 25
    flags.push('velocity_exceeded_daily_count')
    recommendations.push('Limit number of daily transactions')
  }

  if (transactionAmount24h > VELOCITY_LIMITS.amountPerDay) {
    score += 25
    flags.push('velocity_exceeded_daily_amount')
    recommendations.push('Limit daily transaction volume')
  }

  // 7. First transaction check
  if (isFirstTransaction && amount > 5000) { // > $50
    score += 15
    flags.push('high_amount_first_transaction')
    recommendations.push('Require additional verification for first-time large transactions')
  }

  // 8. IP geolocation vs billing address (simplified)
  // In production, use a geolocation service
  if (ipAddress && billingAddress?.country) {
    // This is a placeholder for actual IP geolocation
    // const ipCountry = await getIpCountry(ipAddress)
    // if (ipCountry && ipCountry !== billingAddress.country) {
    //   score += 15
    //   flags.push('ip_billing_country_mismatch')
    // }
  }

  // 9. Check for rapid successive transactions (velocity)
  if (transactionCount24h > VELOCITY_LIMITS.transactionsPerHour) {
    score += 20
    flags.push('velocity_exceeded_hourly_count')
  }

  // 10. Anonymous proxy/VPN detection (placeholder)
  // In production, use a service like MaxMind or IP2Proxy
  // if (await isAnonymousProxy(ipAddress)) {
  //   score += 15
  //   flags.push('anonymous_proxy')
  // }

  // Determine action based on score
  let action: 'allow' | 'review' | 'block' = 'allow'
  if (score >= 80) {
    action = 'block'
  } else if (score >= 40) {
    action = 'review'
  }

  logger.debug(
    {
      userId,
      riskScore: score,
      flags,
      action,
    },
    'Fraud check completed'
  )

  return {
    riskScore: Math.min(score, 100),
    flags,
    action,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  }
}

/**
 * Check if a card fingerprint has been flagged
 */
export async function isCardFlagged(cardFingerprint: string): Promise<boolean> {
  // In production, check against a database of flagged cards
  // This could be integrated with a third-party fraud service
  return false
}

/**
 * Check if an email has been flagged
 */
export async function isEmailFlagged(email: string): Promise<boolean> {
  // In production, check against a database of flagged emails
  return false
}

/**
 * Flag a transaction for manual review
 */
export async function flagForReview(
  transactionId: string,
  reason: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  logger.warn(
    {
      transactionId,
      reason,
      ...metadata,
    },
    'Transaction flagged for review'
  )

  // In production, send notification to admin, add to review queue, etc.
}

/**
 * Report fraud detection result to external service
 */
export async function reportToFraudService(
  params: FraudCheckParams,
  result: FraudCheck
): Promise<void> {
  if (process.env.FRAUD_DETECTION_ENABLED !== 'true') {
    return
  }

  // In production, integrate with Sift, Kount, Signifyd, etc.
  logger.debug(
    {
      userId: params.userId,
      riskScore: result.riskScore,
      action: result.action,
    },
    'Fraud check reported'
  )
}

/**
 * Get velocity data for a user
 * Returns transaction counts and amounts for time windows
 */
export async function getVelocityData(userId: string): Promise<{
  count1h: number
  count24h: number
  amount1h: number
  amount24h: number
}> {
  // In production, query database for actual velocity data
  // For now, return defaults
  return {
    count1h: 0,
    count24h: 0,
    amount1h: 0,
    amount24h: 0,
  }
}

/**
 * Check device fingerprint reputation
 */
export async function checkDeviceReputation(deviceFingerprint: string): Promise<{
  riskScore: number
  isKnownGood: boolean
  isKnownBad: boolean
}> {
  // In production, integrate with device fingerprinting service
  return {
    riskScore: 0,
    isKnownGood: false,
    isKnownBad: false,
  }
}
