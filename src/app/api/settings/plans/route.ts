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
    // Routing policy gate: paid-cost providers may not bind to unpaid plans
    const { resolveAiPolicy } = await import('@/lib/ai/catalog')
    const { prisma } = await import('@/lib/db')
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId! },
      select: { settings: true },
    })
    const policy = resolveAiPolicy((tenant?.settings as { aiPolicy?: never } | null)?.aiPolicy)
    if (policy.gatePaidProviders) {
      for (const plan of plans) {
        if (!plan.provider) continue
        const entry = catalog.find(c => c.key === plan.provider)
        if (entry?.cost !== 'paid') continue
        const planRow = await prisma.subscriptionPlan.findUnique({
          where: { tenantId_key: { tenantId: session.user.tenantId!, key: plan.plan } },
          select: { tier: true },
        })
        if (planRow && policy.paidPlanTiers.includes(planRow.tier)) continue
        return NextResponse.json(
          {
            error: `Provider "${entry.label}" is marked PAID and cannot be bound to the "${plan.plan}" plan (unpaid tier). Your routing policy reserves paid providers for paying customers - change the provider's cost class or the policy if you intend this.`,
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
