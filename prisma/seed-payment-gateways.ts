/**
 * Seed script to initialize payment gateway configuration (per tenant)
 * Run: npx tsx prisma/seed-payment-gateways.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedForTenant(tenantId: string, tenantName: string) {
  // Create Stripe gateway
  const stripeGateway = await prisma.paymentGateway.upsert({
    where: { tenantId_key: { tenantId, key: 'stripe' } },
    update: {},
    create: {
      id: `${tenantId}_stripe`,
      tenantId,
      name: 'Stripe',
      key: 'stripe',
      description: 'International payments via Stripe',
      apiKey: process.env.STRIPE_SECRET_KEY || null,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
      isEnabled: true,
      isDefault: true,
      supportedCurrencies: JSON.stringify(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'AED']),
      supportedCountries: JSON.stringify([
        'US',
        'GB',
        'CA',
        'AU',
        'IN',
        'SG',
        'AE',
        'FR',
        'DE',
        'NL',
      ]),
      testMode: false,
      sortOrder: 1,
    },
  })

  // Create Razorpay gateway
  const razorpayGateway = await prisma.paymentGateway.upsert({
    where: { tenantId_key: { tenantId, key: 'razorpay' } },
    update: {},
    create: {
      id: `${tenantId}_razorpay`,
      tenantId,
      name: 'Razorpay',
      key: 'razorpay',
      description: 'Indian payments via Razorpay (UPI, Cards, Netbanking, Wallets)',
      publicKey: process.env.RAZORPAY_KEY_ID || null,
      apiSecret: process.env.RAZORPAY_KEY_SECRET || null,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || null,
      isEnabled: true,
      isDefault: false,
      supportedCurrencies: JSON.stringify(['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED']),
      supportedCountries: JSON.stringify(['IN', 'US', 'GB', 'SG', 'AE']),
      testMode: false,
      sortOrder: 2,
    },
  })

  // Create Stripe payment methods
  const stripeMethods = [
    { key: 'card', name: 'Credit/Debit Card', icon: 'card' },
    { key: 'bank_transfer', name: 'Bank Transfer', icon: 'bank' },
    { key: 'wallet', name: 'Digital Wallet', icon: 'wallet' },
  ]

  for (const method of stripeMethods) {
    await prisma.paymentMethod.upsert({
      where: { gatewayId_key: { gatewayId: stripeGateway.id, key: method.key } },
      update: {},
      create: {
        id: `${tenantId}_stripe_${method.key}`,
        gatewayId: stripeGateway.id,
        name: method.name,
        key: method.key,
        icon: method.icon,
        isEnabled: true,
        sortOrder: 0,
      },
    })
  }

  // Create Razorpay payment methods (Indian market)
  const razorpayMethods = [
    { key: 'upi', name: 'UPI', icon: 'upi', sortOrder: 1 },
    { key: 'card', name: 'Credit/Debit Card', icon: 'card', sortOrder: 2 },
    { key: 'netbanking', name: 'Net Banking', icon: 'bank', sortOrder: 3 },
    { key: 'wallet', name: 'Wallets', icon: 'wallet', sortOrder: 4 },
    { key: 'paylater', name: 'Pay Later', icon: 'clock', sortOrder: 5 },
    { key: 'emi', name: 'EMI', icon: 'credit-card', sortOrder: 6 },
  ]

  for (const method of razorpayMethods) {
    await prisma.paymentMethod.upsert({
      where: { gatewayId_key: { gatewayId: razorpayGateway.id, key: method.key } },
      update: {},
      create: {
        id: `${tenantId}_razorpay_${method.key}`,
        gatewayId: razorpayGateway.id,
        name: method.name,
        key: method.key,
        icon: method.icon,
        description: `${method.name} payment via Razorpay`,
        isEnabled: true,
        supportedCurrencies: JSON.stringify(['INR', 'USD']),
        supportedCountries: JSON.stringify(['IN']),
        sortOrder: method.sortOrder,
      },
    })
  }

  // Ensure subscription plans exist for gateway plan links
  const plans = [
    { key: 'free', name: 'Free', price: 0, interval: null as string | null, sortOrder: 1 },
    { key: 'monthly', name: 'Premium Monthly', price: 99900, interval: 'monthly', sortOrder: 2 },
    { key: 'yearly', name: 'Premium Yearly', price: 95900, interval: 'yearly', sortOrder: 3 },
  ]

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { tenantId_key: { tenantId, key: plan.key } },
      update: {},
      create: {
        id: `${tenantId}_plan_${plan.key}`,
        tenantId,
        key: plan.key,
        name: plan.name,
        description: `${plan.name} subscription`,
        price: plan.price,
        currency: 'USD',
        interval: plan.interval,
        isActive: true,
        isPopular: plan.key === 'monthly',
        sortOrder: plan.sortOrder,
        features: JSON.stringify([]),
      },
    })
  }

  // Gateway plans (placeholder external IDs - update via admin UI)
  const gatewayPlans = [
    {
      gatewayId: stripeGateway.id,
      planKey: 'monthly',
      gatewayPlanId: 'price_stripe_monthly_id',
      price: 99900,
      currency: 'USD',
      interval: 'monthly',
    },
    {
      gatewayId: stripeGateway.id,
      planKey: 'yearly',
      gatewayPlanId: 'price_stripe_yearly_id',
      price: 95900,
      currency: 'USD',
      interval: 'yearly',
    },
    {
      gatewayId: razorpayGateway.id,
      planKey: 'monthly',
      gatewayPlanId: 'plan_razorpay_monthly_id',
      price: 82900,
      currency: 'INR',
      interval: 'monthly',
    },
    {
      gatewayId: razorpayGateway.id,
      planKey: 'yearly',
      gatewayPlanId: 'plan_razorpay_yearly_id',
      price: 799900,
      currency: 'INR',
      interval: 'yearly',
    },
  ]

  for (const gp of gatewayPlans) {
    await prisma.gatewayPlan.upsert({
      where: {
        gatewayId_gatewayPlanId: { gatewayId: gp.gatewayId, gatewayPlanId: gp.gatewayPlanId },
      },
      update: {},
      create: {
        id: `gp_${gp.gatewayId}_${gp.planKey}`,
        gatewayId: gp.gatewayId,
        planId: gp.planKey,
        gatewayPlanId: gp.gatewayPlanId,
        name: `${gp.planKey === 'monthly' ? 'Monthly' : 'Yearly'} Plan`,
        description: `${gp.planKey === 'monthly' ? 'Monthly' : 'Yearly'} subscription for ${tenantName}`,
        price: gp.price,
        currency: gp.currency,
        interval: gp.interval,
        isActive: true,
        isPopular: gp.planKey === 'monthly',
        sortOrder: gp.planKey === 'monthly' ? 1 : 2,
      },
    })
  }

  console.log(`✅ Payment gateways + methods + gateway plans configured for ${tenantName}`)
}

async function main() {
  console.log('🌱 Seeding payment gateway configuration (all active tenants)...')

  const tenants = await prisma.tenant.findMany({ where: { status: 'active' } })
  if (tenants.length === 0) {
    console.error('No tenants found. Run the main seed first: npx prisma db seed')
    process.exit(1)
  }

  for (const t of tenants) {
    await seedForTenant(t.id, t.name)
  }

  console.log('\n🎉 Payment gateway seeding completed!')
  console.log('\n📝 Next steps:')
  console.log('1. Update Stripe Price IDs / Razorpay Plan IDs per tenant in the admin UI')
  console.log('2. Configure webhook URLs per tenant (append ?t=<tenant-slug>):')
  console.log('   - https://<tenant-domain>/api/payment/webhook/stripe?t=<slug>')
  console.log('   - https://<tenant-domain>/api/payment/webhook/razorpay?t=<slug>')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
