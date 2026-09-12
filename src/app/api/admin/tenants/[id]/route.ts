/**
 * Super-admin API: update / suspend / delete a tenant
 */

import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { mergeBranding, type BrandConfigInput } from '@/lib/branding'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { invalidateTenantHostCache, DEFAULT_TENANT_ID, type TenantSettings } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function checkSuperAdmin() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  if (session.user.role !== 'superadmin') {
    throw new Error('Superadmin access required')
  }
  return session
}

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await checkSuperAdmin()
    const { id } = await params
    const body = await req.json()
    const { name, status, domains, branding, settings } = body as {
      name?: string
      status?: string
      domains?: string[]
      branding?: BrandConfigInput | null
      settings?: TenantSettings | null
    }

    if (id === DEFAULT_TENANT_ID && status && status !== 'active') {
      return NextResponse.json({ error: 'The default tenant cannot be suspended' }, { status: 400 })
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(status ? { status } : {}),
        ...(branding !== undefined
          ? { branding: branding === null ? Prisma.DbNull : (mergeBranding(branding) as never) }
          : {}),
        ...(settings !== undefined ? { settings: (settings ?? {}) as never } : {}),
      },
    })

    if (Array.isArray(domains)) {
      const wanted = domains
        .map(d => String(d).trim().toLowerCase().replace(/:\d+$/, ''))
        .filter(Boolean)
      const existing = await prisma.tenantDomain.findMany({ where: { tenantId: id } })
      const existingHosts = new Set(existing.map(e => e.host))
      for (const host of wanted) {
        if (!existingHosts.has(host)) {
          const taken = await prisma.tenantDomain.findUnique({ where: { host } })
          if (!taken) {
            await prisma.tenantDomain.create({ data: { host, tenantId: id } })
          }
        }
      }
      const toRemove = existing.filter(e => !wanted.includes(e.host) && !e.isPrimary)
      if (toRemove.length > 0) {
        await prisma.tenantDomain.deleteMany({ where: { id: { in: toRemove.map(t => t.id) } } })
      }
    }

    invalidateTenantHostCache()
    return NextResponse.json({ tenant })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Superadmin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Error updating tenant', error)
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await checkSuperAdmin()
    const { id } = await params

    if (id === DEFAULT_TENANT_ID) {
      return NextResponse.json({ error: 'The default tenant cannot be deleted' }, { status: 400 })
    }

    const userCount = await prisma.user.count({ where: { tenantId: id } })
    if (userCount > 0) {
      return NextResponse.json(
        {
          error: `Tenant still has ${userCount} users. Suspend it instead, or export/delete its users first.`,
        },
        { status: 409 }
      )
    }

    await prisma.tenant.delete({ where: { id } })
    invalidateTenantHostCache()
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Superadmin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Error deleting tenant', error)
    return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 })
  }
}
