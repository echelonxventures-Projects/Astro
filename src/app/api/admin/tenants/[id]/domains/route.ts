/**
 * Domain management for a platform (in-house vs tenant-owned custom domains).
 * GET  /api/admin/tenants/:id/domains -> list + DNS instructions
 * POST /api/admin/tenants/:id/domains -> { host } attach custom domain (pending)
 */

import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { dnsInstructions as sharedDns } from '@/lib/domains/check'
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

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    await access(id)
    const domains = await prisma.tenantDomain.findMany({
      where: { tenantId: id },
      orderBy: [{ isPrimary: 'desc' }, { host: 'asc' }],
      include: { _count: { select: { checks: true } } },
    })
    return NextResponse.json({
      domains: domains.map(d => ({
        id: d.id,
        host: d.host,
        type: d.type,
        status: d.status,
        isPrimary: d.isPrimary,
        verifiedAt: d.verifiedAt,
        lastCheckedAt: d.lastCheckedAt,
        lastCheckMessage: d.lastCheckMessage,
        live: d.live,
        verificationToken: d.verificationToken,
        checkCount: d._count.checks,
        dns: d.verificationToken
          ? sharedDns({ host: d.host, verificationToken: d.verificationToken })
          : null,
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
      data: { host, tenantId: id, type: 'custom', status: 'pending_dns', verificationToken: token },
    })
    invalidateTenantHostCache()
    let check: { status: string; message: string } | null = null
    try {
      const { runDomainCheck } = await import('@/lib/domains/monitor')
      check = await runDomainCheck(domain.id)
    } catch {
      /* best effort */
    }
    return NextResponse.json({
      domain: {
        id: domain.id,
        host: domain.host,
        type: domain.type,
        status: check?.status ?? domain.status,
        isPrimary: domain.isPrimary,
        message: check?.message,
      },
      dns: sharedDns({ host, verificationToken: token }),
      note: 'Stage your DNS records at your registrar; the platform advances automatically (monitor every 5m) or via Check now.',
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
