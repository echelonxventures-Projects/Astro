/**
 * API for managing subscription plans, features, and regions
 * Admin-only access
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import {
  getActiveFeatures,
  getActiveRegions,
  createPlan,
  updatePlan,
  deletePlan,
  createFeature,
  updateFeature,
  deleteFeature,
  setFeatureAccess,
  createRegion,
  updateRegion,
  deleteRegion,
} from '@/lib/plans'

async function checkAdmin() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    throw new Error('Admin access required')
  }

  return session
}

export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin()
    const tenantId = session.user!.tenantId!

    const url = new URL(req.url)
    const type = url.searchParams.get('type')

    if (type === 'features') {
      const features = await getActiveFeatures(tenantId)
      return NextResponse.json({ features })
    }

    if (type === 'regions') {
      const regions = await getActiveRegions(tenantId)
      return NextResponse.json({ regions })
    }

    // For default plans request, include featureAccess
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
    return NextResponse.json({ plans })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    logError('Error fetching data', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin()
    const tenantId = session.user!.tenantId!

    const body = await req.json()
    const { action, ...data } = body

    switch (action) {
      case 'createPlan': {
        const plan = await createPlan({ ...data, tenantId })
        return NextResponse.json(plan)
      }

      case 'updatePlan': {
        const plan = await updatePlan(data.id, data)
        return NextResponse.json(plan)
      }

      case 'deletePlan': {
        await deletePlan(data.id)
        return NextResponse.json({ success: true })
      }

      case 'createFeature': {
        const feature = await createFeature({ ...data, tenantId })
        return NextResponse.json(feature)
      }

      case 'updateFeature': {
        const feature = await updateFeature(data.id, data)
        return NextResponse.json(feature)
      }

      case 'deleteFeature': {
        await deleteFeature(data.id)
        return NextResponse.json({ success: true })
      }

      case 'setFeatureAccess': {
        await setFeatureAccess(data.planId, data.featureId, data.enabled, data.value)
        return NextResponse.json({ success: true })
      }

      case 'createRegion': {
        const region = await createRegion({ ...data, tenantId })
        return NextResponse.json(region)
      }

      case 'updateRegion': {
        const region = await updateRegion(data.id, data)
        return NextResponse.json(region)
      }

      case 'deleteRegion': {
        await deleteRegion(data.id)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    logError('Error', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    )
  }
}
