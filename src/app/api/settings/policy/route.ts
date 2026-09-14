/**
 * Per-tenant AI routing policy (free-first / paid-only-for-paying-customer gating).
 * GET  -> { policy } (effective)
 * PUT  -> { policy } partial merge, admin only
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { resolveAiPolicy, DEFAULT_AI_POLICY, type AiPolicy } from '@/lib/ai/catalog'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getTenantContext, type TenantSettings } from '@/lib/tenant'

async function checkAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (session.user.role !== 'admin' && session.user.role !== 'superadmin')
    throw new Error('Admin access required')
  const ctx = await getTenantContext()
  if (session.user.tenantId !== ctx.tenantId) throw new Error('Unauthorized')
  return ctx.tenantId
}

export async function GET() {
  try {
    const tenantId = await checkAdmin()
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })
    const policy = resolveAiPolicy(((tenant?.settings ?? {}) as TenantSettings).aiPolicy)
    return NextResponse.json({ policy, defaults: DEFAULT_AI_POLICY })
  } catch (error: unknown) {
    return handle(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenantId = await checkAdmin()
    const body = await req.json()
    const incoming = (body?.policy ?? body ?? {}) as Partial<AiPolicy>
    const validStatuses = ['free', 'premium', 'trial', 'cancelled']
    if (
      incoming.paidStatusValues &&
      !incoming.paidStatusValues.every(s => typeof s === 'string' && /^[a-z_]{2,24}$/.test(s))
    ) {
      return NextResponse.json(
        { error: 'paidStatusValues must be simple status names' },
        { status: 400 }
      )
    }
    void validStatuses
    if (
      incoming.paidPlanTiers &&
      !incoming.paidPlanTiers.every(t => typeof t === 'string' && /^[a-z_]{2,24}$/.test(t))
    ) {
      return NextResponse.json(
        { error: 'paidPlanTiers must be simple tier names' },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })
    const settings = (tenant?.settings ?? {}) as TenantSettings
    const current = resolveAiPolicy(settings.aiPolicy)
    settings.aiPolicy = {
      ...current,
      ...(typeof incoming.preferFreeFirst === 'boolean'
        ? { preferFreeFirst: incoming.preferFreeFirst }
        : {}),
      ...(typeof incoming.gatePaidProviders === 'boolean'
        ? { gatePaidProviders: incoming.gatePaidProviders }
        : {}),
      ...(Array.isArray(incoming.paidStatusValues)
        ? { paidStatusValues: incoming.paidStatusValues }
        : {}),
      ...(Array.isArray(incoming.paidPlanTiers) ? { paidPlanTiers: incoming.paidPlanTiers } : {}),
    }
    await prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as never } })
    return NextResponse.json({ policy: settings.aiPolicy })
  } catch (error: unknown) {
    return handle(error)
  }
}

function handle(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
  if (message === 'Admin access required')
    return NextResponse.json({ error: message }, { status: 403 })
  logError('AI policy route error', error)
  return NextResponse.json({ error: 'AI policy operation failed' }, { status: 500 })
}
