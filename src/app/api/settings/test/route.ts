/**
 * POST /api/settings/test
 * Test an AI provider by catalog key (or the tenant default). No hardcoded providers.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { buildProviderFromEntry, getDefaultEntry, getEntry } from '@/lib/ai/catalog'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'
import { getTenantContext, TenantNotFoundError } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    const ctx = await getTenantContext()
    if (session.user.tenantId !== ctx.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const providerKey = typeof body.providerKey === 'string' ? body.providerKey : null

    const entry = providerKey
      ? await getEntry(ctx.tenantId, providerKey)
      : await getDefaultEntry(ctx.tenantId)

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Provider not found in catalog' },
        { status: 404 }
      )
    }

    const provider = await buildProviderFromEntry(entry, {
      model: typeof body.model === 'string' ? body.model : undefined,
      maxTokens: 16,
    })
    const testResponse = await provider.complete({
      messages: [{ role: 'user', content: 'Reply with just "OK" to confirm you are working.' }],
      maxTokens: 16,
    })

    if (testResponse && testResponse.trim().length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        provider: entry.label,
      })
    }
    return NextResponse.json(
      { success: false, error: 'Empty response from provider' },
      { status: 500 }
    )
  } catch (error: unknown) {
    if (error instanceof TenantNotFoundError) {
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })
    }
    logError('Connection test failed', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
