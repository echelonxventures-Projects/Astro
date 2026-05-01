/**
 * Seed script to initialize payment gateway configuration
 * Run: npx tsx prisma/seed-payment-gateways.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding payment gateway configuration...')

  // Create Stripe gateway
  const stripeGateway = await prisma.paymentGateway.upsert({
    where: { key: 'stripe' },
    update: {},
    create: {
      id: 'stripe_1',
      name: 'Stripe',
      key: 'stripe',
      description: 'International payments via Stripe',
      apiKey: process.env.STRIPE_SECRET_KEY || null,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
      isEnabled: true,
      isDefault: true,
      supportedCurrencies: JSON.stringify(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'AED']),
      supportedCountries: JSON.stringify(['US', 'GB', 'CA', 'AU', 'IN', 'SG', 'AE', 'FR', 'DE', 'NL']),
      testMode: false,
      sortOrder: 1,
    },
  })
  console.log('✅ Stripe gateway configured')

  // Create Razorpay gateway
  const razorpayGateway = await prisma.paymentGateway.upsert({
    where: { key: 'razorpay' },
    update: {},
    create: {
      id: 'razorpay_1',
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
  console.log('✅ Razorpay gateway configured')

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
        id: `stripe_${method.key}`,
        gatewayId: stripeGateway.id,
        name: method.name,
        key: method.key,
        icon: method.icon,
        isEnabled: true,
        sortOrder: 0,
      },
    })
  }
  console.log('✅ Stripe payment methods configured')

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
        id: `razorpay_${method.key}`,
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
  console.log('✅ Razorpay payment methods configured (UPI, Cards, Netbanking, Wallets, PayLater, EMI)')

  // Create subscription plans if they don't exist
  const plans = [
    {
      key: 'free',
      name: 'Free',
      description: 'Basic features with limited access',
      price: 0,
      currency: 'USD',
      interval: null,
      isActive: true,
      isPopular: false,
      sortOrder: 1,
      features: JSON.stringify(['Daily Horoscope', 'Basic Chat', 'Limited AI Readings']),
    },
    {
      key: 'monthly',
      name: 'Premium Monthly',
      description: 'Full access with monthly billing',
      price: 99900, // $9.99 in cents
      currency: 'USD',
      interval: 'monthly',
      isActive: true,
      isPopular: true,
      sortOrder: 2,
      features: JSON.stringify(['Unlimited AI Readings', 'Priority Support', 'All Reports', 'No Ads']),
    },
    {
      key: 'yearly',
      name: 'Premium Yearly',
      description: 'Full access with annual billing (save 20%)',
      price: 95900, // $95.90 in cents (equivalent to $7.99/month)
      currency: 'USD',
      interval: 'yearly',
      isActive: true,
      isPopular: false,
      sortOrder: 3,
      features: JSON.stringify(['Unlimited AI Readings', 'Priority Support', 'All Reports', 'No Ads', 'Early Access']),
    },
  ]

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { key: plan.key },
      update: {},
      create: {
        id: `plan_${plan.key}`,
        ...plan,
      },
    })
  }
  console.log('✅ Subscription plans configured')

  // Create gateway plans (linking subscription plans to gateway-specific plan IDs)
  // For Stripe, you would use Stripe Price IDs
  // For Razorpay, you would use Razorpay Plan IDs
  // These are placeholders - update with actual IDs from your payment gateway dashboards

  const gatewayPlans = [
    {
      gatewayId: stripeGateway.id,
      planKey: 'monthly',
      gatewayPlanId: 'price_stripe_monthly_id', // Replace with actual Stripe Price ID
      price: 99900,
      currency: 'USD',
      interval: 'monthly',
    },
    {
      gatewayId: stripeGateway.id,
      planKey: 'yearly',
      gatewayPlanId: 'price_stripe_yearly_id', // Replace with actual Stripe Price ID
      price: 95900,
      currency: 'USD',
      interval: 'yearly',
    },
    {
      gatewayId: razorpayGateway.id,
      planKey: 'monthly',
      gatewayPlanId: 'plan_razorpay_monthly_id', // Replace with actual Razorpay Plan ID
      price: 82900, // ₹829 in paise
      currency: 'INR',
      interval: 'monthly',
    },
    {
      gatewayId: razorpayGateway.id,
      planKey: 'yearly',
      gatewayPlanId: 'plan_razorpay_yearly_id', // Replace with actual Razorpay Plan ID
      price: 799900, // ₹7,999 in paise
      currency: 'INR',
      interval: 'yearly',
    },
  ]

  for (const gp of gatewayPlans) {
    await prisma.gatewayPlan.upsert({
      where: { gatewayId_gatewayPlanId: { gatewayId: gp.gatewayId, gatewayPlanId: gp.gatewayPlanId } },
      update: {},
      create: {
        id: `gp_${gp.gatewayId}_${gp.planKey}`,
        gatewayId: gp.gatewayId,
        planId: gp.planKey,
        gatewayPlanId: gp.gatewayPlanId,
        name: `${gp.planKey === 'monthly' ? 'Monthly' : 'Yearly'} Plan`,
        description: `${gp.planKey === 'monthly' ? 'Monthly' : 'Yearly'} subscription via ${gp.gatewayId === stripeGateway.id ? 'Stripe' : 'Razorpay'}`,
        price: gp.price,
        currency: gp.currency,
        interval: gp.interval,
        isActive: true,
        isPopular: gp.planKey === 'monthly',
        sortOrder: gp.planKey === 'monthly' ? 1 : 2,
      },
    })
  }
  console.log('✅ Gateway plans configured')

  console.log('\n🎉 Payment gateway seeding completed!')
  console.log('\n📝 Next steps:')
  console.log('1. Update Stripe Price IDs in GatewayPlan table')
  console.log('2. Update Razorpay Plan IDs in GatewayPlan table')
  console.log('3. Configure webhook URLs in Stripe and Razorpay dashboards:')
  console.log('   - Stripe: https://astro.echelonxventures.org/api/payment/webhook/stripe')
  console.log('   - Razorpay: https://astro.echelonxventures.org/api/payment/webhook/razorpay')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
