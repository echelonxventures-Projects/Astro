/**
 * Per-tenant AI provider catalog management (admin)
 * GET  /api/settings/providers            -> list entries + kind catalog
 * POST /api/settings/providers            -> { action: create|update|delete|test|setDefault, ... }
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import {
  buildProviderFromEntry,
  isProviderKind,
  listCatalog,
  parseCatalogEntry,
  toCatalogData,
  PROVIDER_KINDS,
  isUsable,
  type CatalogInput,
} from '@/lib/ai/catalog'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getTenantContext } from '@/lib/tenant'

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

function validate(input: Partial<CatalogInput>): string | null {
  if (input.key !== undefined && !/^[a-z0-9][a-z0-9_-]{1,40}$/.test(input.key)) {
    return 'Key must be lowercase letters, digits, "-" or "_" (2-41 chars)'
  }
  if (input.kind !== undefined && !isProviderKind(input.kind)) {
    return `kind must be one of: openai-compatible, ollama, anthropic, gemini, opencode`
  }
  if (input.baseUrl && !/^https?:\/\//.test(input.baseUrl)) {
    return 'baseUrl must start with http:// or https://'
  }
  return null
}

export async function GET() {
  try {
    const tenantId = await checkAdmin()
    const providers = await listCatalog(tenantId)
    return NextResponse.json({
      providers: providers.map(p => ({ ...p, usable: isUsable(p) })),
      kinds: PROVIDER_KINDS,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Error listing provider catalog', error)
    return NextResponse.json({ error: 'Failed to list providers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let tenantId: string
  try {
    tenantId = await checkAdmin()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'create': {
        const input = body as CatalogInput
        const invalid = validate(input)
        if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
        if (!input.key || !input.label) {
          return NextResponse.json({ error: 'key and label are required' }, { status: 400 })
        }
        const exists = await prisma.aIProviderCatalog.findUnique({
          where: { tenantId_key: { tenantId, key: input.key } },
        })
        if (exists)
          return NextResponse.json({ error: 'Provider key already exists' }, { status: 409 })
        if (input.isDefault) {
          await prisma.aIProviderCatalog.updateMany({
            where: { tenantId },
            data: { isDefault: false },
          })
        }
        const created = await prisma.aIProviderCatalog.create({
          data: toCatalogData(tenantId, input),
        })
        return NextResponse.json({ provider: created })
      }

      case 'update': {
        if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        const invalid = validate(body)
        if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
        const existing = await prisma.aIProviderCatalog.findFirst({
          where: { id: body.id, tenantId },
        })
        if (!existing) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
        const nextKey = body.key ?? existing.key
        const data = toCatalogData(tenantId, {
          key: nextKey,
          label: body.label ?? existing.label,
          kind: body.kind ?? existing.kind,
          baseUrl: body.baseUrl !== undefined ? body.baseUrl : existing.baseUrl,
          apiKey: body.apiKey !== undefined ? body.apiKey : existing.apiKey,
          models: body.models,
          capabilities: body.capabilities,
          options: body.options,
          enabled: body.enabled,
          isDefault: body.isDefault,
          sortOrder: body.sortOrder,
        })
        // merge untouched JSON fields
        if (body.models === undefined) data.models = existing.models
        if (body.capabilities === undefined) data.capabilities = existing.capabilities
        if (body.options === undefined) data.options = existing.options
        if (body.enabled === undefined) data.enabled = existing.enabled
        if (body.isDefault === undefined) data.isDefault = existing.isDefault
        if (body.sortOrder === undefined) data.sortOrder = existing.sortOrder
        if (body.isDefault === true) {
          await prisma.aIProviderCatalog.updateMany({
            where: { tenantId },
            data: { isDefault: false },
          })
        }
        const updated = await prisma.aIProviderCatalog.update({ where: { id: existing.id }, data })
        return NextResponse.json({ provider: updated })
      }

      case 'delete': {
        if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        const result = await prisma.aIProviderCatalog.deleteMany({
          where: { id: body.id, tenantId },
        })
        if (result.count === 0)
          return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
        return NextResponse.json({ success: true })
      }

      case 'setDefault': {
        if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        const target = await prisma.aIProviderCatalog.findFirst({
          where: { id: body.id, tenantId },
        })
        if (!target) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
        await prisma.aIProviderCatalog.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        })
        await prisma.aIProviderCatalog.update({
          where: { id: target.id },
          data: { isDefault: true, enabled: true },
        })
        return NextResponse.json({ success: true })
      }

      case 'test': {
        if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        const row = await prisma.aIProviderCatalog.findFirst({ where: { id: body.id, tenantId } })
        if (!row) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
        const entry = parseCatalogEntry(row)
        const started = Date.now()
        try {
          if (entry.options.checkUrl) {
            await fetch(entry.options.checkUrl, {
              method: 'GET',
              signal: AbortSignal.timeout(4000),
            })
          }
          const provider = await buildProviderFromEntry(entry, { maxTokens: 16 })
          const reply = await provider.complete({
            messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
            system: 'You are a connectivity test. Answer in one word.',
            maxTokens: 16,
          })
          return NextResponse.json({
            ok: true,
            latencyMs: Date.now() - started,
            reply: String(reply).slice(0, 60),
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Connection failed'
          return NextResponse.json({ ok: false, error: message }, { status: 200 })
        }
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    logError('Provider catalog error', error)
    return NextResponse.json({ error: 'Provider catalog operation failed' }, { status: 500 })
  }
}
