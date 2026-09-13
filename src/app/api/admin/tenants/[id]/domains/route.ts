/**
 * Domain management for a platform (in-house vs tenant-owned custom domains).
 * GET  /api/admin/tenants/:id/domains -> list + DNS instructions
 * POST /api/admin/tenants/:id/domains -> { host } attach custom domain (pending)
 */

import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { effectiveMaster } from '@/lib/master-config'
import { invalidateTenantHostCache, normalizeDomainHost } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

async function access(targetTenantId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (session.user.role === 'superadmin') return { session, isSuper: true }
  if (session.user.role !== 'admin' || !session.user.tenantId) throw new Error('Forbidden')
  // a tenant admin may manage their own domains (minus force-verify)
  if (session.user.tenantId === targetTenantId) return { session, isSuper: false }
  const eff = await effectiveMaster(session.user.tenantId)
  if (!eff.canCreateChildren) throw new Error('Forbidden')
  const target = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
    select: { parentId: true },
  })
  if (!target || target.parentId !== session.user.tenantId) throw new Error('Forbidden')
  return { session, isSuper: false }
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/

function dnsInstructions(host: string, token: string) {
  return {
    recordType: 'TXT',
    name: host.startsWith('_starpath-verify.') ? host : `_starpath-verify.${host}`,
    value: token,
    alternative: {
      recordType: 'CNAME',
      name: `_starpath-verify.${host}`,
      value: `verify.t.starpath.app`,
    },
  }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    await access(id)
    const domains = await prisma.tenantDomain.findMany({
      where: { tenantId: id },
      orderBy: [{ isPrimary: 'desc' }, { host: 'asc' }],
    })
    return NextResponse.json({
      domains: domains.map(d => ({
        id: d.id,
        host: d.host,
        type: d.type,
        status: d.status,
        isPrimary: d.isPrimary,
        verifiedAt: d.verifiedAt,
        verificationToken: d.verificationToken,
        dns: d.verificationToken ? dnsInstructions(d.host, d.verificationToken) : null,
      })),
    })
  } catch (error: unknown) {
    return handle(error, 'Failed to list domains')
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    await access(id)
    const body = await req.json()
    const host = normalizeDomainHost(String(body?.host ?? ''))
    if (!host || !HOST_RE.test(host)) {
      return NextResponse.json(
        { error: 'Provide a valid fully-qualified domain (e.g. astro.customer.com)' },
        { status: 400 }
      )
    }
    if (host === 'localhost' || host.endsWith('.localhost')) {
      return NextResponse.json({ error: 'Local hosts are managed automatically' }, { status: 400 })
    }
    const existing = await prisma.tenantDomain.findUnique({ where: { host } })
    if (existing) {
      return NextResponse.json(
        { error: existing.tenantId === id ? 'Domain already attached' : 'Domain already in use' },
        { status: 409 }
      )
    }
    const token = `vp_${randomBytes(16).toString('hex')}`
    const domain = await prisma.tenantDomain.create({
      data: { host, tenantId: id, type: 'custom', status: 'pending', verificationToken: token },
    })
    invalidateTenantHostCache()
    return NextResponse.json({
      domain: {
        id: domain.id,
        host: domain.host,
        type: domain.type,
        status: domain.status,
        isPrimary: domain.isPrimary,
      },
      dns: dnsInstructions(host, token),
      note: 'The domain will serve the platform only after DNS verification.',
    })
  } catch (error: unknown) {
    return handle(error, 'Failed to attach domain')
  }
}

function handle(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
  if (message === 'Forbidden') return NextResponse.json({ error: message }, { status: 403 })
  logError(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
