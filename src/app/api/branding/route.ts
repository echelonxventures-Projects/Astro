/**
 * Tenant branding API
 * GET  /api/branding - current tenant's effective + stored branding
 * PUT  /api/branding - tenant admin updates branding (colors, logo, name, SEO)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { mergeBranding, type BrandConfigInput } from '@/lib/branding'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getTenantContext, invalidateTenantHostCache } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function checkTenantAdmin(ctxTenantId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  if (!session.user.tenantId || session.user.tenantId !== ctxTenantId) {
    throw new Error('Unauthorized')
  }
  if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
    throw new Error('Admin access required')
  }
  return session
}

export async function GET() {
  try {
    const ctx = await getTenantContext()
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { id: true, slug: true, name: true, branding: true },
    })
    return NextResponse.json({
      stored: tenant?.branding ?? null,
      effective: ctx.branding,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logError('Error fetching branding', error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getTenantContext()
    await checkTenantAdmin(ctx.tenantId)

    const body = await req.json()
    const input = (body ?? {}) as BrandConfigInput

    // Validate basic shape before storing
    if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim())) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    if (input.colors) {
      const hex = /^#[0-9a-fA-F]{6}$/
      for (const [k, v] of Object.entries(input.colors)) {
        if (typeof v !== 'string' || !hex.test(v)) {
          return NextResponse.json(
            { error: `Invalid color for ${k} (expected #RRGGBB)` },
            { status: 400 }
          )
        }
      }
    }
    for (const urlKey of ['logoUrl', 'faviconUrl'] as const) {
      const val = input[urlKey]
      if (
        val !== undefined &&
        val !== null &&
        typeof val === 'string' &&
        !/^(https?:\/\/|\/)/.test(val)
      ) {
        return NextResponse.json(
          { error: `${urlKey} must be an http(s) URL or absolute path` },
          { status: 400 }
        )
      }
    }

    const stored = mergeBranding(input)

    await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: { branding: stored as never },
    })

    invalidateTenantHostCache()

    return NextResponse.json({ stored })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Error updating branding', error)
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 })
  }
}
