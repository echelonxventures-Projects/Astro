export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { listCatalog } from '@/lib/ai/catalog'
import { getAllAIPlanConfigs, updateAIPlanConfig } from '@/lib/ai/plan-config'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'

/**
 * GET /api/settings/plans
 * Get all AI plan configurations
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if user is admin
    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configs = await getAllAIPlanConfigs(session.user.tenantId!)
    return NextResponse.json(configs)
  } catch (error) {
    logError('Error fetching plan configs', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to fetch plan configurations' }, { status: 500 })
  }
}

/**
 * POST /api/settings/plans
 * Save AI plan configurations
 */
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if user is admin
    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await _req.json()
    const plans = body as Array<{
      plan: 'free' | 'monthly' | 'yearly'
      provider: string
      model: string
      apiKey?: string | null
      ollamaUrl?: string | null
      maxTokens: number
      enabled: boolean
    }>

    const catalog = await listCatalog(session.user.tenantId!)
    const knownKeys = new Set(catalog.map(c => c.key))
    for (const plan of plans) {
      if (plan.provider && !knownKeys.has(plan.provider)) {
        return NextResponse.json(
          {
            error: `Unknown AI provider "${plan.provider}". Add it in Settings - Providers first.`,
          },
          { status: 400 }
        )
      }
    }
    // Save each plan configuration
    for (const plan of plans) {
      await updateAIPlanConfig(session.user.tenantId!, plan.plan, {
        provider: plan.provider,
        model: plan.model,
        apiKey: plan.apiKey,
        ollamaUrl: plan.ollamaUrl,
        maxTokens: plan.maxTokens,
        enabled: plan.enabled,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('Error saving plan configs', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to save plan configurations' }, { status: 500 })
  }
}
