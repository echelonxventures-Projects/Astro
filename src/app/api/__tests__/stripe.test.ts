import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as webhookHandler } from '../stripe/webhook/route'

// Mock dependencies
const mockUserUpdate = vi.fn()
const mockUserUpdateMany = vi.fn()
const mockUserFindFirst = vi.fn()
const mockSubscriptionCreate = vi.fn()
const mockSubscriptionUpdate = vi.fn()
const mockPaymentCreate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: (...args: any[]) => mockUserUpdate(...args),
      updateMany: (...args: any[]) => mockUserUpdateMany(...args),
      findFirst: (...args: any[]) => mockUserFindFirst(...args)
    },
    subscription: {
      create: (...args: any[]) => mockSubscriptionCreate(...args),
      update: (...args: any[]) => mockSubscriptionUpdate(...args)
    },
    payment: {
      create: (...args: any[]) => mockPaymentCreate(...args)
    }
  }
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn()
    },
    subscriptions: {
      retrieve: vi.fn()
    }
  },
  handleWebhookEvent: vi.fn()
}))

const { stripe, handleWebhookEvent } = await import('@/lib/stripe')

function createWebhookRequest(body: string, signature: string): NextRequest {
  return {
    text: () => Promise.resolve(body)
  } as NextRequest
}

describe('Stripe Webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserUpdate.mockReset()
    mockUserUpdateMany.mockReset()
    mockUserFindFirst.mockReset()
    mockSubscriptionCreate.mockReset()
    mockSubscriptionUpdate.mockReset()
    mockPaymentCreate.mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
    // Restore environment
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy'
  })

  describe('POST /api/stripe/webhook', () => {
    it('should return success when Stripe is not configured', async () => {
      delete (process.env as any).STRIPE_SECRET_KEY

      const request = createWebhookRequest('{}', 'sig')

      const response = await webhookHandler(request)
      const data = await response.json()

      expect(data.received).toBe(true)
    })

    it('should reject invalid webhook signature', async () => {
      const body = '{}'
      const signature = 'invalid-signature'

      ;(stripe.webhooks.constructEvent as any).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const request = createWebhookRequest(body, signature)

      const response = await webhookHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid signature')
    })

    it('should handle checkout.session.completed', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_123',
            metadata: { userId: 'user-123', plan: 'monthly' },
            customer: 'cus_123',
            subscription: 'sub_123'
          }
        }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockResolvedValue({
        type: 'checkout_completed',
        subscriptionId: 'sub_123',
        customerId: 'cus_123',
        plan: 'monthly',
        userId: 'user-123'
      })

      ;(stripe.subscriptions.retrieve as any).mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      })

      mockUserUpdate.mockResolvedValue({})
      mockSubscriptionCreate.mockResolvedValue({})

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
      expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          subscriptionStatus: 'premium',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123'
        })
      }))
      expect(mockSubscriptionCreate).toHaveBeenCalled()
    })

    it('should handle customer.subscription.updated - active', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active'
          }
        }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockResolvedValue({
        type: 'subscription_updated',
        subscriptionId: 'sub_123',
        status: 'active',
        currentPeriodEnd: new Date(),
        plan: 'monthly'
      })

      mockSubscriptionUpdate.mockResolvedValue({})
      mockUserUpdateMany.mockResolvedValue({ count: 1 })

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)

      expect(response.status).toBe(200)
      expect(mockUserUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_123' },
        data: { subscriptionStatus: 'premium' }
      }))
    })

    it('should handle customer.subscription.updated - canceled', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'canceled'
          }
        }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockResolvedValue({
        type: 'subscription_updated',
        subscriptionId: 'sub_123',
        status: 'canceled',
        currentPeriodEnd: new Date(),
        plan: 'monthly'
      })

      mockSubscriptionUpdate.mockResolvedValue({})
      mockUserUpdateMany.mockResolvedValue({ count: 1 })

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)

      expect(response.status).toBe(200)
      expect(mockUserUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_123' },
        data: { subscriptionStatus: 'free' }
      }))
    })

    it('should handle customer.subscription.deleted', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123'
          }
        }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockResolvedValue({
        type: 'subscription_deleted',
        subscriptionId: 'sub_123'
      })

      mockSubscriptionUpdate.mockResolvedValue({})
      mockUserUpdateMany.mockResolvedValue({ count: 1 })

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)

      expect(response.status).toBe(200)
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_123' },
        data: expect.objectContaining({
          status: 'canceled',
          cancelAtPeriodEnd: true
        })
      }))
    })

    it('should handle invoice.payment_succeeded', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_123',
            payment_intent: 'pi_123',
            amount_paid: 1499,
            customer: 'cus_123'
          }
        }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockResolvedValue({
        type: 'payment_succeeded',
        paymentId: 'pi_123',
        amount: 1499,
        customerId: 'cus_123'
      })

      mockUserFindFirst.mockResolvedValue({ id: 'user-123' })
      mockPaymentCreate.mockResolvedValue({})

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)

      expect(response.status).toBe(200)
      expect(mockPaymentCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-123',
          stripePaymentId: 'pi_123',
          amount: 1499,
          status: 'succeeded'
        })
      }))
    })

    it('should handle invoice.payment_failed', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            payment_intent: 'pi_123',
            customer: 'cus_123'
          }
        }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockResolvedValue({
        type: 'payment_failed',
        paymentId: 'pi_123',
        customerId: 'cus_123'
      })

      mockUserUpdateMany.mockResolvedValue({ count: 1 })

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)

      expect(response.status).toBe(200)
      expect(mockUserUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { stripeCustomerId: 'cus_123' },
        data: { subscriptionStatus: 'past_due' }
      }))
    })

    it('should handle unhandled event types gracefully', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'customer.created',
        data: { object: {} }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockResolvedValue({ type: 'unhandled' })

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
    })

    it('should handle missing userId in checkout metadata', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_123',
            metadata: { plan: 'monthly' }, // Missing userId
            customer: 'cus_123',
            subscription: 'sub_123'
          }
        }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockImplementation(() => {
        throw new Error('Missing userId or plan in session metadata')
      })

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Webhook handler failed')
    })

    it('should handle webhook handler errors', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: {} }
      }

      ;(stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent)
      ;(handleWebhookEvent as any).mockRejectedValue(new Error('Processing error'))

      const request = createWebhookRequest(JSON.stringify(mockEvent), 'sig')

      const response = await webhookHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Webhook handler failed')
    })
  })
})
