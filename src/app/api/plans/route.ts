/**
 * Public plans API (per tenant, read-only)
 * GET /api/plans              -> active plans (with feature access)
 * GET /api/plans?type=features -> active feature definitions
 * GET /api/plans?type=regions  -> active regions (global reference data)
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/logger'
import { getScopedDb, getTenantContext, TenantNotFoundError } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getTenantContext()
    const db = getScopedDb(ctx.tenantId)
    const type = new URL(req.url).searchParams.get('type')

    if (type === 'features') {
      const features = await db.planFeature.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json({ features })
    }

    if (type === 'regions') {
      const regions = await db.region.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json({ regions })
    }

    const plans = await db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        featureAccess: {
          include: { feature: true },
        },
      },
    })

    const parse = <T>(value: string | null, fallback: T): T => {
      if (!value) return fallback
      try {
        return JSON.parse(value) as T
      } catch {
        return fallback
      }
    }

    return NextResponse.json({
      plans: plans.map(p => ({
        ...p,
        features: parse<string[]>(p.features, []),
        aiConfig: p.aiConfig ? parse(p.aiConfig, null) : null,
        regionalPricing: p.regionalPricing ? parse(p.regionalPricing, {}) : null,
      })),
    })
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })
    }
    logError('Error fetching public plans', error)
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}
