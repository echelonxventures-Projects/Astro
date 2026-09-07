export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getGateway } from '@/lib/payment'

/**
 * POST /api/payment/subscription
 * Manage subscription (cancel, update, etc.)
 */
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await _req.json()
    const { action, subscriptionId, gateway } = body

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    switch (action) {
      case 'cancel': {
        if (!subscriptionId || !gateway) {
          return NextResponse.json(
            { error: 'Subscription ID and gateway required' },
            { status: 400 }
          )
        }

        const gw = await getGateway(gateway)
        if (!gw) {
          return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 })
        }

        // Cancel at period end (default) or immediately
        const atPeriodEnd = body.atPeriodEnd !== false

        await gw.cancelSubscription(subscriptionId, atPeriodEnd)

        // Update local subscription record
        await prisma.subscription.updateMany({
          where: {
            OR: [{ id: subscriptionId }, { stripeSubscriptionId: subscriptionId }],
          },
          data: {
            cancelAtPeriodEnd: atPeriodEnd,
            status: atPeriodEnd ? 'active' : 'cancelled',
          },
        })

        // Update user status if cancelling immediately
        if (!atPeriodEnd) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: 'cancelled',
            },
          })
        }

        return NextResponse.json({
          success: true,
          message: atPeriodEnd
            ? 'Subscription will be cancelled at the end of billing period'
            : 'Subscription cancelled immediately',
        })
      }

      case 'update': {
        if (!subscriptionId || !gateway || !body.newPlanId) {
          return NextResponse.json(
            { error: 'Subscription ID, gateway, and new plan ID required' },
            { status: 400 }
          )
        }

        const gw = await getGateway(gateway)
        if (!gw) {
          return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 })
        }

        // Get new plan's gateway plan ID
        const newPlan = await prisma.gatewayPlan.findFirst({
          where: {
            planId: body.newPlanId,
            isActive: true,
          },
        })

        if (!newPlan) {
          return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
        }

        // Update subscription (proration handled by gateway)
        const updated = await gw.updateSubscription(subscriptionId, {
          gatewayPlanId: newPlan.gatewayPlanId,
        })

        return NextResponse.json({
          success: true,
          subscription: updated,
        })
      }

      case 'resume': {
        if (!subscriptionId || !gateway) {
          return NextResponse.json(
            { error: 'Subscription ID and gateway required' },
            { status: 400 }
          )
        }

        // Reactivate subscription
        const gw = await getGateway(gateway)
        if (!gw) {
          return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 })
        }

        // Resume by updating subscription (gateway-specific)
        await prisma.subscription.updateMany({
          where: {
            OR: [{ id: subscriptionId }, { stripeSubscriptionId: subscriptionId }],
          },
          data: {
            cancelAtPeriodEnd: false,
            status: 'active',
          },
        })

        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: 'premium',
          },
        })

        return NextResponse.json({
          success: true,
          message: 'Subscription resumed',
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    logError('Error managing subscription', error, { userId: session.user.id })
    return NextResponse.json(
      {
        error: 'Failed to manage subscription',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/payment/subscription
 * Get user's current subscription status
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const subscription = user.subscriptions[0]

    // Get gateway info if subscription exists
    let gatewayInfo = null
    if (subscription?.stripeSubscriptionId) {
      gatewayInfo = { key: 'stripe', name: 'Stripe' }
    } else if (user.razorpayCustomerId) {
      gatewayInfo = { key: 'razorpay', name: 'Razorpay' }
    }

    return NextResponse.json({
      subscription: {
        status: user.subscriptionStatus,
        plan: user.subscriptionPlan,
        currentPeriodEnd: user.currentPeriodEnd,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        gateway: gatewayInfo,
        subscriptionId: subscription?.stripeSubscriptionId || subscription?.id,
      },
      recentTransactions: user.transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt,
      })),
    })
  } catch (error) {
    logError('Error fetching subscription', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
