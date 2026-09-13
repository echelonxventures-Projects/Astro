export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getGateway } from '@/lib/payment'
import { getWebhookTenant } from '@/lib/tenant'

const _isDev = process.env.NODE_ENV === 'development'

/**
 * POST /api/payment/webhook/stripe
 * Handle Stripe webhook events
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature') || ''

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const ctx = await getWebhookTenant(req)
    const gateway = await getGateway(ctx.tenantId, 'stripe')
    if (!gateway) {
      return NextResponse.json({ error: 'Stripe gateway not configured' }, { status: 503 })
    }

    let event
    try {
      event = await gateway.handleWebhook(body, signature)
    } catch (error) {
      logger.debug({ error }, 'Webhook verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const eventData = event.data
    const eventType = event.type

    logger.debug({ eventType }, 'Processing Stripe webhook event')

    switch (eventType) {
      case 'checkout.session.completed': {
        const session = eventData

        // Update transaction status
        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: session.id },
          data: {
            status: 'success',
            updatedAt: new Date(),
          },
        })

        // Update user's subscription
        const metadata = session.metadata || {}
        if (metadata.userId) {
          await prisma.user.update({
            where: { id: metadata.userId },
            data: {
              subscriptionStatus: 'premium',
              subscriptionPlan: metadata.planId,
              stripeCustomerId: session.customer as string,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            },
          })
        }

        break
      }

      case 'customer.subscription.updated': {
        const subscription = eventData

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: subscription.id },
          data: {
            status: subscription.status === 'active' ? 'success' : 'pending',
            updatedAt: new Date(),
          },
        })

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = eventData

        await prisma.user.updateMany({
          where: { tenantId: ctx.tenantId, stripeSubscriptionId: subscription.id },
          data: {
            subscriptionStatus: 'cancelled',
            currentPeriodEnd: new Date(),
          },
        })

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = eventData

        await prisma.paymentTransaction.create({
          data: {
            tenantId: ctx.tenantId,
            userId: invoice.customer,
            gatewayId: (await prisma.paymentGateway.findUnique({
              where: { tenantId_key: { tenantId: ctx.tenantId, key: 'stripe' } },
            }))!.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            gatewayTransactionId: invoice.payment_intent as string,
            status: 'success',
            paymentMethod: 'card',
          },
        })

        break
      }

      case 'invoice.payment_failed': {
        const invoice = eventData

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: invoice.payment_intent },
          data: {
            status: 'failed',
            errorCode: invoice.last_payment_error?.code || 'payment_failed',
            errorMessage: invoice.last_payment_error?.message || 'Payment failed',
          },
        })

        break
      }

      case 'charge.refunded': {
        const charge = eventData

        await prisma.paymentTransaction.updateMany({
          where: { gatewayTransactionId: charge.payment_intent },
          data: {
            status: 'refunded',
            refundedAmount: charge.amount_refunded,
            refundReason: 'requested_by_customer',
          },
        })

        break
      }

      default:
        // Log unhandled events at debug level
        logger.debug({ eventType }, 'Unhandled Stripe webhook event type')
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ error }, 'Error processing Stripe webhook')
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }
}
