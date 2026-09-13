export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import {
  generateDailyHoroscope,
  generateLoveHoroscope,
  generateCareerHoroscope,
  generateCompatibilityReading,
  chatWithAstrologer,
} from '@/lib/ai/astrology-prompts'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const _isDev = process.env.NODE_ENV === 'development'

/**
 * POST /api/astrology/generate
 * Generate AI-powered astrology readings
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { type, chartId, partnerChartId, message } = body

    // Get user's birth chart
    const chart = await prisma.birthChart.findFirst({
      where: chartId ? { id: chartId, userId: session.user.id } : { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (!chart) {
      return NextResponse.json(
        { error: 'No birth chart found. Please create your birth chart first.' },
        { status: 400 }
      )
    }

    const chartData = {
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

    let title = ''
    let content = ''

    switch (type) {
      case 'daily': {
        const result = await generateDailyHoroscope(chartData, session.user?.name || null)
        title = result.title
        content = result.content
        break
      }

      case 'love': {
        const result = await generateLoveHoroscope(chartData, session.user?.name || null)
        title = result.title
        content = result.content
        break
      }

      case 'career': {
        const result = await generateCareerHoroscope(chartData, session.user?.name || null)
        title = result.title
        content = result.content
        break
      }

      case 'compatibility': {
        if (!partnerChartId) {
          return NextResponse.json(
            { error: 'Partner chart ID required for compatibility reading' },
            { status: 400 }
          )
        }

        const partnerChart = await prisma.birthChart.findUnique({
          where: { id: partnerChartId },
        })

        if (!partnerChart) {
          return NextResponse.json({ error: 'Partner chart not found' }, { status: 404 })
        }

        const partnerChartData = {
          planets: partnerChart.planets as any[],
          houses: partnerChart.houses as any[],
          aspects: partnerChart.aspects as any[],
          ascendant: (partnerChart as any).ascendant as { sign: string; degree: number },
          midheaven: (partnerChart as any).midheaven as { sign: string; degree: number },
        }

        const result = await generateCompatibilityReading(
          chartData,
          partnerChartData,
          session.user.name || 'Person 1',
          'Partner'
        )
        title = result.title
        content = result.content
        break
      }

      case 'chat': {
        if (!message) {
          return NextResponse.json({ error: 'Message required for chat' }, { status: 400 })
        }

        // Get conversation history from latest chat session
        const chatSession = await prisma.chatSession.findFirst({
          where: { userId: session.user.id },
          orderBy: { lastActiveAt: 'desc' },
        })

        const messages = (chatSession?.messages as any[]) || []

        const response = await chatWithAstrologer(chartData, message, messages)

        return NextResponse.json({
          response,
          chartId: chart.id,
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid reading type' }, { status: 400 })
    }

    // Save the reading
    const reading = await prisma.reading.create({
      data: {
        tenantId: session.user.tenantId!,
        userId: session.user.id,
        type,
        title,
        content,
        input: { chartId, partnerChartId } as any,
        aiGenerated: true,
      },
    })

    return NextResponse.json({
      id: reading.id,
      title,
      content,
      createdAt: reading.createdAt,
    })
  } catch (error) {
    logger.debug({ error, userId: session.user.id }, 'Error generating reading')
    return NextResponse.json({ error: 'Failed to generate reading' }, { status: 500 })
  }
}
