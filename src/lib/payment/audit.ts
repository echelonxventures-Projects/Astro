/**
 * Payment Audit Logging
 * Comprehensive audit trail for all payment operations
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'

export interface AuditEntry {
  action: AuditAction
  userId?: string
  transactionId?: string
  gateway?: string
  amount?: number
  currency?: string
  status: AuditStatus
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  error?: string
}

export type AuditAction =
  | 'payment_intent_created'
  | 'payment_intent_confirmed'
  | 'payment_intent_failed'
  | 'payment_captured'
  | 'payment_refunded'
  | 'payment_disputed'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted'
  | 'webhook_received'
  | 'webhook_processed'
  | 'webhook_failed'
  | 'fraud_check'
  | 'fraud_blocked'
  | 'fraud_review'
  | 'refund_requested'
  | 'refund_processed'
  | 'chargeback_received'
  | 'chargeback_responded'
  | 'security_alert'
  | 'admin_action'

export type AuditStatus = 'success' | 'failure' | 'pending' | 'warning'

/**
 * Log a payment audit event
 */
export async function logPaymentAudit(entry: AuditEntry): Promise<void> {
  const timestamp = new Date()

  // Log to structured logger
  logger.info(
    {
      type: 'payment_audit',
      timestamp: timestamp.toISOString(),
      ...entry,
    },
    `Payment Audit: ${entry.action}`
  )

  // Store in database if available
  try {
    await prisma.paymentAuditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId,
        transactionId: entry.transactionId,
        gateway: entry.gateway,
        amount: entry.amount,
        currency: entry.currency,
        status: entry.status,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        error: entry.error,
        createdAt: timestamp,
      },
    })
  } catch (error) {
    // Don't fail the operation if audit logging fails
    // But log the error
    logger.error(
      {
        error,
        entry,
      },
      'Failed to store payment audit log'
    )
  }
}

/**
 * Log webhook event
 */
export async function logWebhookEvent(
  gateway: string,
  eventType: string,
  eventId: string,
  status: AuditStatus,
  metadata?: Record<string, unknown>,
  error?: string
): Promise<void> {
  await logPaymentAudit({
    action: status === 'success' ? 'webhook_processed' : 'webhook_failed',
    gateway,
    status,
    metadata: {
      eventType,
      eventId,
      ...metadata,
    },
    error,
  })
}

/**
 * Log transaction event
 */
export async function logTransaction(
  action: AuditAction,
  params: {
    userId?: string
    transactionId?: string
    gateway?: string
    amount?: number
    currency?: string
    status: AuditStatus
    ipAddress?: string
    metadata?: Record<string, unknown>
    error?: string
  }
): Promise<void> {
  await logPaymentAudit({
    action,
    ...params,
  })
}

/**
 * Log fraud detection event
 */
export async function logFraudCheck(
  params: {
    userId: string
    transactionId?: string
    riskScore: number
    action: 'allow' | 'review' | 'block'
    flags: string[]
    ipAddress?: string
  }
): Promise<void> {
  const auditAction: AuditAction =
    params.action === 'block' ? 'fraud_blocked' : 'fraud_review'

  await logPaymentAudit({
    action: params.action === 'allow' ? 'fraud_check' : auditAction,
    userId: params.userId,
    transactionId: params.transactionId,
    status: params.action === 'allow' ? 'success' : 'warning',
    ipAddress: params.ipAddress,
    metadata: {
      riskScore: params.riskScore,
      flags: params.flags,
      action: params.action,
    },
  })
}

/**
 * Log refund event
 */
export async function logRefund(
  params: {
    userId?: string
    transactionId: string
    gateway: string
    amount: number
    currency: string
    reason?: string
    status: AuditStatus
    ipAddress?: string
  }
): Promise<void> {
  await logPaymentAudit({
    action: 'refund_processed',
    userId: params.userId,
    transactionId: params.transactionId,
    gateway: params.gateway,
    amount: params.amount,
    currency: params.currency,
    status: params.status,
    ipAddress: params.ipAddress,
    metadata: {
      reason: params.reason,
    },
  })
}

/**
 * Log subscription event
 */
export async function logSubscription(
  action: Extract<AuditAction, `subscription_${string}`>,
  params: {
    userId: string
    subscriptionId?: string
    gateway?: string
    planId?: string
    status: AuditStatus
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await logPaymentAudit({
    action,
    userId: params.userId,
    transactionId: params.subscriptionId,
    gateway: params.gateway,
    status: params.status,
    metadata: {
      subscriptionId: params.subscriptionId,
      planId: params.planId,
      ...params.metadata,
    },
  })
}

/**
 * Log security alert
 */
export async function logSecurityAlert(
  params: {
    alertType: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    userId?: string
    ipAddress?: string
    details: Record<string, unknown>
  }
): Promise<void> {
  await logPaymentAudit({
    action: 'security_alert',
    userId: params.userId,
    status: params.severity === 'critical' ? 'failure' : 'warning',
    ipAddress: params.ipAddress,
    metadata: {
      alertType: params.alertType,
      severity: params.severity,
      ...params.details,
    },
  })

  // For critical alerts, also log as security event
  if (params.severity === 'critical') {
    logger.error(
      {
        type: 'security_alert',
        ...params,
      },
      `CRITICAL SECURITY ALERT: ${params.alertType}`
    )
  }
}

/**
 * Log admin action
 */
export async function logAdminAction(
  params: {
    adminUserId: string
    action: string
    targetUserId?: string
    targetTransactionId?: string
    details: Record<string, unknown>
    ipAddress?: string
  }
): Promise<void> {
  await logPaymentAudit({
    action: 'admin_action',
    userId: params.adminUserId,
    transactionId: params.targetTransactionId,
    status: 'success',
    ipAddress: params.ipAddress,
    metadata: {
      action: params.action,
      targetUserId: params.targetUserId,
      ...params.details,
    },
  })
}

/**
 * Get audit trail for a user
 */
export async function getUserAuditTrail(
  userId: string,
  options?: {
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
    actions?: AuditAction[]
  }
): Promise<AuditEntry[]> {
  const {
    limit = 100,
    offset = 0,
    startDate,
    endDate,
    actions,
  } = options || {}

  const logs = await prisma.paymentAuditLog.findMany({
    where: {
      userId,
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(actions && { action: { in: actions } }),
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  })

  return logs.map((log) => ({
    action: log.action as AuditAction,
    userId: log.userId,
    transactionId: log.transactionId,
    gateway: log.gateway,
    amount: log.amount,
    currency: log.currency,
    status: log.status as AuditStatus,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
    error: log.error,
  }))
}

/**
 * Get audit trail for a transaction
 */
export async function getTransactionAuditTrail(
  transactionId: string
): Promise<AuditEntry[]> {
  const logs = await prisma.paymentAuditLog.findMany({
    where: { transactionId },
    orderBy: { createdAt: 'asc' },
  })

  return logs.map((log) => ({
    action: log.action as AuditAction,
    userId: log.userId,
    transactionId: log.transactionId,
    gateway: log.gateway,
    amount: log.amount,
    currency: log.currency,
    status: log.status as AuditStatus,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
    error: log.error,
  }))
}

/**
 * Get recent suspicious activity
 */
export async function getRecentSuspiciousActivity(
  options?: {
    limit?: number
    hours?: number
  }
): Promise<AuditEntry[]> {
  const { limit = 100, hours = 24 } = options || {}

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const logs = await prisma.paymentAuditLog.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { action: { in: ['fraud_blocked', 'fraud_review'] } },
        { status: 'warning' },
        { status: 'failure' },
        { action: 'security_alert' },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return logs.map((log) => ({
    action: log.action as AuditAction,
    userId: log.userId,
    transactionId: log.transactionId,
    gateway: log.gateway,
    amount: log.amount,
    currency: log.currency,
    status: log.status as AuditStatus,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
    error: log.error,
  }))
}
