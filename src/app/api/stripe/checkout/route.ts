export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { createCheckoutSession, createPortalSession } from '@/lib/stripe'

/**
 * POST /api/stripe/checkout
 * Create a Stripe checkout session for subscription
 */
export async function POST(_req: NextRequest) {
  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await _req.json()
    const { plan } = body

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { getTenantBaseUrl } = await import('@/lib/tenant')
    const tenantBase = await getTenantBaseUrl()
    const successUrl = `${tenantBase}/subscription?success=true`
    const cancelUrl = `${tenantBase}/pricing?canceled=true`

    // If user already has a customer ID, use it
    if (user.stripeCustomerId) {
      const checkoutSession = await createCheckoutSession({
        userId: user.id,
        email: user.email,
        plan: plan as 'monthly' | 'yearly',
        successUrl,
        cancelUrl,
      })

      return NextResponse.json({ url: checkoutSession.url })
    }

    // Create new checkout session
    const checkoutSession = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      plan: plan as 'monthly' | 'yearly',
      successUrl,
      cancelUrl,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    logError('Error creating checkout session', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}

/**
 * GET /api/stripe/portal
 * Create a Stripe portal session for subscription management
 */
export async function GET(_req: NextRequest) {
  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const { getTenantBaseUrl } = await import('@/lib/tenant')
    const returnUrl = `${await getTenantBaseUrl()}/subscription`

    const portalSession = await createPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    logError('Error creating portal session', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
