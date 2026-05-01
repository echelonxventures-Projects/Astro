/**
 * Application Settings Management
 * Get/set app settings from database with in-memory caching
 */

import { prisma } from './db'

interface SettingsCache {
  [key: string]: {
    value: string
    timestamp: number
  }
}

const CACHE: SettingsCache = {}
const CACHE_TTL = 5000 // 5 seconds cache TTL

/**
 * Get a single setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
  // Check cache first
  const cached = CACHE[key]
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value
  }

  // Fetch from database
  const setting = await prisma.appSettings.findUnique({
    where: { key },
  })

  if (!setting) {
    return null
  }

  // Update cache
  CACHE[key] = {
    value: setting.value,
    timestamp: Date.now(),
  }

  return setting.value
}

/**
 * Get multiple settings by keys
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  // Check cache first
  const missingKeys: string[] = []
  for (const key of keys) {
    const cached = CACHE[key]
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[key] = cached.value
    } else {
      missingKeys.push(key)
    }
  }

  // Fetch missing from database
  if (missingKeys.length > 0) {
    const settings = await prisma.appSettings.findMany({
      where: { key: { in: missingKeys } },
    })

    for (const setting of settings) {
      result[setting.key] = setting.value
      CACHE[setting.key] = {
        value: setting.value,
        timestamp: Date.now(),
      }
    }
  }

  return result
}

/**
 * Set a setting value
 */
export async function setSetting(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key },
    update: { value },
    create: { key, value, description },
  })

  // Update cache
  CACHE[key] = {
    value,
    timestamp: Date.now(),
  }
}

/**
 * Get AI provider configuration
 */
export async function getAIProviderConfig(): Promise<{
  provider: string
  model: string
  ollamaUrl: string
  anthropicApiKey: string
  geminiApiKey: string
}> {
  const settings = await getSettings([
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
 * Clear the settings cache
 */
export function clearCache(): void {
  Object.keys(CACHE).forEach(key => delete CACHE[key])
}
