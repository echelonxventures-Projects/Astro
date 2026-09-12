/**
 * Application Settings Management (per tenant)
 * Get/set app settings from database with in-memory caching
 */

import { prisma } from './db'

interface SettingsCache {
  [cacheKey: string]: {
    value: string
    timestamp: number
  }
}

const CACHE: SettingsCache = {}
const CACHE_TTL = 5000 // 5 seconds cache TTL

const ck = (tenantId: string, key: string): string => `${tenantId}:${key}`

/**
 * Get a single setting by key (within tenant)
 */
export async function getSetting(tenantId: string, key: string): Promise<string | null> {
  const cached = CACHE[ck(tenantId, key)]
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value
  }

  // Fetch from database
  const setting = await prisma.appSettings.findUnique({
    where: { tenantId_key: { tenantId, key } },
  })

  if (!setting) {
    return null
  }

  CACHE[ck(tenantId, key)] = {
    value: setting.value,
    timestamp: Date.now(),
  }

  return setting.value
}

/**
 * Get multiple settings by keys (within tenant)
 */
export async function getSettings(
  tenantId: string,
  keys: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  const missingKeys: string[] = []
  for (const key of keys) {
    const cached = CACHE[ck(tenantId, key)]
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[key] = cached.value
    } else {
      missingKeys.push(key)
    }
  }

  if (missingKeys.length > 0) {
    const settings = await prisma.appSettings.findMany({
      where: { tenantId, key: { in: missingKeys } },
    })

    for (const setting of settings) {
      result[setting.key] = setting.value
      CACHE[ck(tenantId, setting.key)] = {
        value: setting.value,
        timestamp: Date.now(),
      }
    }
  }

  return result
}

/**
 * Set a setting value (within tenant)
 */
export async function setSetting(
  tenantId: string,
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await prisma.appSettings.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { value },
    create: { tenantId, key, value, description },
  })

  CACHE[ck(tenantId, key)] = {
    value,
    timestamp: Date.now(),
  }
}

/**
 * Get AI provider configuration for a tenant
 */
export async function getAIProviderConfig(tenantId: string): Promise<{
  provider: string
  model: string
  ollamaUrl: string
  anthropicApiKey: string
  geminiApiKey: string
}> {
  const settings = await getSettings(tenantId, [
    'AI_PROVIDER',
    'AI_MODEL',
    'OLLAMA_URL',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
  ])

  return {
    provider: settings['AI_PROVIDER'] || 'ollama',
    model: settings['AI_MODEL'] || 'llama3.2',
    ollamaUrl: settings['OLLAMA_URL'] || 'http://localhost:5566',
    anthropicApiKey: settings['ANTHROPIC_API_KEY'] || '',
    geminiApiKey: settings['GEMINI_API_KEY'] || '',
  }
}

/**
 * Clear the settings cache (all, or a single tenant)
 */
export function clearCache(tenantId?: string): void {
  if (!tenantId) {
    Object.keys(CACHE).forEach(key => delete CACHE[key])
    return
  }
  const prefix = `${tenantId}:`
  Object.keys(CACHE).forEach(key => {
    if (key.startsWith(prefix)) delete CACHE[key]
  })
}
