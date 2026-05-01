/**
 * Stripe Payment Gateway Implementation
 */

import Stripe from 'stripe'
import { logger } from '../logger'
import {
  IPaymentGateway,
  PaymentGatewayConfig,
  CheckoutSessionOptions,
  CheckoutSessionResult,
  SubscriptionOptions,
  SubscriptionResult,
  WebhookEvent,
  RefundResult,
  CustomerResult,
  PaymentMethodResult,
} from './gateway-interface'

export class StripeGateway implements IPaymentGateway {
  name = 'Stripe'
  key = 'stripe'
  testMode = false
  supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'AED']
  supportedCountries = ['US', 'GB', 'CA', 'AU', 'IN', 'SG', 'AE', 'FR', 'DE', 'NL']

  private stripe: Stripe | null = null
  private config: PaymentGatewayConfig | null = null

  initialize(config: PaymentGatewayConfig) {
    this.config = config
    this.testMode = config.testMode || false

    if (config.apiKey) {
      this.stripe = new Stripe(config.apiKey, {
        apiVersion: '2026-03-25.dahlia',
      })
    }
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe not initialized. Call initialize() first.')
    }
    return this.stripe
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const stripe = this.getStripe()

    const session = await stripe.checkout.sessions.create({
      customer_email: options.email,
      line_items: [
        {
          price_data: {
            currency: options.currency.toLowerCase(),
            product_data: {
              name: `Subscription - ${options.planId}`,
            },
            unit_amount: options.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        userId: options.userId,
        planId: options.planId,
        gatewayPlanId: options.gatewayPlanId,
        ...options.metadata,
      },
    })

    return {
      id: session.id,
      url: session.url || undefined,
      status: session.status || 'open',
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    }
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, any>): Promise<CustomerResult> {
    const stripe = this.getStripe()

    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    })

    return {
      id: customer.id,
      email: customer.email || email,
      name: customer.name || name,
      metadata: customer.metadata,
    }
  }

  async getCustomer(customerId: string): Promise<CustomerResult> {
    const stripe = this.getStripe()
    const customer = await stripe.customers.retrieve(customerId)

    if (customer.deleted) {
      throw new Error('Customer not found')
    }

    return {
      id: customer.id,
      email: customer.email || '',
      name: customer.name || undefined,
      metadata: customer.metadata,
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    const stripe = this.getStripe()
    await stripe.customers.del(customerId)
  }

  async createSubscription(options: SubscriptionOptions): Promise<SubscriptionResult> {
    const stripe = this.getStripe()

    // First create or get customer
    let customerId = options.metadata?.stripeCustomerId
    if (!customerId) {
      const customer = await this.createCustomer(options.email, undefined, {
        userId: options.userId,
      })
      customerId = customer.id
    }

    const response = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: options.gatewayPlanId }],
      metadata: {
        userId: options.userId,
        planId: options.planId,
      },
    })

    // Stripe SDK v2026-03-25.dahlia returns Response wrapper - access via object property
    const subscription = response as any

    return {
      id: subscription.id,
      status: subscription.status as SubscriptionResult['status'],
      customerId: subscription.customer as string,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    }
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = false): Promise<void> {
    const stripe = this.getStripe()

    if (atPeriodEnd) {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })
    } else {
      await stripe.subscriptions.cancel(subscriptionId)
    }
  }

  async updateSubscription(subscriptionId: string, options: Partial<SubscriptionOptions>): Promise<SubscriptionResult> {
    const stripe = this.getStripe()

    const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
    const subscription = subscriptionResponse as any

    if (options.gatewayPlanId && options.gatewayPlanId !== subscription.items.data[0]?.price.id) {
      // Update subscription with new price (proration handled automatically)
      const updatedResponse = await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: options.gatewayPlanId,
          },
        ],
      })

      const updated = updatedResponse as any

      return {
        id: updated.id,
        status: updated.status as SubscriptionResult['status'],
        customerId: updated.customer as string,
        currentPeriodEnd: new Date(updated.current_period_end * 1000),
        cancelAtPeriodEnd: updated.cancel_at_period_end || false,
      }
    }

    return {
      id: subscription.id,
      status: subscription.status as SubscriptionResult['status'],
      customerId: subscription.customer as string,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<WebhookEvent> {
    const stripe = this.getStripe()

    if (!this.verifyWebhookSignature(payload, signature)) {
      throw new Error('Invalid webhook signature')
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config?.webhookSecret || ''
    )

    return {
      type: event.type,
      data: event.data.object,
      rawEvent: event,
    }
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResult> {
    const stripe = this.getStripe()

    const refund = await stripe.refunds.create({
      payment_intent: paymentId,
      amount,
      reason: reason as any || 'requested_by_customer',
    })

    return {
      success: refund.status === 'succeeded',
      refundId: refund.id,
      amount: refund.amount || 0,
      status: refund.status || 'pending',
    }
  }

  async getPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
    const stripe = this.getStripe()

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
    })

    return paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      isDefault: false, // Would need to check customer's default setting
    }))
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    const stripe = this.getStripe()
    const endpointSecret = this.config?.webhookSecret

    if (!endpointSecret) {
      logger.warn('Stripe webhook secret not configured')
      return false
    }

    try {
      const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret)
      return !!event
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Stripe webhook signature verification failed')
      return false
    }
  }
}
