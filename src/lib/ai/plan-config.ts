/**
 * AI Plan Configuration Management
 * Manages AI model settings per subscription tier
 */

import { prisma } from '@/lib/db'

export interface AIPlanConfig {
  id?: string
  name: string
  plan: 'free' | 'monthly' | 'yearly' | string
  provider: 'ollama' | 'anthropic' | 'gemini' | 'nvidia' | 'opencode' | string
  model: string
  apiKey?: string | null
  ollamaUrl?: string | null
  baseUrl?: string | null
  maxTokens: number
  enabled: boolean
  isDefault?: boolean
  description?: string | null
}

/**
 * Get AI configuration for a specific plan
 */
export async function getAIPlanConfig(plan: string): Promise<AIPlanConfig | null> {
  const config = await prisma.aIProviderConfig.findUnique({
    where: { id: plan },
  })
  if (!config) return null
  return {
    ...config,
    plan: config.plan || 'free',
  }
}

/**
 * Get all AI plan configurations
 */
export async function getAllAIPlanConfigs(): Promise<AIPlanConfig[]> {
  const configs = await prisma.aIProviderConfig.findMany({
    orderBy: { plan: 'asc' },
  })
  return configs.map(c => ({
    ...c,
    plan: c.plan || 'free',
  }))
}

/**
 * Update or create AI plan configuration
 */
export async function updateAIPlanConfig(
  plan: string,
  config: Partial<AIPlanConfig>
): Promise<AIPlanConfig> {
  const result = await prisma.aIProviderConfig.upsert({
    where: { id: plan },
    update: config,
    create: {
      id: plan,
      name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan AI`,
      plan: plan as string,
      provider: 'ollama',
      model: 'llama3.2',
      maxTokens: 512,
      enabled: true,
      ...config,
    },
  })
  return {
    ...result,
    plan: result.plan || plan,
  }
}

/**
 * Get AI provider configuration based on user's subscription
 */
export async function getAIConfigForUser(subscriptionStatus: string): Promise<{
  provider: string
  model: string
  apiKey?: string | null
  ollamaUrl?: string | null
  maxTokens: number
}> {
  // Map subscription status to plan
  let plan: 'free' | 'monthly' | 'yearly' = 'free'
  if (subscriptionStatus === 'premium' || subscriptionStatus === 'active') {
    plan = 'monthly' // Default to monthly for premium users
  }

  // Get config for plan
  const config = await getAIPlanConfig(plan)

  if (config && config.enabled) {
    return {
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      ollamaUrl: config.ollamaUrl || 'http://localhost:11434',
      maxTokens: config.maxTokens,
    }
  }

  // Fallback to free plan if configured plan is disabled
  const fallbackConfig = await getAIPlanConfig('free')
  return {
    provider: fallbackConfig?.provider || 'nvidia',
    model: fallbackConfig?.model || 'meta/llama-3.1-8b-instruct',
    apiKey: fallbackConfig?.apiKey,
    ollamaUrl: fallbackConfig?.ollamaUrl || 'http://localhost:11434',
    maxTokens: fallbackConfig?.maxTokens || 512,
  }
}

/**
 * Initialize default AI plan configurations
 */
export async function initializeDefaultAIPlanConfigs(): Promise<void> {
  const defaultConfigs = [
    {
      plan: 'free',
      provider: 'nvidia',
      model: 'meta/llama-3.1-8b-instruct',
      maxTokens: 512,
      enabled: true,
      description: 'Free tier - Uses NVIDIA NIM with Llama 3.1 8B',
    },
    {
      plan: 'monthly',
      provider: 'nvidia',
      model: 'meta/llama-3.1-8b-instruct',
      maxTokens: 2048,
      enabled: true,
      description: 'Premium Monthly - Uses NVIDIA NIM with Llama 3.1 8B (higher limits)',
    },
    {
      plan: 'yearly',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      enabled: true,
      description: 'Premium Yearly - Uses Claude Sonnet (most capable)',
    },
  ]

  for (const config of defaultConfigs) {
    await updateAIPlanConfig(config.plan, config)
  }
}
