export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { generateBirthChart } from '@/lib/astrology/calculations'
import { auth } from '@/lib/auth'
import {
  get as cacheGet,
  set as cacheSet,
  del as cacheDel,
  cacheFirst,
  DEFAULT_TTLS,
} from '@/lib/cache'
import { cacheKeys } from '@/lib/cache-keys'
import { generateInputHash } from '@/lib/cache-keys'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * POST /api/astrology/chart
 * Generate and save a birth chart
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      birthDate,
      birthTime,
      birthPlace,
      latitude,
      longitude,
      timezone,
      name = 'My Birth Chart',
    } = body

    // Validate required fields
    if (!birthDate || !birthTime || !latitude || !longitude) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // The creation form submits DD-MM-YYYY; tolerate ISO and JS-parsable variants.
    const parseBirthDate = (value: string): Date => {
      const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim())
      if (dmy) {
        const [, d, mo, y] = dmy
        return new Date(Number(y), Number(mo) - 1, Number(d))
      }
      return new Date(value)
    }
    const parsedBirthDate = parseBirthDate(String(birthDate))
    if (Number.isNaN(parsedBirthDate.getTime())) {
      return NextResponse.json({ error: 'Invalid birth date' }, { status: 400 })
    }

    // Create a hash for cache lookup
    const calculationKey = generateInputHash({
      birthDate,
      birthTime,
      birthPlace,
      latitude,
      longitude,
      timezone,
    })
    const cacheKey = cacheKeys.chartCalculation(calculationKey)

    // Try to get cached calculation
    const cachedCalculation = await cacheGet<ReturnType<typeof generateBirthChart>>(cacheKey)

    let chartData: ReturnType<typeof generateBirthChart>

    if (cachedCalculation) {
      logger.debug({ userId: session.user.id, cacheKey }, 'Using cached chart calculation')
      chartData = cachedCalculation
    } else {
      // Generate birth chart
      chartData = generateBirthChart(
        parsedBirthDate,
        birthTime,
        birthPlace || 'Unknown',
        latitude,
        longitude,
        timezone || 'UTC'
      )

      // Cache the calculation for 1 hour
      await cacheSet(cacheKey, chartData, DEFAULT_TTLS.CHART_CALCULATION)
      logger.debug({ userId: session.user.id, cacheKey }, 'Cached chart calculation')
    }

    // Save to database
    const chart = await prisma.birthChart.create({
      data: {
        tenantId: session.user.tenantId!,
        userId: session.user.id,
        name,
        birthDate: parsedBirthDate,
        birthTime,
        birthPlace: birthPlace || 'Unknown',
        latitude,
        longitude,
        timezone: timezone || 'UTC',
        planets: chartData.planets as object,
        houses: chartData.houses as object,
        aspects: chartData.aspects as object,
      },
    })

    // Invalidate user's chart list cache
    await cacheDel(cacheKeys.userCharts(session.user.id))

    return NextResponse.json({
      id: chart.id,
      ...chartData,
    })
  } catch (error) {
    logger.debug({ error, userId: session.user.id }, 'Error generating birth chart')
    return NextResponse.json({ error: 'Failed to generate birth chart' }, { status: 500 })
  }
}

/**
 * GET /api/astrology/chart
 * Get user's saved birth charts
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cacheKey = cacheKeys.userCharts(session.user.id)

    // Try cache first using cacheFirst strategy
    const charts = await cacheFirst(
      cacheKey,
      async () => {
        logger.debug({ userId: session.user.id }, 'Fetching charts from database')
        return await prisma.birthChart.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: 'desc' },
        })
      },
      DEFAULT_TTLS.CHART_CALCULATION // 1 hour
    )

    return NextResponse.json({ charts })
  } catch (error) {
    logger.debug({ error, userId: session.user.id }, 'Error fetching charts')
    return NextResponse.json({ error: 'Failed to fetch charts' }, { status: 500 })
  }
}
