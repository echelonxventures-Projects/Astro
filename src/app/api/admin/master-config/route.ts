/**
 * Master configuration API for the admin portal.
 *
 * GET  /api/admin/master-config
 *   -> { scope, effective, node, tree, catalog }
 *   scope: "root" (superadmin / no parent) or "sub-platform"
 *   effective: options & rights this platform actually has (parent-capped)
 *   tree: platform hierarchy with each node's own master (superadmin: all; admin: own subtree)
 *   catalog: full option universe (for building grant pickers)
 *
 * POST /api/admin/master-config  { tenantId, grants }
 *   superadmin: set any platform's master grants.
 *   granted platform admin: set a direct child's grants (clamped to own effective).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { logError } from '@/lib/logger'
import {
  clampGrants,
  effectiveMaster,
  parseMaster,
  type MasterConfig,
  GATEWAY_KEYS,
  AI_PROVIDER_KEYS,
} from '@/lib/master-config'
import type { TenantSettings } from '@/lib/tenant'
import { DEFAULT_REGION_TEMPLATE } from '@/lib/tenant-defaults'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CATALOG = {
  languages: SUPPORTED_LANGUAGES.map(l => ({ code: l.code, name: l.name })),
  regions: DEFAULT_REGION_TEMPLATE.map(r => ({ key: r.key, name: r.name, currency: r.currency })),
  gateways: [...GATEWAY_KEYS],
  aiProviders: [...AI_PROVIDER_KEYS],
}

interface Node {
  id: string
  slug: string
  name: string
  parentId: string | null
  master: MasterConfig | null
  children?: Node[]
}

function buildTree(
  rows: Array<{
    id: string
    slug: string
    name: string
    parentId: string | null
    settings: unknown
  }>
): Node[] {
  const nodes = new Map<string, Node>()
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      slug: r.slug,
      name: r.name,
      parentId: r.parentId,
      master: parseMaster((r.settings ?? null) as TenantSettings | null),
      children: [],
    })
  }
  const roots: Node[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children!.push(node)
    else roots.push(node)
  }
  return roots
}

async function getActor() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export async function GET() {
  try {
    const session = await getActor()
    const tenantId = session.user.tenantId!
    const isSuper = session.user.role === 'superadmin'
    const effective = await effectiveMaster(tenantId)
    const self = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true, parentId: true, settings: true },
    })

    const rows = isSuper
      ? await prisma.tenant.findMany({
          select: { id: true, slug: true, name: true, parentId: true, settings: true },
          orderBy: { createdAt: 'asc' },
        })
      : await prisma.tenant.findMany({
          where: { OR: [{ id: tenantId }, { parentId: tenantId }] },
          select: { id: true, slug: true, name: true, parentId: true, settings: true },
          orderBy: { createdAt: 'asc' },
        })

    return NextResponse.json({
      isSuper,
      scope: self?.parentId ? 'sub-platform' : 'root',
      self: self
        ? {
            id: self.id,
            slug: self.slug,
            name: self.name,
            parentId: self.parentId,
            master: parseMaster((self.settings ?? null) as TenantSettings),
          }
        : null,
      effective,
      canEdit: isSuper || effective.canCreateChildren,
      tree: buildTree(rows),
      catalog: CATALOG,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
    logError('master-config GET error', error)
    return NextResponse.json({ error: 'Failed to load master config' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getActor()
    const actorTenantId = session.user.tenantId!
    const isSuper = session.user.role === 'superadmin'
    const body = await req.json()
    const { tenantId: targetId, grants } = body as { tenantId?: string; grants?: MasterConfig }
    if (!targetId || !grants)
      return NextResponse.json({ error: 'tenantId and grants are required' }, { status: 400 })

    const target = await prisma.tenant.findUnique({
      where: { id: targetId },
      select: { id: true, parentId: true, settings: true },
    })
    if (!target) return NextResponse.json({ error: 'Platform not found' }, { status: 404 })

    if (!isSuper) {
      if (target.parentId !== actorTenantId) {
        return NextResponse.json(
          { error: 'You can only configure direct child platforms' },
          { status: 403 }
        )
      }
      const actorEff = await effectiveMaster(actorTenantId)
      if (!actorEff.canCreateChildren) {
        return NextResponse.json(
          { error: 'Your platform has no administration rights' },
          { status: 403 }
        )
      }
      const clamped = clampGrants(grants, actorEff)
      const settings = (target.settings ?? {}) as TenantSettings
      settings.master = clamped
      await prisma.tenant.update({ where: { id: targetId }, data: { settings: settings as never } })
      const { invalidateTenantHostCache } = await import('@/lib/tenant')
      invalidateTenantHostCache()
      return NextResponse.json({ ok: true, grants: clamped, clampedToActor: true })
    }

    const parentEff = target.parentId
      ? await effectiveMaster(target.parentId)
      : await effectiveMaster(targetId)
    const applied = target.parentId ? clampGrants(grants, parentEff) : grants
    const settings = (target.settings ?? {}) as TenantSettings
    settings.master = applied
    await prisma.tenant.update({ where: { id: targetId }, data: { settings: settings as never } })
    const { invalidateTenantHostCache } = await import('@/lib/tenant')
    invalidateTenantHostCache()
    return NextResponse.json({ ok: true, grants: applied })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
    if (message.includes('only configure') || message.includes('no administration')) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    logError('master-config POST error', error)
    return NextResponse.json({ error: 'Failed to save master config' }, { status: 500 })
  }
}
