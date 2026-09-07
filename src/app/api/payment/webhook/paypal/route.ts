export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getGateway } from '@/lib/payment'
import { logTransaction, logSubscription } from '@/lib/payment/audit'

const _isDev = process.env.NODE_ENV === 'development'

/**
 * POST /api/payment/webhook/paypal
 * Handle PayPal webhook events
 */
export async function POST(_req: NextRequest) {
  try {
    const body = await _req.text()
    const headers: Record<string, string> = {}
    _req.headers.forEach((value, key) => {
      headers[key] = value
    })

    const transmissionSig = headers['paypal-transmission-sig']
    const transmissionId = headers['paypal-transmission-id']
    const _certUrl = headers['paypal-cert-url']
    const _authAlgo = headers['paypal-auth-algo']
    const _transmissionTime = headers['paypal-transmission-time']

    if (!transmissionSig) {
      logger.warn('Missing PayPal webhook signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const gateway = await getGateway('paypal')
    if (!gateway) {
      logger.warn('PayPal gateway not configured')
      return NextResponse.json({ error: 'PayPal gateway not configured' }, { status: 503 })
    }

    let event
    try {
      event = await gateway.handleWebhook(body, transmissionSig)
    } catch (error) {
      logger.debug({ error }, 'PayPal webhook verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const eventData = event.data
    const eventType = event.type

    logger.debug({ eventType, transmissionId }, 'Processing PayPal webhook event')

    switch (eventType) {
      // Payment events
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const capture = eventData
        const orderId = capture.links
          ?.find((l: any) => l.rel === 'up')
          ?.href?.split('/')
          .pop()

        // Update transaction status
        if (orderId) {
          await prisma.paymentTransaction.updateMany({
            where: { gatewayTransactionId: orderId },
            data: {
              status: 'success',
              gatewayTransactionId: capture.id,
              updatedAt: new Date(),
            },
          })
        }

        // Get the custom_id (userId) from the parent order
        const customId = capture.custom_id
        if (customId) {
          await prisma.user.update({
            where: { id: customId },
            data: {
              subscriptionStatus: 'premium',
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          })
        }

        await logTransaction('payment_captured', {
          gateway: 'paypal',
          amount: parseFloat(capture.amount.value) * 100,
          currency: capture.amount.currency_code,
          status: 'success',
          metadata: {
            captureId: capture.id,
            orderId,
            customId,
          },
        })

        break
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const capture = eventData
        const orderId = capture.links
          ?.find((l: any) => l.rel === 'up')
          ?.href?.split('/')
          .pop()

        if (orderId) {
          await prisma.paymentTransaction.updateMany({
            where: { gatewayTransactionId: orderId },
            data: {
              status: 'failed',
              errorCode: capture.reason_code || 'capture_denied',
              errorMessage: capture.message || 'Payment capture failed',
              updatedAt: new Date(),
            },
          })
        }

        await logTransaction('payment_intent_failed', {
          gateway: 'paypal',
          amount: parseFloat(capture.amount?.value || '0') * 100,
          currency: capture.amount?.currency_code,
          status: 'failure',
          error: capture.message || 'Capture denied',
          metadata: {
            captureId: capture.id,
            orderId,
            reason: capture.reason_code,
          },
        })

        break
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        const refund = eventData
        const captureId = refund.links
          ?.find((l: any) => l.rel === 'up')
          ?.href?.split('/')
          .pop()

        if (captureId) {
          await prisma.paymentTransaction.updateMany({
            where: { gatewayTransactionId: captureId },
            data: {
              status: 'refunded',
              refundedAmount: parseFloat(refund.amount?.value || '0') * 100,
              refundReason: refund.note_to_payer || 'customer_request',
              updatedAt: new Date(),
            },
          })
        }

        await logTransaction('refund_processed', {
          gateway: 'paypal',
          amount: parseFloat(refund.amount?.value || '0') * 100,
          currency: refund.amount?.currency_code,
          status: 'success',
          metadata: {
            refundId: refund.id,
            captureId,
            reason: refund.note_to_payer,
          },
        })

        break
      }

      // Subscription events
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subscription = eventData
        const customId = subscription.custom_id

        // Find and update subscription
        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: subscription.id },
          data: {
            status: 'success',
            updatedAt: new Date(),
          },
        })

        if (customId) {
          await prisma.user.update({
            where: { id: customId },
            data: {
              subscriptionStatus: 'premium',
              subscriptionPlan: subscription.plan_id,
              currentPeriodEnd: new Date(
                subscription.billing_info?.next_billing_time ||
                  Date.now() + 30 * 24 * 60 * 60 * 1000
              ),
            },
          })
        }

        await logSubscription('subscription_created', {
          userId: customId,
          subscriptionId: subscription.id,
          gateway: 'paypal',
          planId: subscription.plan_id,
          status: 'success',
          metadata: {
            subscriberEmail: subscription.subscriber?.email_address,
          },
        })

        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const subscription = eventData
        const customId = subscription.custom_id

        if (customId) {
          await prisma.user.update({
            where: { id: customId },
            data: {
              subscriptionStatus: 'cancelled',
              currentPeriodEnd: new Date(),
            },
          })
        }

        await logSubscription('subscription_cancelled', {
          userId: customId,
          subscriptionId: subscription.id,
          gateway: 'paypal',
          status: 'success',
          metadata: {
            reason: subscription.status_update_note,
          },
        })

        break
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const subscription = eventData
        const customId = subscription.custom_id

        if (customId) {
          await prisma.user.update({
            where: { id: customId },
            data: {
              subscriptionStatus: 'past_due',
            },
          })
        }

        await logSubscription('subscription_updated', {
          userId: customId,
          subscriptionId: subscription.id,
          gateway: 'paypal',
          status: 'pending',
          metadata: {
            reason: 'suspended',
          },
        })

        break
      }

      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        const subscription = eventData
        const customId = subscription.custom_id

        if (customId) {
          await prisma.user.update({
            where: { id: customId },
            data: {
              subscriptionStatus: 'cancelled',
              currentPeriodEnd: new Date(),
            },
          })
        }

        await logSubscription('subscription_expired', {
          userId: customId,
          subscriptionId: subscription.id,
          gateway: 'paypal',
          status: 'success',
        })

        break
      }

      case 'BILLING.SUBSCRIPTION.UPDATED': {
        const subscription = eventData
        const customId = subscription.custom_id

        if (customId) {
          await prisma.user.update({
            where: { id: customId },
            data: {
              currentPeriodEnd: new Date(
                subscription.billing_info?.next_billing_time ||
                  Date.now() + 30 * 24 * 60 * 60 * 1000
              ),
            },
          })
        }

        await logSubscription('subscription_updated', {
          userId: customId,
          subscriptionId: subscription.id,
          gateway: 'paypal',
          planId: subscription.plan_id,
          status: 'success',
        })

        break
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        const subscription = eventData
        const customId = subscription.custom_id

        if (customId) {
          await prisma.user.update({
            where: { id: customId },
            data: {
              subscriptionStatus: 'past_due',
            },
          })
        }

        await logSubscription('subscription_updated', {
          userId: customId,
          subscriptionId: subscription.id,
          gateway: 'paypal',
          status: 'failure',
          metadata: {
            reason: 'payment_failed',
            nextBillingTime: subscription.billing_info?.next_billing_time,
            failedPayments: subscription.billing_info?.failed_payments_count,
          },
        })

        break
      }

      // Dispute events
      case 'CUSTOMER.DISPUTE.CREATED': {
        const dispute = eventData

        // Create a dispute record
        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: dispute.disputed_transaction?.id },
          data: {
            status: 'disputed',
            errorMessage: `Dispute: ${dispute.reason}`,
            updatedAt: new Date(),
          },
        })

        logger.warn(
          {
            disputeId: dispute.id,
            reason: dispute.reason,
            amount: dispute.dispute_amount?.value,
          },
          'PayPal dispute created'
        )

        break
      }

      case 'CUSTOMER.DISPUTE.RESOLVED': {
        const dispute = eventData

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: dispute.disputed_transaction?.id },
          data: {
            status: dispute.status === 'RESOLVED_IN_SELLER_FAVOR' ? 'success' : 'failed',
            updatedAt: new Date(),
          },
        })

        break
      }

      // Payout events (for marketplace/adaptive payments)
      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED': {
        const payout = eventData

        logger.info(
          {
            payoutItemId: payout.payout_item_id,
            amount: payout.payout_item?.amount?.value,
          },
          'PayPal payout succeeded'
        )

        break
      }

      case 'PAYMENT.PAYOUTS-ITEM.FAILED': {
        const payout = eventData

        logger.error(
          {
            payoutItemId: payout.payout_item_id,
            error: payout.errors?.message,
          },
          'PayPal payout failed'
        )

        break
      }

      default:
        // Log unhandled events at debug level
        logger.debug({ eventType }, 'Unhandled PayPal webhook event type')
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ error }, 'Error processing PayPal webhook')
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }
}

/**
 * GET /api/payment/webhook/paypal
 * Used for webhook verification
 */
export async function GET(_req: NextRequest) {
  // PayPal may send GET requests to verify the webhook endpoint
  return NextResponse.json({
    status: 'active',
    gateway: 'paypal',
    timestamp: new Date().toISOString(),
  })
}
