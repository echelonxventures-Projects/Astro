/**
 * Platform management API - hierarchy aware.
 *
 * - superadmin: sees/creates at any level (children attach to any parent)
 * - a granted platform admin (effective master canCreateChildren): sees &
 *   creates their own subtree; children are clamped to the creator's grants
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { clampGrants, descendantIds, effectiveMaster, type MasterConfig } from '@/lib/master-config'
import { provisionTenant } from '@/lib/tenant-provision'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

interface Actor {
  userId: string
  email: string
  isSuper: boolean
  tenantId: string | null
}

async function getActor(): Promise<Actor> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return {
    userId: session.user.id,
    email: session.user.email ?? '',
    isSuper: session.user.role === 'superadmin',
    tenantId: session.user.tenantId ?? null,
  }
}

const TENANT_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  isDefault: true,
  parentId: true,
  createdAt: true,
  settings: true,
  parent: { select: { slug: true, name: true } },
  domains: { select: { host: true, isPrimary: true } },
  _count: { select: { users: true } },
} as const

export async function GET() {
  try {
    const actor = await getActor()
    let where: Record<string, unknown> = {}
    if (!actor.isSuper) {
      if (!actor.tenantId) throw new Error('Unauthorized')
      const eff = await effectiveMaster(actor.tenantId)
      if (!eff.canCreateChildren) throw new Error('Platform administration not permitted')
      where = { id: { in: [actor.tenantId, ...(await descendantIds(actor.tenantId))] } }
    }
    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: TENANT_LIST_SELECT,
    })
    return NextResponse.json({ tenants, isSuper: actor.isSuper })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Platform administration not permitted') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Error fetching tenants', error)
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let actor: Actor
  try {
    actor = await getActor()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      name,
      slug,
      branding,
      domains,
      locales,
      regions,
      plans,
      gateways,
      aiDefault,
      adminUser,
      parentId,
      grants,
    } = body as {
      name?: string
      slug?: string
      branding?: Record<string, unknown> | null
      domains?: string[]
      locales?: { supportedLanguages?: string[]; defaultLanguage?: string; currencyRegion?: string }
      regions?: unknown[]
      plans?: unknown[]
      gateways?: unknown[]
      aiDefault?: string
      adminUser?: { email?: string; name?: string; password?: string }
      parentId?: string | null
      grants?: MasterConfig
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 })
    }
    if (!slug || !SLUG_RE.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be 3-40 chars: lowercase letters, digits, hyphens' },
        { status: 400 }
      )
    }
    if (await prisma.tenant.findUnique({ where: { slug } })) {
      return NextResponse.json({ error: 'A tenant with this slug already exists' }, { status: 409 })
    }
    if (adminUser?.email && (!adminUser.password || adminUser.password.length < 8)) {
      return NextResponse.json(
        { error: 'Admin password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Resolve creator context & parent
    let parentTenantId: string | null = null
    let creatorEff = null as Awaited<ReturnType<typeof effectiveMaster>> | null
    if (!actor.isSuper) {
      if (!actor.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      creatorEff = await effectiveMaster(actor.tenantId)
      if (!creatorEff.canCreateChildren) {
        return NextResponse.json(
          { error: 'Your platform has no rights to create sub-platforms' },
          { status: 403 }
        )
      }
      if (parentId && parentId !== actor.tenantId) {
        return NextResponse.json(
          { error: 'Sub-platforms must be created under your own platform' },
          { status: 403 }
        )
      }
      parentTenantId = actor.tenantId
      if (creatorEff.maxChildren !== null) {
        const childCount = await prisma.tenant.count({ where: { parentId: actor.tenantId } })
        if (childCount >= creatorEff.maxChildren) {
          return NextResponse.json(
            { error: `Sub-platform limit reached (${creatorEff.maxChildren})` },
            { status: 403 }
          )
        }
      }
    } else if (parentId) {
      const parent = await prisma.tenant.findUnique({
        where: { id: parentId },
        select: { id: true },
      })
      if (!parent) return NextResponse.json({ error: 'Parent platform not found' }, { status: 400 })
      parentTenantId = parent.id
      creatorEff = await effectiveMaster(parent.id)
    }

    // Child grants = requested ∩ creator's effective (clamped)
    const master =
      creatorEff && grants
        ? clampGrants(grants, creatorEff)
        : (grants ?? (creatorEff ? clampGrants(undefined, creatorEff) : undefined))

    try {
      const provisioned = await provisionTenant({
        slug,
        name: name.trim(),
        branding: branding as never,
        domains,
        locales,
        regions: (Array.isArray(regions) && regions.length ? regions : 'default') as never,
        plans: Array.isArray(plans) ? (plans as never) : undefined,
        gateways: Array.isArray(gateways) ? (gateways as never) : undefined,
        aiDefault,
        adminUser:
          adminUser?.email && adminUser.password
            ? { email: adminUser.email, name: adminUser.name, password: adminUser.password }
            : undefined,
        parentId: parentTenantId,
        master,
      })

      const tenant = await prisma.tenant.findUnique({
        where: { id: provisioned.tenantId },
        include: { domains: true },
      })
      return NextResponse.json({ tenant, provision: provisioned })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (
        message.includes('already in use') ||
        message.includes('not permitted by') ||
        message.includes('allowed set') ||
        message.includes('allowed languages') ||
        message.includes('not active') ||
        message.includes('not found')
      ) {
        return NextResponse.json({ error: message }, { status: 400 })
      }
      throw error
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
    logError('Error creating tenant', error)
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 })
  }
}
