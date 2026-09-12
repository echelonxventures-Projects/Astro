export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getGateway, getDefaultGateway, getEnabledGateways } from '@/lib/payment'
import { getTenantContext } from '@/lib/tenant'

/**
 * POST /api/payment/checkout
 * Create a checkout _session with the selected or default payment gateway
 */
export async function POST(req: NextRequest) {
  const _session = await auth()
  if (!_session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = _session.user.tenantId!

  try {
    const body = await req.json()
    const { planId, gatewayKey, paymentMethod } = body

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: _session.user.id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the subscription plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { tenantId_key: { tenantId, key: planId } },
    })

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive plan' }, { status: 400 })
    }

    // Free plan - no checkout needed
    if (plan.price === 0) {
      return NextResponse.json({
        message: 'Free plan activated',
        plan: planId,
      })
    }

    // Get gateway plan
    const gatewayPlan = await prisma.gatewayPlan.findFirst({
      where: {
        planId,
        isActive: true,
        gateway: { tenantId },
      },
      include: {
        gateway: true,
      },
    })

    // If no gateway plan exists, use the default gateway with plan price
    let gateway
    let amount = plan.price
    let currency = plan.currency

    if (gatewayPlan) {
      // Use the gateway specified in gateway plan, or let user choose
      if (gatewayKey && gatewayKey !== gatewayPlan.gateway.key) {
        // User wants a different gateway, find their plan
        const userGatewayPlan = await prisma.gatewayPlan.findFirst({
          where: {
            planId,
            gatewayId: (
              await prisma.paymentGateway.findUnique({
                where: { tenantId_key: { tenantId, key: gatewayKey } },
              })
            )?.id,
            isActive: true,
          },
          include: { gateway: true },
        })

        if (userGatewayPlan) {
          gateway = await getGateway(tenantId, userGatewayPlan.gateway.key)
          amount = userGatewayPlan.price
          currency = userGatewayPlan.currency
        } else {
          gateway = await getGateway(tenantId, gatewayPlan.gateway.key)
        }
      } else {
        gateway = await getGateway(tenantId, gatewayPlan.gateway.key)
      }

      if (gateway) {
        amount = gatewayPlan.price
        currency = gatewayPlan.currency
      }
    }

    // Fallback to default gateway
    if (!gateway) {
      gateway = await getDefaultGateway(tenantId)
    }

    if (!gateway) {
      return NextResponse.json({ error: 'No payment gateway configured' }, { status: 503 })
    }

    const successUrl = `${process.env.NEXTAUTH_URL}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${process.env.NEXTAUTH_URL}/pricing?canceled=true`

    // Create checkout _session
    const checkoutResult = await gateway.createCheckoutSession({
      userId: user.id,
      email: user.email,
      planId,
      gatewayPlanId: gatewayPlan?.gatewayPlanId || planId,
      amount,
      currency,
      successUrl,
      cancelUrl,
      metadata: {
        planName: plan.name,
        interval: plan.interval || 'one-time',
      },
      paymentMethod,
    })

    // Store the pending transaction
    await prisma.paymentTransaction.create({
      data: {
        tenantId,
        userId: user.id,
        gatewayId: (await prisma.paymentGateway.findUnique({
          where: { tenantId_key: { tenantId, key: gateway.key } },
        }))!.id,
        gatewayPlanId: gatewayPlan?.id,
        amount,
        currency,
        gatewayTransactionId: checkoutResult.id,
        status: 'pending',
        paymentMethod: paymentMethod || 'card',
        metadata: JSON.stringify({
          planId,
          planName: plan.name,
          interval: plan.interval,
        }),
      },
    })

    return NextResponse.json({
      url: checkoutResult.url,
      clientSecret: checkoutResult.clientSecret,
      orderId: checkoutResult.orderId,
      sessionId: checkoutResult.id,
      gateway: gateway.key,
    })
  } catch (error) {
    logError('Error creating checkout _session', error, { userId: _session.user.id })
    return NextResponse.json({ error: 'Failed to create checkout _session' }, { status: 500 })
  }
}

/**
 * GET /api/payment/checkout
 * Get available gateways and plans for checkout
 */
export async function GET(req: NextRequest) {
  const ctx = await getTenantContext()
  const tenantId = ctx.tenantId

  const searchParams = req.nextUrl.searchParams
  const planId = searchParams.get('plan')
  const country = searchParams.get('country')
  const currency = searchParams.get('currency')

  try {
    const gateways = await getEnabledGateways(tenantId)

    const gatewayInfo = await Promise.all(
      gateways.map(async gw => {
        const gatewayRecord = await prisma.paymentGateway.findUnique({
          where: { tenantId_key: { tenantId, key: gw.key } },
          include: {
            paymentMethods: {
              where: { isEnabled: true },
            },
          },
        })

        return {
          key: gw.key,
          name: gw.name,
          isDefault: gatewayRecord?.isDefault || false,
          paymentMethods:
            gatewayRecord?.paymentMethods.map(pm => ({
              key: pm.key,
              name: pm.name,
              icon: pm.icon,
            })) || [],
        }
      })
    )

    let plans: any[] = []
    if (planId) {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { tenantId_key: { tenantId, key: planId } },
        include: {
          featureAccess: {
            include: {
              feature: true,
            },
          },
        },
      })

      if (plan) {
        // Get gateway-specific plans
        const gatewayPlans = await prisma.gatewayPlan.findMany({
          where: { planId, isActive: true },
          include: { gateway: true },
        })

        plans = [
          {
            ...plan,
            gatewayOptions: gatewayPlans.map(gp => ({
              gatewayKey: gp.gateway.key,
              gatewayName: gp.gateway.name,
              price: gp.price,
              currency: gp.currency,
              gatewayPlanId: gp.gatewayPlanId,
            })),
          },
        ]
      }
    } else {
      const allPlans = await prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      plans = allPlans
    }

    return NextResponse.json({
      gateways: gatewayInfo,
      plans,
      defaultCurrency: currency || 'USD',
      detectedCountry: country,
    })
  } catch (error) {
    logError('Error fetching checkout data', error)
    return NextResponse.json({ error: 'Failed to fetch checkout data' }, { status: 500 })
  }
}
