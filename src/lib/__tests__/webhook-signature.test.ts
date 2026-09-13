import { createHmac, randomBytes } from 'crypto'
import { describe, expect, it } from 'vitest'
import { RazorpayGateway } from '../payment/razorpay-gateway'

const buildGateway = (webhookSecret?: string): RazorpayGateway => {
  const gw = new RazorpayGateway()
  gw.initialize({
    name: 'Razorpay',
    key: 'razorpay',
    webhookSecret,
  })
  return gw
}

describe('Razorpay webhook signature verification', () => {
  const secret = `whsec_${randomBytes(16).toString('hex')}`

  it('accepts a correctly signed string payload', () => {
    const gw = buildGateway(secret)
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1' } } },
    })
    const sig = createHmac('sha256', secret).update(payload).digest('hex')
    expect(gw.verifyWebhookSignature(payload, sig)).toBe(true)
  })

  it('accepts an object payload (canonical JSON.stringify)', () => {
    const gw = buildGateway(secret)
    const obj = { event: 'order.paid', value: 42 }
    const sig = createHmac('sha256', secret).update(JSON.stringify(obj)).digest('hex')
    expect(gw.verifyWebhookSignature(obj, sig)).toBe(true)
  })

  it('rejects a tampered payload', () => {
    const gw = buildGateway(secret)
    const payload = JSON.stringify({ event: 'payment.captured', amount: 100 })
    const sig = createHmac('sha256', secret).update(payload).digest('hex')
    expect(
      gw.verifyWebhookSignature(JSON.stringify({ event: 'payment.captured', amount: 999999 }), sig)
    ).toBe(false)
  })

  it('rejects a wrong signature of equal length', () => {
    const gw = buildGateway(secret)
    const payload = '{"a":1}'
    const bad = createHmac('sha256', 'other-secret').update(payload).digest('hex')
    expect(gw.verifyWebhookSignature(payload, bad)).toBe(false)
  })

  it('rejects a wrong-length signature without throwing', () => {
    const gw = buildGateway(secret)
    expect(gw.verifyWebhookSignature('{"a":1}', 'short')).toBe(false)
  })

  it('returns false when no webhook secret is configured', () => {
    const gw = buildGateway(undefined)
    expect(gw.verifyWebhookSignature('x', 'y'.repeat(64))).toBe(false)
  })
})
