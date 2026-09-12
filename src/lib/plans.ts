/**
 * Dynamic Subscription Plan Management
 * Fetches and manages subscription plans from database
 */

import { prisma } from '@/lib/db'

export interface SubscriptionPlanConfig {
  id: string
  name: string
  key: string
  description: string | null
  price: number // In cents
  currency: string
  interval: string | null
  stripePriceId: string | null
  stripeProductId: string | null
  isActive: boolean
  isPopular: boolean
  sortOrder: number
  features: string[]
  aiConfig: {
    provider: string
    model: string
    maxTokens: number
  } | null
  regionalPricing: Record<string, RegionalPriceConfig> | null
}

export interface RegionalPriceConfig {
  price: number
  currency: string
  stripePriceId?: string
  displayPrice?: string
}

export interface RegionConfig {
  id: string
  name: string
  key: string
  code: string
  currency: string
  currencies: Array<{ code: string; symbol: string; name: string }> | null
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  priceMultiplier: number
}

export interface PlanFeatureConfig {
  id: string
  name: string
  key: string
  description: string | null
  category: string | null
  sortOrder: number
  isActive: boolean
}

export interface PlanFeatureAccessConfig {
  id: string
  planId: string
  featureId: string
  enabled: boolean
  value: string | null
}

/**
 * Currency symbols and formatting config
 */
export const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string }> = {
  usd: { symbol: '$', locale: 'en-US' },
  eur: { symbol: '€', locale: 'de-DE' },
  gbp: { symbol: '£', locale: 'en-GB' },
  inr: { symbol: '₹', locale: 'en-IN' },
  jpy: { symbol: '¥', locale: 'ja-JP' },
  aud: { symbol: 'A$', locale: 'en-AU' },
  cad: { symbol: 'C$', locale: 'en-CA' },
  chf: { symbol: 'CHF', locale: 'de-CH' },
  cny: { symbol: '¥', locale: 'zh-CN' },
  brl: { symbol: 'R$', locale: 'pt-BR' },
}

/**
 * Format price from cents to display string
 */
export function formatPrice(priceCents: number, currency: string): string {
  const config = CURRENCY_CONFIG[currency.toLowerCase()] || { symbol: '$', locale: 'en-US' }
  const amount = priceCents / 100

  if (currency.toLowerCase() === 'inr') {
    // Indian numbering format (lakhs and crores)
    return `${config.symbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  return `${config.symbol}${amount.toLocaleString(config.locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/**
 * Get all active subscription plans ordered by sort order
 */
export async function getActivePlans(tenantId: string): Promise<SubscriptionPlanConfig[]> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      featureAccess: {
        include: {
          feature: true,
        },
      },
    },
  })

  return plans.map(plan => ({
    ...plan,
    features: plan.features ? JSON.parse(plan.features) : [],
    aiConfig: plan.aiConfig ? JSON.parse(plan.aiConfig) : null,
    regionalPricing: plan.regionalPricing ? JSON.parse(plan.regionalPricing) : null,
  }))
}

/**
 * Get a specific plan by key
 */
export async function getPlanByKey(
  tenantId: string,
  key: string
): Promise<SubscriptionPlanConfig | null> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { tenantId_key: { tenantId, key } },
  })

  if (!plan) return null

  return {
    ...plan,
    features: plan.features ? JSON.parse(plan.features) : [],
    aiConfig: plan.aiConfig ? JSON.parse(plan.aiConfig) : null,
    regionalPricing: plan.regionalPricing ? JSON.parse(plan.regionalPricing) : null,
  }
}

/**
 * Get plan with regional pricing for a specific region
 */
export async function getPlanWithRegionalPricing(
  tenantId: string,
  key: string,
  regionKey: string
): Promise<SubscriptionPlanConfig | null> {
  const plan = await getPlanByKey(tenantId, key)
  if (!plan) return null

  // Apply regional pricing if available
  if (plan.regionalPricing && plan.regionalPricing[regionKey]) {
    const regionalPrice = plan.regionalPricing[regionKey]
    return {
      ...plan,
      price: regionalPrice.price,
      currency: regionalPrice.currency,
      stripePriceId: regionalPrice.stripePriceId || plan.stripePriceId,
    }
  }

  return plan
}

/**
 * Get all active regions
 */
export async function getActiveRegions(): Promise<RegionConfig[]> {
  const regions = await prisma.region.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return regions.map(region => ({
    ...region,
    currencies: region.currencies ? JSON.parse(region.currencies) : null,
  }))
}

/**
 * Get default region
 */
export async function getDefaultRegion(): Promise<RegionConfig | null> {
  const region = await prisma.region.findFirst({
    where: { isActive: true, isDefault: true },
  })

  if (!region) {
    // Fallback to first active region
    const regions = await getActiveRegions()
    return regions[0] || null
  }

  return {
    ...region,
    currencies: region.currencies ? JSON.parse(region.currencies) : null,
  }
}

/**
 * Get region by key
 */
export async function getRegionByKey(key: string): Promise<RegionConfig | null> {
  const region = await prisma.region.findUnique({
    where: { key },
  })

  if (!region) return null

  return {
    ...region,
    currencies: region.currencies ? JSON.parse(region.currencies) : null,
  }
}

/**
 * Get all active features for comparison table
 */
export async function getActiveFeatures(tenantId: string): Promise<PlanFeatureConfig[]> {
  const features = await prisma.planFeature.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return features
}

/**
 * Get feature access matrix for all plans
 * Returns a map of planKey -> featureKey -> { enabled, value }
 */
export async function getFeatureAccessMatrix(
  tenantId: string
): Promise<Record<string, Record<string, { enabled: boolean; value: string | null }>>> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { tenantId, isActive: true },
    include: {
      featureAccess: {
        include: {
          feature: true,
        },
      },
    },
  })

  const matrix: Record<string, Record<string, { enabled: boolean; value: string | null }>> = {}

  for (const plan of plans) {
    matrix[plan.key] = {}
    for (const access of plan.featureAccess) {
      matrix[plan.key][access.feature.key] = {
        enabled: access.enabled,
        value: access.value,
      }
    }
  }

  return matrix
}

/**
 * Get a specific plan by ID
 */
export async function getPlanById(id: string): Promise<SubscriptionPlanConfig | null> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
  })

  if (!plan) return null

  return {
    ...plan,
    features: plan.features ? JSON.parse(plan.features) : [],
    aiConfig: plan.aiConfig ? JSON.parse(plan.aiConfig) : null,
    regionalPricing: plan.regionalPricing ? JSON.parse(plan.regionalPricing) : null,
  }
}

/**
 * Create a new subscription plan
 */
export async function createPlan(data: {
  tenantId: string
  name: string
  key: string
  description?: string
  price: number
  currency?: string
  interval?: string
  stripePriceId?: string
  stripeProductId?: string
  isPopular?: boolean
  sortOrder?: number
  features: string[]
  aiConfig?: {
    provider: string
    model: string
    maxTokens: number
  }
}): Promise<SubscriptionPlanConfig> {
  const plan = await prisma.subscriptionPlan.create({
    data: {
      ...data,
      features: JSON.stringify(data.features),
      aiConfig: data.aiConfig ? JSON.stringify(data.aiConfig) : null,
    },
  })

  return {
    ...plan,
    features: plan.features ? JSON.parse(plan.features) : [],
    aiConfig: plan.aiConfig ? JSON.parse(plan.aiConfig) : null,
    regionalPricing: plan.regionalPricing ? JSON.parse(plan.regionalPricing) : null,
  }
}

/**
 * Update an existing subscription plan
 */
export async function updatePlan(
  id: string,
  data: Partial<{
    name: string
    key: string
    description: string
    price: number
    currency: string
    interval: string
    stripePriceId: string
    stripeProductId: string
    isActive: boolean
    isPopular: boolean
    sortOrder: number
    features: string[]
    aiConfig: {
      provider: string
      model: string
      maxTokens: number
    }
    regionalPricing: Record<string, RegionalPriceConfig>
  }>
): Promise<SubscriptionPlanConfig> {
  const updateData: any = {}

  if (data.features !== undefined) {
    updateData.features = JSON.stringify(data.features)
  }
  if (data.aiConfig !== undefined) {
    updateData.aiConfig = JSON.stringify(data.aiConfig)
  }
  if (data.regionalPricing !== undefined) {
    updateData.regionalPricing = JSON.stringify(data.regionalPricing)
  }

  Object.keys(data).forEach(key => {
    if (
      key !== 'features' &&
      key !== 'aiConfig' &&
      key !== 'regionalPricing' &&
      data[key as keyof typeof data] !== undefined
    ) {
      updateData[key] = data[key as keyof typeof data]
    }
  })

  const plan = await prisma.subscriptionPlan.update({
    where: { id },
    data: updateData,
  })

  return {
    ...plan,
    features: plan.features ? JSON.parse(plan.features) : [],
    aiConfig: plan.aiConfig ? JSON.parse(plan.aiConfig) : null,
    regionalPricing: plan.regionalPricing ? JSON.parse(plan.regionalPricing) : null,
  }
}

/**
 * Delete a subscription plan
 */
export async function deletePlan(id: string): Promise<void> {
  await prisma.subscriptionPlan.delete({
    where: { id },
  })
}

/**
 * Create a new feature
 */
export async function createFeature(data: {
  tenantId: string
  name: string
  key: string
  description?: string
  category?: string
  sortOrder?: number
}): Promise<PlanFeatureConfig> {
  return prisma.planFeature.create({
    data,
  })
}

/**
 * Update a feature
 */
export async function updateFeature(
  id: string,
  data: Partial<{
    name: string
    key: string
    description: string
    category: string
    sortOrder: number
    isActive: boolean
  }>
): Promise<PlanFeatureConfig> {
  return prisma.planFeature.update({
    where: { id },
    data,
  })
}

/**
 * Delete a feature
 */
export async function deleteFeature(id: string): Promise<void> {
  await prisma.planFeature.delete({
    where: { id },
  })
}

/**
 * Create a new region
 */
export async function createRegion(data: {
  name: string
  key: string
  code: string
  currency?: string
  currencies?: Array<{ code: string; symbol: string; name: string }>
  isDefault?: boolean
  sortOrder?: number
  priceMultiplier?: number
}): Promise<RegionConfig> {
  const region = await prisma.region.create({
    data: {
      ...data,
      currencies: data.currencies ? JSON.stringify(data.currencies) : null,
    },
  })

  return {
    ...region,
    currencies: region.currencies ? JSON.parse(region.currencies) : null,
  }
}

/**
 * Update a region
 */
export async function updateRegion(
  id: string,
  data: Partial<{
    name: string
    key: string
    code: string
    currency: string
    currencies: Array<{ code: string; symbol: string; name: string }>
    isActive: boolean
    isDefault: boolean
    sortOrder: number
    priceMultiplier: number
  }>
): Promise<RegionConfig> {
  const updateData: any = {}

  if (data.currencies !== undefined) {
    updateData.currencies = JSON.stringify(data.currencies)
  }

  Object.keys(data).forEach(key => {
    if (key !== 'currencies' && data[key as keyof typeof data] !== undefined) {
      updateData[key] = data[key as keyof typeof data]
    }
  })

  const region = await prisma.region.update({
    where: { id },
    data: updateData,
  })

  return {
    ...region,
    currencies: region.currencies ? JSON.parse(region.currencies) : null,
  }
}

/**
 * Delete a region
 */
export async function deleteRegion(id: string): Promise<void> {
  await prisma.region.delete({
    where: { id },
  })
}

/**
 * Get a region by key with parsed currencies
 */
export async function getRegionByKeyWithCurrencies(key: string): Promise<RegionConfig | null> {
  const region = await prisma.region.findUnique({
    where: { key },
  })

  if (!region) return null

  return {
    ...region,
    currencies: region.currencies ? JSON.parse(region.currencies) : null,
  }
}

/**
 * Set feature access for a plan
 */
export async function setFeatureAccess(
  planId: string,
  featureId: string,
  enabled: boolean,
  value?: string | null
): Promise<void> {
  await prisma.planFeatureAccess.upsert({
    where: {
      planId_featureId: {
        planId,
        featureId,
      },
    },
    create: {
      planId,
      featureId,
      enabled,
      value: value ?? null,
    },
    update: {
      enabled,
      value: value ?? null,
    },
  })
}

/**
 * Initialize default subscription plans and features
 */
export async function initializeDefaultPlans(tenantId: string): Promise<void> {
  // Create default regions first
  const defaultRegions = [
    {
      key: 'us',
      name: 'United States',
      code: 'US',
      currency: 'usd',
      currencies: [{ code: 'usd', symbol: '$', name: 'US Dollar' }],
      isDefault: true,
      sortOrder: 0,
      priceMultiplier: 1.0,
    },
    {
      key: 'eu',
      name: 'Europe',
      code: 'EU',
      currency: 'eur',
      currencies: [
        { code: 'eur', symbol: '€', name: 'Euro' },
        { code: 'gbp', symbol: '£', name: 'British Pound' },
      ],
      isDefault: false,
      sortOrder: 1,
      priceMultiplier: 0.92,
    },
    {
      key: 'in',
      name: 'India',
      code: 'IN',
      currency: 'inr',
      currencies: [{ code: 'inr', symbol: '₹', name: 'Indian Rupee' }],
      isDefault: false,
      sortOrder: 2,
      priceMultiplier: 83.5,
    },
    {
      key: 'uk',
      name: 'United Kingdom',
      code: 'GB',
      currency: 'gbp',
      currencies: [{ code: 'gbp', symbol: '£', name: 'British Pound' }],
      isDefault: false,
      sortOrder: 3,
      priceMultiplier: 0.79,
    },
    {
      key: 'global',
      name: 'Global',
      code: 'GLOBAL',
      currency: 'usd',
      currencies: [
        { code: 'usd', symbol: '$', name: 'US Dollar' },
        { code: 'eur', symbol: '€', name: 'Euro' },
        { code: 'gbp', symbol: '£', name: 'British Pound' },
        { code: 'inr', symbol: '₹', name: 'Indian Rupee' },
        { code: 'aud', symbol: 'A$', name: 'Australian Dollar' },
        { code: 'cad', symbol: 'C$', name: 'Canadian Dollar' },
      ],
      isDefault: false,
      sortOrder: 4,
      priceMultiplier: 1.0,
    },
  ]

  for (const regionData of defaultRegions) {
    const existing = await prisma.region.findUnique({
      where: { key: regionData.key },
    })

    if (!existing) {
      await prisma.region.create({
        data: {
          ...regionData,
          currencies: JSON.stringify(regionData.currencies),
        },
      })
    }
  }

  // Create default features first
  const defaultFeatures = [
    { key: 'daily_horoscope', name: 'Daily Horoscope', category: 'readings', sortOrder: 0 },
    { key: 'basic_birth_chart', name: 'Basic Birth Chart', category: 'readings', sortOrder: 1 },
    { key: 'ai_readings', name: 'AI Readings / month', category: 'ai', sortOrder: 2 },
    { key: 'love_horoscope', name: 'Love Horoscope', category: 'readings', sortOrder: 3 },
    { key: 'career_horoscope', name: 'Career Horoscope', category: 'readings', sortOrder: 4 },
    {
      key: 'compatibility_reading',
      name: 'Compatibility Reading',
      category: 'readings',
      sortOrder: 5,
    },
    { key: 'ai_chat', name: 'AI Chat', category: 'ai', sortOrder: 6 },
    { key: 'transit_forecasts', name: 'Transit Forecasts', category: 'readings', sortOrder: 7 },
    { key: 'priority_support', name: 'Priority Support', category: 'support', sortOrder: 8 },
    { key: 'early_access', name: 'Early Access', category: 'support', sortOrder: 9 },
  ]

  for (const featureData of defaultFeatures) {
    const existing = await prisma.planFeature.findFirst({
      where: { tenantId, key: featureData.key },
    })

    if (!existing) {
      await createFeature({ ...featureData, tenantId })
    }
  }

  // Create default plans with regional pricing
  const defaultPlans = [
    {
      key: 'free',
      name: 'Free',
      description: 'Forever free with basic features',
      price: 0,
      currency: 'usd',
      interval: null,
      isPopular: false,
      sortOrder: 0,
      features: [
        'Daily horoscope',
        'Basic birth chart',
        '3 AI readings per month',
        'Email support',
      ],
      regionalPricing: {},
      featureAccess: {
        daily_horoscope: { enabled: true, value: null },
        basic_birth_chart: { enabled: true, value: null },
        ai_readings: { enabled: true, value: '3' },
        love_horoscope: { enabled: false, value: null },
        career_horoscope: { enabled: false, value: null },
        compatibility_reading: { enabled: false, value: null },
        ai_chat: { enabled: false, value: null },
        transit_forecasts: { enabled: false, value: null },
        priority_support: { enabled: false, value: null },
        early_access: { enabled: false, value: null },
      },
      aiConfig: {
        provider: 'ollama',
        model: 'llama3.2',
        maxTokens: 512,
      },
    },
    {
      key: 'monthly',
      name: 'Premium Monthly',
      description: 'Unlock all features with monthly billing',
      price: 1499, // $14.99 USD
      currency: 'usd',
      interval: 'monthly',
      isPopular: true,
      sortOrder: 1,
      features: [
        'Unlimited AI readings',
        'Detailed birth chart analysis',
        'Compatibility readings',
        'Love & career horoscopes',
        'Chat with AI astrologer',
        'Transit forecasts',
        'Priority support',
      ],
      // Regional pricing overrides
      regionalPricing: {
        eu: { price: 1399, currency: 'eur', displayPrice: '€13.99' }, // €13.99
        in: { price: 99900, currency: 'inr', displayPrice: '₹999' }, // ₹999
        uk: { price: 1199, currency: 'gbp', displayPrice: '£11.99' }, // £11.99
      },
      featureAccess: {
        daily_horoscope: { enabled: true, value: null },
        basic_birth_chart: { enabled: true, value: null },
        ai_readings: { enabled: true, value: 'Unlimited' },
        love_horoscope: { enabled: true, value: null },
        career_horoscope: { enabled: true, value: null },
        compatibility_reading: { enabled: true, value: null },
        ai_chat: { enabled: true, value: null },
        transit_forecasts: { enabled: true, value: null },
        priority_support: { enabled: true, value: null },
        early_access: { enabled: false, value: null },
      },
      aiConfig: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 2048,
      },
    },
    {
      key: 'yearly',
      name: 'Premium Yearly',
      description: 'Best value - get 2 months free',
      price: 14990, // $149.90 USD
      currency: 'usd',
      interval: 'yearly',
      isPopular: false,
      sortOrder: 2,
      features: [
        'Everything in Monthly',
        '2 months free',
        'Priority support',
        'Early access to new features',
        'Exclusive content',
      ],
      // Regional pricing overrides
      regionalPricing: {
        eu: { price: 13990, currency: 'eur', displayPrice: '€139.90' }, // €139.90
        in: { price: 999900, currency: 'inr', displayPrice: '₹9,999' }, // ₹9,999
        uk: { price: 11990, currency: 'gbp', displayPrice: '£119.90' }, // £119.90
      },
      featureAccess: {
        daily_horoscope: { enabled: true, value: null },
        basic_birth_chart: { enabled: true, value: null },
        ai_readings: { enabled: true, value: 'Unlimited' },
        love_horoscope: { enabled: true, value: null },
        career_horoscope: { enabled: true, value: null },
        compatibility_reading: { enabled: true, value: null },
        ai_chat: { enabled: true, value: null },
        transit_forecasts: { enabled: true, value: null },
        priority_support: { enabled: true, value: null },
        early_access: { enabled: true, value: null },
      },
      aiConfig: {
        provider: 'anthropic',
        model: 'claude-opus-4-20250514',
        maxTokens: 4096,
      },
    },
  ]

  for (const planData of defaultPlans) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { tenantId_key: { tenantId, key: planData.key } },
    })

    if (!existing) {
      const plan = await prisma.subscriptionPlan.create({
        data: {
          tenantId,
          name: planData.name,
          key: planData.key,
          description: planData.description,
          price: planData.price,
          currency: planData.currency,
          interval: planData.interval as any,
          isPopular: planData.isPopular,
          sortOrder: planData.sortOrder,
          features: JSON.stringify(planData.features),
          aiConfig: JSON.stringify(planData.aiConfig),
          regionalPricing: JSON.stringify(planData.regionalPricing),
        },
      })

      // Set up feature access
      const features = await getActiveFeatures(tenantId)
      for (const [featureKey, access] of Object.entries(planData.featureAccess || {})) {
        const feature = features.find(f => f.key === featureKey)
        if (feature) {
          await setFeatureAccess(plan.id, feature.id, access.enabled, access.value)
        }
      }
    }
  }
}
