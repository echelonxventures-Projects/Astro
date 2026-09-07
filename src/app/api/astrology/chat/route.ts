export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { chatWithAstrologer } from '@/lib/ai/astrology-prompts'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const _isDev = process.env.NODE_ENV === 'development'

/**
 * POST /api/astrology/chat
 * Chat with the AI astrologer - conversational flow
 */
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await _req.json()
    const { message, sessionId } = body

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    let chatSession = null

    if (sessionId) {
      // Continue existing session
      chatSession = await prisma.chatSession.findUnique({
        where: { id: sessionId, userId: session.user.id },
      })
    } else {
      // Create new session
      chatSession = await prisma.chatSession.create({
        data: {
          userId: session.user.id,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          messages: [],
          metadata: JSON.stringify({ step: 'greeting' }),
        },
      })
    }

    if (!chatSession) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    // Get conversation history
    const messages = (chatSession.messages as any[]) || []
    const metadata = (chatSession.metadata as any) || {}

    // Extract user data from conversation or session metadata
    const userData = extractUserDataFromMessages(messages, metadata)

    // Get user's birth chart if available
    const chart = await prisma.birthChart.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    const chartData = chart
      ? {
          planets: chart.planets as any[],
          houses: chart.houses as any[],
          aspects: chart.aspects as any[],
          ascendant: (chart as any).ascendant || {
            sign: (chart.houses as any[])?.[0]?.sign || 'Unknown',
            degree: 0,
          },
          midheaven: (chart as any).midheaven || {
            sign: (chart.houses as any[])?.[9]?.sign || 'Unknown',
            degree: 0,
          },
        }
      : null

    // Generate AI response - works with or without birth chart
    let response: string
    try {
      response = await chatWithAstrologer(chartData, message, messages, userData)
    } catch (aiError: any) {
      // Handle AI provider unavailable gracefully
      if (aiError?.cause?.code === 'ECONNREFUSED' || aiError?.message?.includes('fetch failed')) {
        return NextResponse.json(
          {
            error:
              'AI service is currently unavailable. Please ensure an AI provider is configured in Settings, or try again later.',
            requiresSetup: true,
          },
          { status: 503 }
        )
      }
      throw aiError
    }

    // Update chat session with new messages
    const updatedMessages = [
      ...messages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response, timestamp: new Date().toISOString() },
    ]

    // Update metadata with collected user data
    const updatedMetadata = {
      ...metadata,
      ...userData,
      step:
        userData?.birthDate && userData?.birthTime && userData?.birthPlace
          ? 'reading-complete'
          : 'collecting-info',
    }

    await prisma.chatSession.update({
      where: { id: chatSession.id },
      data: {
        messages: updatedMessages as any,
        metadata: updatedMetadata as any,
        lastActiveAt: new Date(),
        title:
          chatSession.title ||
          (userData?.name ? `${userData.name}'s Reading` : message.slice(0, 50)),
      },
    })

    return NextResponse.json({
      response,
      sessionId: chatSession.id,
    })
  } catch (error) {
    logger.debug({ error, userId: session.user.id }, 'Error processing chat')
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 })
  }
}

/**
 * Extract user data (name, birth details) from conversation messages
 */
function extractUserDataFromMessages(messages: any[], metadata: any) {
  const userData: { name?: string; birthDate?: string; birthTime?: string; birthPlace?: string } =
    {}

  // First check metadata for already collected data
  if (metadata?.name) userData.name = metadata.name
  if (metadata?.birthDate) userData.birthDate = metadata.birthDate
  if (metadata?.birthTime) userData.birthTime = metadata.birthTime
  if (metadata?.birthPlace) userData.birthPlace = metadata.birthPlace

  // Parse messages for user data if not in metadata
  messages.forEach(msg => {
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase()

      // Look for name patterns
      if (!userData.name) {
        const nameMatch = content.match(/^(?:my name is|i am|im called|call me)\s+([a-zA-Z]+)/i)
        if (nameMatch) {
          userData.name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1)
        }
      }

      // Look for birth date patterns
      if (!userData.birthDate) {
        const dateMatch = content.match(
          /(?:born|birth|birthday)[\s\S]*?(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4}|\d{1,2}\s+\w+\s+\d{4})/i
        )
        if (dateMatch) {
          userData.birthDate = dateMatch[1]
        }
      }

      // Look for birth time patterns
      if (!userData.birthTime) {
        const timeMatch = content.match(
          /(?:born|birth time|time)[\s\S]*?(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))/i
        )
        if (timeMatch) {
          userData.birthTime = timeMatch[1]
        }
      }

      // Look for birth place patterns
      if (!userData.birthPlace) {
        const placeMatch = content.match(
          /(?:born|birth place|from|city)[\s\S]*?([a-zA-Z\s]+(?:, [a-zA-Z\s]+)?)/i
        )
        if (placeMatch && placeMatch[1].length > 2 && placeMatch[1].length < 50) {
          userData.birthPlace = placeMatch[1].trim()
        }
      }
    }
  })

  return Object.keys(userData).length > 0 ? userData : undefined
}

/**
 * GET /api/astrology/chat
 * Get user's chat sessions
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const chats = await prisma.chatSession.findMany({
      where: { userId: session.user.id },
      orderBy: { lastActiveAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ chats })
  } catch (error) {
    logger.debug({ error, userId: session.user.id }, 'Error fetching chats')
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
  }
}
