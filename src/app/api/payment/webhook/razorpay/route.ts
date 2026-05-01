export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getGateway } from '@/lib/payment'
import { logger } from '@/lib/logger'

const isDev = process.env.NODE_ENV === 'development'

/**
 * POST /api/payment/webhook/razorpay
 * Handle Razorpay webhook events
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || ''

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    const gateway = await getGateway('razorpay')
    if (!gateway) {
      return NextResponse.json(
        { error: 'Razorpay gateway not configured' },
        { status: 503 }
      )
    }

    let event
    try {
      event = await gateway.handleWebhook(body, signature)
    } catch (error) {
      logger.debug({ error }, 'Webhook verification failed')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    const eventData = event.data
    const eventType = event.type

    logger.debug({ eventType }, 'Processing Razorpay webhook event')

    switch (eventType) {
      case 'payment.authorized':
      case 'payment.captured': {
        const payment = eventData.payment

        // Update transaction status
        const transaction = await prisma.paymentTransaction.findFirst({
          where: { gatewayTransactionId: payment.order_id },
        })

        if (transaction) {
          await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: {
              status: 'success',
              gatewayTransactionId: payment.id,
              updatedAt: new Date(),
            },
          })

          // Update user's subscription
          const metadata = payment.notes || {}
          if (metadata.userId) {
            const razorpayCustomer = await prisma.user.findUnique({
              where: { id: metadata.userId },
            })

            await prisma.user.update({
              where: { id: metadata.userId },
              data: {
                subscriptionStatus: 'premium',
                subscriptionPlan: metadata.planId,
                razorpayCustomerId: payment.customer_id || razorpayCustomer?.razorpayCustomerId,
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              },
            })
          }
        }

        break
      }

      case 'payment.failed': {
        const payment = eventData.payment

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: payment.order_id },
          data: {
            status: 'failed',
            errorCode: payment.error_code || 'payment_failed',
            errorMessage: payment.error_description || 'Payment failed',
          },
        })

        break
      }

      case 'subscription.activated': {
        const subscription = eventData.subscription

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: subscription.id },
          data: {
            status: 'success',
          },
        })

        // Update user subscription status
        const metadata = subscription.notes || {}
        if (metadata.userId) {
          await prisma.user.update({
            where: { id: metadata.userId },
            data: {
              subscriptionStatus: 'premium',
              subscriptionPlan: metadata.planId,
              currentPeriodEnd: new Date(subscription.end_at * 1000),
            },
          })
        }

        break
      }

      case 'subscription.cancelled': {
        const subscription = eventData.subscription

        const metadata = subscription.notes || {}
        if (metadata.userId) {
          await prisma.user.update({
            where: { id: metadata.userId },
            data: {
              subscriptionStatus: 'cancelled',
            },
          })
        }

        break
      }

      case 'subscription.paused':
      case 'subscription.resumed': {
        const subscription = eventData.subscription

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: subscription.id },
          data: {
            status: subscription.status === 'active' ? 'success' : 'pending',
          },
        })

        break
      }

      case 'refund.created':
      case 'refund.processed': {
        const refund = eventData.refund

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: refund.payment_id },
          data: {
            status: 'refunded',
            refundedAmount: refund.amount,
          },
        })

        break
      }

      case 'order.paid': {
        const order = eventData.order

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: order.id },
          data: {
            status: 'success',
          },
        })

        break
      }

      default:
        // Log unhandled events at debug level
        logger.debug({ eventType }, 'Unhandled Razorpay webhook event type')
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ error }, 'Error processing Razorpay webhook')
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}
