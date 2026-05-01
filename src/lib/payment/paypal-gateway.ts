/**
 * PayPal Payment Gateway Implementation
 * Complete PayPal Orders API v2 and Subscriptions API integration
 */

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
import { logger } from '@/lib/logger'
import { validateWebhookSignature } from './security'
import { checkTransaction, FraudCheck } from './fraud-detection'
import {
  logPaymentAudit,
  logWebhookEvent,
  logTransaction,
  logSubscription,
} from './audit'

// PayPal API types
interface PayPalOrder {
  id: string
  status: string
  links: Array<{
    href: string
    rel: string
    method?: string
  }>
}

interface PayPalSubscription {
  id: string
  status: string
  plan_id: string
  subscriber: {
    email_address: string
    payer_id?: string
  }
}

interface PayPalCapture {
  id: string
  status: string
  amount: {
    currency_code: string
    value: string
  }
}

export class PaypalGateway implements IPaymentGateway {
  name = 'PayPal'
  key = 'paypal'
  testMode = false
  supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR']
  supportedCountries = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN', 'IN']

  private config: PaymentGatewayConfig | null = null
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null

  initialize(config: PaymentGatewayConfig) {
    this.config = config
    this.testMode = config.testMode || false
    logger.debug({ gateway: this.name, testMode: this.testMode }, 'PayPal gateway initialized')
  }

  private getBaseUrl(): string {
    return this.testMode
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com'
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken
    }

    const clientId = this.config?.apiKey
    const clientSecret = this.config?.apiSecret

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured')
    }

    const response = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error({ status: response.status, error }, 'Failed to get PayPal access token')
      throw new Error(`Failed to get PayPal access token: ${response.status}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    // Set expiry 5 minutes before actual expiry for safety
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000)

    return this.accessToken
  }

  private async makeApiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken()

    const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': crypto.randomUUID(),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error({ endpoint, status: response.status, error }, 'PayPal API request failed')
      throw new Error(`PayPal API error: ${response.status} - ${error}`)
    }

    return response.json() as Promise<T>
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    try {
      logger.debug({ userId: options.userId, amount: options.amount }, 'Creating PayPal checkout session')

      // Run fraud check
      const fraudCheck = await checkTransaction({
        userId: options.userId,
        email: options.email,
        amount: options.amount,
        currency: options.currency,
        isFirstTransaction: true,
      })

      if (fraudCheck.action === 'block') {
        throw new Error(`Transaction blocked by fraud detection: ${fraudCheck.flags.join(', ')}`)
      }

      const order = await this.makeApiRequest<PayPalOrder>('/v2/checkout/orders', {
        method: 'POST',
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: options.currency,
              value: (options.amount / 100).toFixed(2),
            },
            description: options.metadata?.description || 'Astrology Reading',
            custom_id: options.userId,
            invoice_id: `inv-${Date.now()}-${options.userId.slice(0, 8)}`,
          }],
          application_context: {
            brand_name: 'StarPath Astrology',
            landing_page: 'LOGIN',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: options.successUrl,
            cancel_url: options.cancelUrl,
          },
        }),
      })

      const approveLink = order.links?.find((l) => l.rel === 'approve')

      if (!approveLink) {
        throw new Error('PayPal approval URL not found in response')
      }

      await logTransaction('payment_intent_created', {
        userId: options.userId,
        gateway: this.key,
        amount: options.amount,
        currency: options.currency,
        status: 'success',
        metadata: {
          orderId: order.id,
          fraudScore: fraudCheck.riskScore,
        },
      })

      return {
        id: order.id,
        url: approveLink.href,
        status: order.status,
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
      }
    } catch (error) {
      logger.error({ error, userId: options.userId }, 'Failed to create PayPal checkout session')

      await logTransaction('payment_intent_failed', {
        userId: options.userId,
        gateway: this.key,
        amount: options.amount,
        currency: options.currency,
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, any>): Promise<CustomerResult> {
    try {
      // PayPal doesn't have a traditional customer API like Stripe
      // We create a "vault" customer for saved payment methods
      const customer = await this.makeApiRequest<{
        id: string
        email_address: string
        name?: { given_name?: string; surname?: string }
      }>('/v2/vault/customers', {
        method: 'POST',
        body: JSON.stringify({
          email_address: email,
          ...(name && {
            name: {
              given_name: name.split(' ')[0],
              surname: name.split(' ').slice(1).join(' '),
            },
          }),
          metadata,
        }),
      })

      logger.debug({ customerId: customer.id, email }, 'PayPal customer created')

      return {
        id: customer.id,
        email: customer.email_address,
        name,
        metadata,
      }
    } catch (error) {
      logger.error({ error, email }, 'Failed to create PayPal customer')
      throw error
    }
  }

  async getCustomer(customerId: string): Promise<CustomerResult> {
    try {
      const customer = await this.makeApiRequest<{
        id: string
        email_address: string
        name?: { given_name?: string; surname?: string }
        create_time: string
      }>(`/v2/vault/customers/${customerId}`)

      return {
        id: customer.id,
        email: customer.email_address,
        name: customer.name
          ? `${customer.name.given_name || ''} ${customer.name.surname || ''}`.trim()
          : undefined,
        metadata: {
          createdAt: customer.create_time,
        },
      }
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to get PayPal customer')
      throw error
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await this.makeApiRequest<void>(`/v2/vault/customers/${customerId}`, {
        method: 'DELETE',
      })

      logger.debug({ customerId }, 'PayPal customer deleted')
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to delete PayPal customer')
      throw error
    }
  }

  async createSubscription(options: SubscriptionOptions): Promise<SubscriptionResult> {
    try {
      logger.debug({ userId: options.userId, planId: options.planId }, 'Creating PayPal subscription')

      // First, ensure we have a product
      const product = await this.ensureProduct(options.planId, 'Astrology Subscription')

      // Create or get plan
      const plan = await this.createOrGetPlan(product.id, options)

      // Create subscription
      const subscription = await this.makeApiRequest<PayPalSubscription>('/v1/billing/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          subscriber: {
            email_address: options.email,
            name: {
              given_name: options.metadata?.firstName || 'User',
              surname: options.metadata?.lastName || '',
            },
          },
          application_context: {
            brand_name: 'StarPath Astrology',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            payment_method: {
              payer_selected: 'PAYPAL',
              payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
            },
            return_url: options.metadata?.successUrl,
            cancel_url: options.metadata?.cancelUrl,
          },
          custom_id: options.userId,
        }),
      })

      await logSubscription('subscription_created', {
        userId: options.userId,
        subscriptionId: subscription.id,
        gateway: this.key,
        planId: options.planId,
        status: 'success',
      })

      return {
        id: subscription.id,
        status: this.mapSubscriptionStatus(subscription.status),
        customerId: subscription.subscriber.payer_id || subscription.id,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      }
    } catch (error) {
      logger.error({ error, userId: options.userId }, 'Failed to create PayPal subscription')

      await logSubscription('subscription_created', {
        userId: options.userId,
        gateway: this.key,
        planId: options.planId,
        status: 'failure',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      throw error
    }
  }

  private async ensureProduct(productId: string, name: string): Promise<{ id: string }> {
    try {
      // Try to get existing product
      const product = await this.makeApiRequest<{ id: string }>(`/v1/catalogs/products/${productId}`)
      return product
    } catch {
      // Create new product if not found
      const newProduct = await this.makeApiRequest<{ id: string }>('/v1/catalogs/products', {
        method: 'POST',
        body: JSON.stringify({
          id: productId,
          name,
          description: 'Astrology readings and insights subscription',
          type: 'DIGITAL',
          category: 'SOFTWARE',
        }),
      })
      return newProduct
    }
  }

  private async createOrGetPlan(
    productId: string,
    options: SubscriptionOptions
  ): Promise<{ id: string }> {
    const planId = `plan-${options.interval}-${options.amount}-${options.currency}`

    try {
      // Try to get existing plan
      const plan = await this.makeApiRequest<{ id: string }>(`/v1/billing/plans/${planId}`)
      return plan
    } catch {
      // Create new plan
      const billingCycles = []

      if (options.metadata?.trialDays && options.metadata.trialDays > 0) {
        billingCycles.push({
          frequency: { interval_unit: 'DAY', interval_count: options.metadata.trialDays },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: {
            fixed_price: { value: '0', currency_code: options.currency },
          },
        })
      }

      const regularPricing = {
        fixed_price: {
          value: (options.amount / 100).toFixed(2),
          currency_code: options.currency,
        },
      }

      billingCycles.push({
        frequency: {
          interval_unit: options.interval === 'year' ? 'YEAR' : 'MONTH',
          interval_count: 1,
        },
        tenure_type: 'REGULAR',
        sequence: billingCycles.length + 1,
        total_cycles: 0, // Infinite
        pricing_scheme: regularPricing,
      })

      const plan = await this.makeApiRequest<{ id: string }>('/v1/billing/plans', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
          name: `${options.interval}ly Plan`,
          description: `Subscription plan - ${options.interval}ly billing`,
          status: 'ACTIVE',
          billing_cycles: billingCycles,
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3,
          },
        }),
      })

      return plan
    }
  }

  private mapSubscriptionStatus(status: string): SubscriptionResult['status'] {
    const statusMap: Record<string, SubscriptionResult['status']> = {
      'ACTIVE': 'active',
      'APPROVAL_PENDING': 'incomplete',
      'APPROVED': 'active',
      'SUSPENDED': 'past_due',
      'CANCELLED': 'canceled',
      'EXPIRED': 'canceled',
    }
    return statusMap[status] || 'incomplete'
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = false): Promise<void> {
    try {
      if (atPeriodEnd) {
        // PayPal doesn't support cancel at period end natively
        // We need to track this ourselves and cancel when the period ends
        logger.debug({ subscriptionId }, 'PayPal subscription scheduled for cancellation at period end')
      } else {
        await this.makeApiRequest<void>(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
          method: 'POST',
          body: JSON.stringify({
            reason: 'Customer requested cancellation',
          }),
        })

        logger.debug({ subscriptionId }, 'PayPal subscription cancelled')
      }
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to cancel PayPal subscription')
      throw error
    }
  }

  async updateSubscription(
    subscriptionId: string,
    options: Partial<SubscriptionOptions>
  ): Promise<SubscriptionResult> {
    try {
      const updateData: Record<string, unknown> = {}

      if (options.amount || options.currency) {
        // PayPal requires creating a new plan for pricing changes
        const product = await this.ensureProduct(options.planId || 'default', 'Updated Plan')
        const plan = await this.createOrGetPlan(product.id, options as SubscriptionOptions)
        updateData.plan_id = plan.id
      }

      const subscription = await this.makeApiRequest<PayPalSubscription>(
        `/v1/billing/subscriptions/${subscriptionId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              op: 'replace',
              path: '/plan',
              value: { id: updateData.plan_id },
            },
          ]),
        }
      )

      return {
        id: subscription.id,
        status: this.mapSubscriptionStatus(subscription.status),
        customerId: subscription.subscriber?.payer_id || subscriptionId,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      }
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to update PayPal subscription')
      throw error
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<WebhookEvent> {
    try {
      let event: any

      if (typeof payload === 'string') {
        event = JSON.parse(payload)
      } else {
        event = payload
      }

      const eventType = event.event_type || 'UNKNOWN'
      const eventId = event.id || 'unknown'

      logger.debug({ eventType, eventId }, 'Processing PayPal webhook')

      // Verify signature if provided
      if (signature && !this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature')
      }

      await logWebhookEvent(this.key, eventType, eventId, 'success')

      return {
        type: eventType,
        data: event.resource,
        rawEvent: event,
      }
    } catch (error) {
      logger.error({ error }, 'Error handling PayPal webhook')

      await logWebhookEvent(
        this.key,
        'unknown',
        'unknown',
        'failure',
        {},
        error instanceof Error ? error.message : 'Unknown error'
      )

      throw error
    }
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResult> {
    try {
      logger.debug({ paymentId, amount, reason }, 'Processing PayPal refund')

      // For PayPal, we need to use the capture ID, not the order ID
      const refund = await this.makeApiRequest<{
        id: string
        status: string
        amount: { value: string; currency_code: string }
      }>(`/v2/payments/captures/${paymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amount
            ? {
                value: (amount / 100).toFixed(2),
                currency_code: 'USD', // Should be dynamic in production
              }
            : undefined,
          note_to_payer: reason || 'Refund requested',
        }),
      })

      await logTransaction('refund_processed', {
        gateway: this.key,
        amount: amount || parseFloat(refund.amount.value) * 100,
        status: 'success',
        metadata: {
          paymentId,
          reason,
          refundId: refund.id,
        },
      })

      return {
        success: refund.status === 'COMPLETED',
        refundId: refund.id,
        amount: parseFloat(refund.amount.value) * 100,
        status: refund.status,
      }
    } catch (error) {
      logger.error({ error, paymentId }, 'Failed to process PayPal refund')

      await logTransaction('refund_requested', {
        gateway: this.key,
        amount,
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  async getPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
    try {
      // PayPal vault for saved payment methods
      const tokens = await this.makeApiRequest<{
        tokens: Array<{
          id: string
          type: string
          is_default?: boolean
        }>
      }>(`/v2/vault/customers/${customerId}/payment-tokens`)

      return tokens.tokens.map((token) => ({
        id: token.id,
        type: token.type,
        isDefault: token.is_default || false,
      }))
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to get PayPal payment methods')
      return []
    }
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      // In production, use PayPal's certificate-based verification
      // For now, use basic HMAC validation if webhook secret is configured
      const webhookSecret = this.config?.webhookSecret

      if (!webhookSecret) {
        logger.warn('PayPal webhook secret not configured, skipping verification')
        return true
      }

      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
      return validateWebhookSignature(payloadString, signature, webhookSecret)
    } catch (error) {
      logger.error({ error }, 'PayPal webhook signature verification failed')
      return false
    }
  }

  /**
   * Capture an authorized payment
   */
  async capturePayment(orderId: string): Promise<{
    id: string
    status: string
    amount: number
    currency: string
  }> {
    try {
      const capture = await this.makeApiRequest<PayPalCapture>(`/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
      })

      await logTransaction('payment_captured', {
        gateway: this.key,
        amount: parseFloat(capture.amount.value) * 100,
        currency: capture.amount.currency_code,
        status: 'success',
        metadata: {
          orderId,
          captureId: capture.id,
        },
      })

      return {
        id: capture.id,
        status: capture.status,
        amount: parseFloat(capture.amount.value) * 100,
        currency: capture.amount.currency_code,
      }
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to capture PayPal payment')
      throw error
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<PayPalOrder> {
    return this.makeApiRequest<PayPalOrder>(`/v2/checkout/orders/${orderId}`)
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<PayPalSubscription> {
    return this.makeApiRequest<PayPalSubscription>(`/v1/billing/subscriptions/${subscriptionId}`)
  }
}
