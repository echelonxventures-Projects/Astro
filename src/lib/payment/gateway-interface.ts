/**
 * Payment Gateway Interface
 * Universal interface for all payment gateways (Stripe, Razorpay, PayPal, etc.)
 */

export interface PaymentGatewayConfig {
  name: string
  key: string
  apiKey?: string
  apiSecret?: string
  publicKey?: string
  webhookSecret?: string
  testMode?: boolean
  config?: Record<string, any>
}

export interface CheckoutSessionOptions {
  userId: string
  email: string
  planId: string
  gatewayPlanId: string
  amount: number
  currency: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, any>
  paymentMethod?: string // 'card', 'upi', 'netbanking', etc.
}

export interface CheckoutSessionResult {
  id: string
  url?: string // For redirect-based checkout
  clientSecret?: string // For embedded checkout (Stripe)
  orderId?: string // For Razorpay
  status: string
  expiresAt?: Date
}

export interface SubscriptionOptions {
  userId: string
  email: string
  planId: string
  gatewayPlanId: string
  amount: number
  currency: string
  interval: string
  metadata?: Record<string, any>
}

export interface SubscriptionResult {
  id: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  customerId: string
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

export interface WebhookEvent {
  type: string
  data: any
  rawEvent: any
}

export interface RefundResult {
  success: boolean
  refundId: string
  amount: number
  status: string
}

export interface CustomerResult {
  id: string
  email: string
  name?: string
  metadata?: Record<string, any>
}

export interface PaymentMethodResult {
  id: string
  type: string
  isDefault: boolean
}

/**
 * Payment Gateway Interface
 * All payment gateways must implement this interface
 */
export interface IPaymentGateway {
  /**
   * Gateway name (display)
   */
  name: string

  /**
   * Gateway key (internal identifier)
   */
  key: string

  /**
   * Whether gateway is in test mode
   */
  testMode: boolean

  /**
   * Supported currencies
   */
  supportedCurrencies: string[]

  /**
   * Supported countries
   */
  supportedCountries: string[]

  /**
   * Initialize the gateway with configuration
   */
  initialize(config: PaymentGatewayConfig): void

  /**
   * Create a checkout session for one-time or subscription payment
   */
  createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult>

  /**
   * Create a customer in the gateway
   */
  createCustomer(email: string, name?: string, metadata?: Record<string, any>): Promise<CustomerResult>

  /**
   * Get customer details
   */
  getCustomer(customerId: string): Promise<CustomerResult>

  /**
   * Delete a customer
   */
  deleteCustomer(customerId: string): Promise<void>

  /**
   * Create a subscription
   */
  createSubscription(options: SubscriptionOptions): Promise<SubscriptionResult>

  /**
   * Cancel a subscription
   */
  cancelSubscription(subscriptionId: string, atPeriodEnd?: boolean): Promise<void>

  /**
   * Update a subscription
   */
  updateSubscription(subscriptionId: string, options: Partial<SubscriptionOptions>): Promise<SubscriptionResult>

  /**
   * Process and verify webhook events
   */
  handleWebhook(payload: any, signature: string): Promise<WebhookEvent>

  /**
   * Refund a payment
   */
  refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResult>

  /**
   * Get payment methods for a customer
   */
  getPaymentMethods(customerId: string): Promise<PaymentMethodResult[]>

  /**
   * Verify webhook signature (security)
   */
  verifyWebhookSignature(payload: any, signature: string): boolean
}

/**
 * Gateway factory interface for registry
 */
export interface GatewayFactory {
  new (): IPaymentGateway
}
