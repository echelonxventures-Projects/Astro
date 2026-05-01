import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const stripe = getStripe()
    return (stripe as any)[prop]
  },
})

/**
 * Subscription plans configuration
 */
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    maxReadingsPerMonth: 3,
    features: [
      'Daily horoscope',
      'Basic birth chart',
      '3 AI readings per month',
    ],
    aiConfig: {
      provider: 'ollama',
      model: 'llama3.2',
      maxTokens: 512,
    },
  },
  monthly: {
    name: 'Premium Monthly',
    price: 1499, // $14.99
    stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY,
    maxReadingsPerMonth: -1, // unlimited
    features: [
      'Unlimited AI readings',
      'Detailed birth chart analysis',
      'Compatibility readings',
      'Love & career horoscopes',
      'Chat with AI astrologer',
      'Transit forecasts',
    ],
    aiConfig: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2048,
    },
  },
  yearly: {
    name: 'Premium Yearly',
    price: 14990, // $149.90 (save ~17%)
    stripePriceId: process.env.STRIPE_PRICE_ID_YEARLY,
    maxReadingsPerMonth: -1, // unlimited
    features: [
      'Everything in Monthly',
      '2 months free',
      'Priority support',
      'Early access to new features',
    ],
    aiConfig: {
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      maxTokens: 4096,
    },
  },
}

/**
 * Create a Stripe checkout session
 */
export async function createCheckoutSession({
  userId,
  email,
  plan,
  successUrl,
  cancelUrl,
}: {
  userId: string
  email: string
  plan: 'monthly' | 'yearly'
  successUrl: string
  cancelUrl: string
}) {
  const planConfig = PLANS[plan]
  const stripe = getStripe()

  if (!planConfig.stripePriceId) {
    throw new Error(`Stripe price ID not configured for ${plan} plan`)
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    line_items: [
      {
        price: planConfig.stripePriceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      plan,
    },
    allow_promotion_codes: true,
  })

  return session
}

/**
 * Create a Stripe customer portal session for subscription management
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}) {
  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const plan = session.metadata?.plan

      if (!userId || !plan) {
        throw new Error('Missing userId or plan in session metadata')
      }

      return {
        type: 'checkout_completed',
        subscriptionId: session.subscription as string,
        customerId: session.customer as string,
        plan,
        userId,
      }
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      return {
        type: 'subscription_updated',
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        plan: (subscription as any).items?.data[0]?.plan.id === process.env.STRIPE_PRICE_ID_YEARLY ? 'yearly' : 'monthly',
      }
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      return {
        type: 'subscription_deleted',
        subscriptionId: subscription.id,
      }
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      return {
        type: 'payment_succeeded',
        paymentId: (invoice as any).payment_intent as string,
        amount: (invoice as any).amount_paid,
        customerId: (invoice as any).customer as string,
      }
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      return {
        type: 'payment_failed',
        paymentId: (invoice as any).payment_intent as string,
        customerId: (invoice as any).customer as string,
      }
    }

    default:
      return { type: 'unhandled' }
  }
}

/**
 * Get Stripe customer by ID
 */
export async function getCustomer(customerId: string) {
  const stripe = getStripe()
  return stripe.customers.retrieve(customerId)
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(subscriptionId: string) {
  const stripe = getStripe()
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

/**
 * Immediately cancel a subscription
 */
export async function cancelSubscriptionImmediately(subscriptionId: string) {
  const stripe = getStripe()
  return stripe.subscriptions.cancel(subscriptionId)
}
