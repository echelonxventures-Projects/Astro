/**
 * Razorpay Payment Gateway Implementation
 * Supports UPI, Cards, Netbanking, Wallets, PayLater, and international payments
 */

import crypto from 'crypto'
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

interface RazorpayOptions {
  key_id: string
  key_secret: string
}

class RazorpayClient {
  private options: RazorpayOptions
  private baseUrl = 'https://api.razorpay.com/v1'

  constructor(options: RazorpayOptions) {
    this.options = options
  }

  private async request(method: string, path: string, data?: any) {
    const url = `${this.baseUrl}${path}`
    const auth = Buffer.from(`${this.options.key_id}:${this.options.key_secret}`).toString('base64')

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.description || 'Razorpay API error')
    }

    return response.json()
  }

  async createOrder(options: { amount: number; currency: string; customer_id?: string; notes?: Record<string, any> }) {
    return this.request('POST', '/orders', options)
  }

  async fetchOrder(orderId: string) {
    return this.request('GET', `/orders/${orderId}`)
  }

  async createCustomer(options: { name?: string; email: string; contact?: string; notes?: Record<string, any> }) {
    return this.request('POST', '/customers', options)
  }

  async fetchCustomer(customerId: string) {
    return this.request('GET', `/customers/${customerId}`)
  }

  async editCustomer(customerId: string, options: { name?: string; email?: string; contact?: string; notes?: Record<string, any> }) {
    return this.request('PUT', `/customers/${customerId}`, options)
  }

  async createSubscription(options: { plan_id: string; customer_notify_with?: number; total_count?: number; notes?: Record<string, any> }) {
    return this.request('POST', '/subscriptions', options)
  }

  async fetchSubscription(subscriptionId: string) {
    return this.request('GET', `/subscriptions/${subscriptionId}`)
  }

  async cancelSubscription(subscriptionId: string, options?: { at_period_end?: boolean }) {
    return this.request('POST', `/subscriptions/${subscriptionId}/cancel`, options)
  }

  async createRefund(options: { payment_id: string; amount?: number; speed?: string; notes?: Record<string, any> }) {
    return this.request('POST', '/refunds', options)
  }

  async fetchRefund(refundId: string) {
    return this.request('GET', `/refunds/${refundId}`)
  }

  async fetchPayment(paymentId: string) {
    return this.request('GET', `/payments/${paymentId}`)
  }

  async createPlan(options: { period: string; interval: number; item: { name: string; amount: number; currency: string }; notes?: Record<string, any> }) {
    return this.request('POST', '/plans', options)
  }
}

export class RazorpayGateway implements IPaymentGateway {
  name = 'Razorpay'
  key = 'razorpay'
  testMode = false
  supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'MYR', 'PHP', 'BHD', 'KWD', 'OMR']
  supportedCountries = ['IN', 'US', 'GB', 'SG', 'AE', 'MY', 'PH', 'BH', 'KW', 'OM', 'QA', 'SA']

  private razorpay: RazorpayClient | null = null
  private config: PaymentGatewayConfig | null = null

  initialize(config: PaymentGatewayConfig) {
    this.config = config
    this.testMode = config.testMode || false

    if (config.publicKey && config.apiSecret) {
      this.razorpay = new RazorpayClient({
        key_id: config.publicKey,
        key_secret: config.apiSecret,
      })
    }
  }

  private getRazorpay(): RazorpayClient {
    if (!this.razorpay) {
      throw new Error('Razorpay not initialized. Call initialize() first.')
    }
    return this.razorpay
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const razorpay = this.getRazorpay()

    // Create Razorpay order
    const order = await razorpay.createOrder({
      amount: options.amount,
      currency: options.currency.toLowerCase(),
      customer_id: options.metadata?.razorpayCustomerId,
      notes: {
        userId: options.userId,
        planId: options.planId,
        gatewayPlanId: options.gatewayPlanId,
        ...options.metadata,
      },
    })

    return {
      id: order.id,
      orderId: order.id,
      status: order.status === 1 ? 'created' : 'pending',
      clientSecret: JSON.stringify({
        key: this.config?.publicKey,
        order_id: order.id,
        amount: options.amount,
        currency: options.currency,
        name: 'StarPath Astrology',
        description: `Subscription - ${options.planId}`,
        prefill: {
          email: options.email,
        },
      }),
    }
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, any>): Promise<CustomerResult> {
    const razorpay = this.getRazorpay()

    const customer = await razorpay.createCustomer({
      name: name || email.split('@')[0],
      email,
      notes: metadata,
    })

    return {
      id: customer.id,
      email: customer.email || email,
      name: customer.name || name,
      metadata: customer.notes,
    }
  }

  async getCustomer(customerId: string): Promise<CustomerResult> {
    const razorpay = this.getRazorpay()

    const customer = await razorpay.fetchCustomer(customerId)

    return {
      id: customer.id,
      email: customer.email || '',
      name: customer.name || undefined,
      metadata: customer.notes,
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    // Razorpay doesn't support customer deletion via API
    // Mark as inactive in your database instead
    logger.warn('Razorpay does not support customer deletion. Mark as inactive in your database.')
  }

  async createSubscription(options: SubscriptionOptions): Promise<SubscriptionResult> {
    const razorpay = this.getRazorpay()

    // First create or get customer
    let customerId = options.metadata?.razorpayCustomerId
    if (!customerId) {
      const customer = await this.createCustomer(options.email, undefined, {
        userId: options.userId,
      })
      customerId = customer.id
    }

    // Create subscription plan if gatewayPlanId is not a plan ID
    const planId = options.gatewayPlanId.startsWith('plan_')
      ? options.gatewayPlanId
      : await this.createPlan(options)

    const subscription = await razorpay.createSubscription({
      plan_id: planId,
      customer_notify_with: 1, // Notify via all channels
      total_count: options.interval === 'yearly' ? 12 : 999, // Approximate for recurring
      notes: {
        userId: options.userId,
        planId: options.planId,
      },
    })

    return {
      id: subscription.id,
      status: this.mapSubscriptionStatus(subscription.status),
      customerId,
      currentPeriodEnd: subscription.end_at ? new Date(subscription.end_at * 1000) : new Date(),
      cancelAtPeriodEnd: false,
    }
  }

  private async createPlan(options: SubscriptionOptions): Promise<string> {
    const razorpay = this.getRazorpay()

    const plan = await razorpay.createPlan({
      period: options.interval === 'yearly' ? 'yearly' : 'monthly',
      interval: 1,
      item: {
        name: `Subscription - ${options.planId}`,
        amount: options.amount,
        currency: options.currency.toLowerCase(),
      },
      notes: {
        planId: options.planId,
        gatewayPlanId: options.gatewayPlanId,
      },
    })

    return plan.id
  }

  private mapSubscriptionStatus(status: string): SubscriptionResult['status'] {
    const statusMap: Record<string, SubscriptionResult['status']> = {
      'created': 'active',
      'authenticating': 'incomplete',
      'active': 'active',
      'invoiced': 'active',
      'awaiting_payment': 'active',
      'fulfilled': 'active',
      'cancelled': 'canceled',
      'suspended': 'past_due',
      'failed': 'canceled',
      'expired': 'canceled',
    }
    return statusMap[status] || 'active'
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = false): Promise<void> {
    const razorpay = this.getRazorpay()

    await razorpay.cancelSubscription(subscriptionId, {
      at_period_end: atPeriodEnd,
    })
  }

  async updateSubscription(subscriptionId: string, options: Partial<SubscriptionOptions>): Promise<SubscriptionResult> {
    // Razorpay doesn't have a direct update subscription API
    // Need to cancel old and create new subscription
    // This is a simplified implementation
    return this.createSubscription(options as SubscriptionOptions)
  }

  async handleWebhook(payload: any, signature: string): Promise<WebhookEvent> {
    if (!this.verifyWebhookSignature(payload, signature)) {
      throw new Error('Invalid webhook signature')
    }

    const event = typeof payload === 'string' ? JSON.parse(payload) : payload

    return {
      type: event.event,
      data: event.payload,
      rawEvent: event,
    }
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResult> {
    const razorpay = this.getRazorpay()

    const refund = await razorpay.createRefund({
      payment_id: paymentId,
      amount,
      speed: 'normal',
      notes: {
        reason: reason || 'requested_by_customer',
      },
    })

    return {
      success: refund.status === 'processed',
      refundId: refund.id,
      amount: refund.amount || 0,
      status: refund.status || 'pending',
    }
  }

  async getPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
    // Razorpay doesn't have a saved payment methods API like Stripe
    // Return empty array - Razorpay handles payment methods in the checkout UI
    return []
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    const webhookSecret = this.config?.webhookSecret

    if (!webhookSecret) {
      logger.warn('Razorpay webhook secret not configured')
      return false
    }

    const body = typeof payload === 'string' ? payload : JSON.stringify(payload)

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')

    return expectedSignature === signature
  }
}
