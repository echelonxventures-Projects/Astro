/**
 * Super-admin API for tenant management
 */

import { NextRequest, NextResponse } from 'next/server'
import { ensureDefaultCatalog } from '@/lib/ai/catalog'
import { auth } from '@/lib/auth'
import { mergeBranding } from '@/lib/branding'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { invalidateTenantHostCache } from '@/lib/tenant'

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

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

export async function GET(_req: NextRequest) {
  try {
    await checkSuperAdmin()

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        domains: { orderBy: [{ isPrimary: 'desc' }, { host: 'asc' }] },
        _count: { select: { users: true } },
      },
    })
    return NextResponse.json({ tenants })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Superadmin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Error fetching tenants', error)
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await checkSuperAdmin()

    const body = await req.json()
    const { name, slug, branding, domains } = body as {
      name?: string
      slug?: string
      branding?: Record<string, unknown> | null
      domains?: string[]
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 })
    }
    if (!slug || !SLUG_RE.test(slug)) {
      return NextResponse.json(
        {
          error:
            'Slug must be 3-40 chars: lowercase letters, digits, hyphens (no leading/trailing hyphen)',
        },
        { status: 400 }
      )
    }

    const existing = await prisma.tenant.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: 'A tenant with this slug already exists' }, { status: 409 })
    }

    const hosts = new Set<string>()
    for (const h of [slug + '.localhost', ...(Array.isArray(domains) ? domains : [])]) {
      const host = String(h).trim().toLowerCase().replace(/:\d+$/, '')
      if (host) hosts.add(host)
    }

    const taken = await prisma.tenantDomain.findMany({
      where: { host: { in: Array.from(hosts) } },
      select: { host: true },
    })
    if (taken.length > 0) {
      return NextResponse.json(
        { error: `Domains already in use: ${taken.map(t => t.host).join(', ')}` },
        { status: 409 }
      )
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        slug,
        branding: branding ? (mergeBranding(branding as never) as never) : undefined,
        domains: {
          create: Array.from(hosts)
            .filter(Boolean)
            .map((host, i) => ({
              host,
              isPrimary: i === 0,
            })),
        },
      },
      include: { domains: true },
    })

    await ensureDefaultCatalog(tenant.id, tenant.name)
    invalidateTenantHostCache()
    return NextResponse.json({ tenant })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Superadmin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Error creating tenant', error)
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 })
  }
}
