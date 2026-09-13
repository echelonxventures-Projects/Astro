/**
 * Global AI default settings for the current tenant (admin).
 * Backed by the tenant AI provider catalog (no hardcoded provider list).
 * GET  -> { providers, defaultKey, defaultModel }
 * POST -> { providerKey, model } sets tenant default provider (+ model override)
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { listCatalog } from '@/lib/ai/catalog'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getSetting, setSetting } from '@/lib/settings'
import { getTenantContext, TenantNotFoundError } from '@/lib/tenant'

async function checkAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
    throw new Error('Admin access required')
  }
  const ctx = await getTenantContext()
  if (session.user.tenantId !== ctx.tenantId) throw new Error('Unauthorized')
  return ctx.tenantId
}

export async function GET(_req: NextRequest) {
  try {
    const tenantId = await checkAdmin()
    const providers = await listCatalog(tenantId, true)
    const def = providers.find(p => p.isDefault) ?? providers[0] ?? null
    const defaultModel = (await getSetting(tenantId, 'AI_DEFAULT_MODEL')) || def?.models[0] || ''
    return NextResponse.json({
      providers,
      defaultKey: def?.key ?? '',
      defaultModel,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (error instanceof TenantNotFoundError)
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Settings fetch error', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest) {
  try {
    const tenantId = await checkAdmin()
    const body = await _req.json()
    const { providerKey, model } = body as { providerKey?: string; model?: string }

    if (!providerKey) {
      return NextResponse.json({ error: 'providerKey is required' }, { status: 400 })
    }
    const providers = await listCatalog(tenantId, true)
    const target = providers.find(p => p.key === providerKey)
    if (!target) {
      return NextResponse.json(
        { error: `Unknown provider "${providerKey}". Add it in Providers first.` },
        { status: 400 }
      )
    }

    await prisma.aIProviderCatalog.updateMany({ where: { tenantId }, data: { isDefault: false } })
    await prisma.aIProviderCatalog.update({ where: { id: target.id }, data: { isDefault: true } })

    if (model) {
      if (!target.models.includes(model) && !/^[a-z0-9._:/-]+$/i.test(model)) {
        return NextResponse.json({ error: 'Invalid model name' }, { status: 400 })
      }
      await setSetting(tenantId, 'AI_DEFAULT_MODEL', model)
    } else {
      await prisma.appSettings.deleteMany({ where: { tenantId, key: 'AI_DEFAULT_MODEL' } })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (error instanceof TenantNotFoundError)
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Settings save error', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
