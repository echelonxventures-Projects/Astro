/**
 * User Memory System
 * Persistent memory for AI conversations and preferences
 */

import { prisma } from '@/lib/db'

export type MemoryCategory =
  | 'preference'        // General preferences
  | 'preference_astro'  // Astrology-related preferences
  | 'preference_chat'   // Chat behavior preferences
  | 'fact'              // Facts about the user
  | 'insight'           // AI-derived insights
  | 'temporary'         // Temporary context

export interface MemoryInput {
  userId: string
  category: MemoryCategory
  key: string
  value: string
  source?: string
  confidence?: number
  importance?: number
  expiresAt?: Date
}

export interface UserMemoryData {
  id: string
  category: string
  key: string
  value: string
  source: string | null
  confidence: number
  importance: number
  lastUsedAt: Date
  useCount: number
  createdAt: Date
}

/**
 * Store a memory for a user
 */
export async function storeMemory(input: MemoryInput): Promise<void> {
  await prisma.userMemory.upsert({
    where: {
      userId_key: {
        userId: input.userId,
        key: input.key,
      },
    },
    create: {
      userId: input.userId,
      category: input.category,
      key: input.key,
      value: input.value,
      source: input.source || 'user',
      confidence: input.confidence || 1.0,
      importance: input.importance || 1,
      expiresAt: input.expiresAt,
    },
    update: {
      value: input.value,
      confidence: input.confidence || 1.0,
      importance: input.importance || 1,
      updatedAt: new Date(),
    },
  })
}

/**
 * Get a specific memory
 */
export async function getMemory(userId: string, key: string): Promise<UserMemoryData | null> {
  const memory = await prisma.userMemory.findUnique({
    where: { userId_key: { userId, key } },
  })

  if (!memory) return null

  // Update usage stats
  await prisma.userMemory.update({
    where: { id: memory.id },
    data: {
      lastUsedAt: new Date(),
      useCount: memory.useCount + 1,
    },
  })

  return memory
}

/**
 * Get all memories for a user (for AI context)
 */
export async function getUserMemories(userId: string, categories?: MemoryCategory[]): Promise<UserMemoryData[]> {
  const memories = await prisma.userMemory.findMany({
    where: {
      userId,
      category: categories ? { in: categories } : undefined,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [
      { importance: 'desc' },
      { lastUsedAt: 'desc' },
    ],
    take: 50, // Limit to prevent context overflow
  })

  return memories
}

/**
 * Get memories formatted for AI context
 */
export async function getMemoryContext(userId: string): Promise<string> {
  const memories = await getUserMemories(userId)

  if (memories.length === 0) return ''

  const contextParts = memories.map(m => {
    const categoryLabel = m.category.replace('_', ' ')
    return `[${categoryLabel}] ${m.key}: ${m.value}`
  })

  return `User Context (from memory):\n${contextParts.join('\n')}`
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(userId: string, key: string): Promise<void> {
  await prisma.userMemory.delete({
    where: { userId_key: { userId, key } },
  })
}

/**
 * Clear all memories for a user
 */
export async function clearUserMemories(userId: string, category?: MemoryCategory): Promise<number> {
  const result = await prisma.userMemory.deleteMany({
    where: {
      userId,
      category,
    },
  })

  return result.count
}

/**
 * Extract and store preferences from chat conversation
 */
export async function extractPreferencesFromChat(
  userId: string,
  messages: { role: string; content: string }[]
): Promise<void> {
  // This can be enhanced with AI-based extraction
  // For now, we'll store some common patterns

  for (const msg of messages) {
    const content = msg.content.toLowerCase()

    // Zodiac sign preferences
    const zodiacMatch = content.match(/i'm (?:a|an) (\w+)/i)
    if (zodiacMatch) {
      const sign = zodiacMatch[1]
      if (['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'].includes(sign)) {
        await storeMemory({
          userId,
          category: 'fact',
          key: 'zodiac_sign',
          value: sign.charAt(0).toUpperCase() + sign.slice(1),
          source: 'chat',
          confidence: 0.9,
          importance: 8,
        })
      }
    }

    // Birth date mentions
    const dateMatch = content.match(/born (?:on|in) (\w+ \d{1,2},? \d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i)
    if (dateMatch) {
      await storeMemory({
        userId,
        category: 'fact',
        key: 'birth_date_mentioned',
        value: dateMatch[1],
        source: 'chat',
        confidence: 0.7,
        importance: 7,
      })
    }

    // Reading preferences
    if (content.includes('detailed') || content.includes('thorough')) {
      await storeMemory({
        userId,
        category: 'preference_chat',
        key: 'reading_style',
        value: 'detailed',
        source: 'chat',
        confidence: 0.8,
        importance: 5,
      })
    }

    if (content.includes('brief') || content.includes('short') || content.includes('quick')) {
      await storeMemory({
        userId,
        category: 'preference_chat',
        key: 'reading_style',
        value: 'brief',
        source: 'chat',
        confidence: 0.8,
        importance: 5,
      })
    }
  }
}

/**
 * Create default memories for new users
 */
export async function initializeUserMemory(userId: string): Promise<void> {
  const defaultMemories = [
    {
      category: 'preference_chat' as MemoryCategory,
      key: 'greeting_style',
      value: 'friendly',
      importance: 3,
    },
    {
      category: 'preference_astro' as MemoryCategory,
      key: 'reading_frequency',
      value: 'daily',
      importance: 4,
    },
    {
      category: 'preference' as MemoryCategory,
      key: 'timezone',
      value: 'auto',
      importance: 5,
    },
  ]

  for (const mem of defaultMemories) {
    await storeMemory({
      userId,
      category: mem.category,
      key: mem.key,
      value: mem.value,
      source: 'system',
      confidence: 1.0,
      importance: mem.importance,
    })
  }
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(userId: string): Promise<{
  total: number
  byCategory: Record<string, number>
  mostUsed: UserMemoryData | null
}> {
  const memories = await prisma.userMemory.findMany({
    where: { userId },
  })

  const byCategory: Record<string, number> = {}
  for (const m of memories) {
    byCategory[m.category] = (byCategory[m.category] || 0) + 1
  }

  const mostUsed = memories.reduce((max, m) =>
    m.useCount > (max?.useCount || 0) ? m : max, null as UserMemoryData | null)

  return {
    total: memories.length,
    byCategory,
    mostUsed,
  }
}