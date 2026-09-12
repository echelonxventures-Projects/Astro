export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Stripe } from 'stripe'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const _isDev = process.env.NODE_ENV === 'development'

/**
 * Stripe Webhook Handler
 * Processes subscription events from Stripe
 */
export async function POST(req: NextRequest) {
  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    logger.debug('Stripe not configured - webhook ignored')
    return NextResponse.json({ received: true })
  }

  // Lazy import Stripe to avoid initialization at build time
  const { stripe, handleWebhookEvent } = await import('@/lib/stripe')

  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature') || ''

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '')
  } catch (error) {
    logger.debug({ error }, 'Webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const result = await handleWebhookEvent(event)

    switch (result.type) {
      case 'checkout_completed': {
        const { userId, subscriptionId, customerId, plan } = result

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'premium',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionPlan: plan,
          },
        })

        const subscription = await stripe.subscriptions.retrieve(subscriptionId!)

        const hookUser = await prisma.user.findUnique({
          where: { id: userId! },
          select: { tenantId: true },
        })
        if (!hookUser) break

        await prisma.subscription.create({
          data: {
            tenantId: hookUser.tenantId,
            userId: userId!,
            stripeSubscriptionId: subscriptionId!,
            plan: plan!,
            status: subscription.status,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          },
        })

        break
      }

      case 'subscription_updated': {
        const { subscriptionId, status, currentPeriodEnd, plan } = result

        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            status,
            currentPeriodEnd,
            plan,
          },
        })

        if (status === 'active') {
          await prisma.user.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { subscriptionStatus: 'premium' },
          })
        } else if (status === 'canceled') {
          await prisma.user.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { subscriptionStatus: 'free' },
          })
        }

        break
      }

      case 'subscription_deleted': {
        const { subscriptionId } = result

        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            status: 'canceled',
            cancelAtPeriodEnd: true,
          },
        })

        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { subscriptionStatus: 'free' },
        })

        break
      }

      case 'payment_succeeded': {
        const { paymentId, amount, customerId } = result

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          await prisma.payment.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              stripePaymentId: paymentId!,
              amount: amount!,
              status: 'succeeded',
            },
          })
        }

        break
      }

      case 'payment_failed': {
        const { customerId } = result

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: 'past_due' },
        })

        break
      }

      default:
        // Log unhandled events at debug level
        logger.debug({ eventType: result.type }, 'Unhandled webhook event type')
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ error }, 'Webhook handler error')
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
