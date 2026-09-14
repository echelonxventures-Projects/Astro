/**
 * Verify / remove a platform domain.
 * POST { force? } -> DNS TXT challenge (_starpath-verify.<host> == token); force = superadmin only
 * DELETE -> remove a custom domain (in-house/primary hosts are managed, not removable here)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { effectiveMaster } from '@/lib/master-config'
import { invalidateTenantHostCache } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; domainId: string }> }

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

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id, domainId } = await params
    const { isSuper } = await access(id)
    const domain = await prisma.tenantDomain.findFirst({ where: { id: domainId, tenantId: id } })
    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    if (domain.type !== 'custom') {
      return NextResponse.json(
        { error: 'In-house subdomains need no verification' },
        { status: 400 }
      )
    }
    if (domain.status === 'verified') return NextResponse.json({ ok: true, alreadyVerified: true })

    const body = await req.json().catch(() => ({}) as { force?: boolean })
    if (body?.force) {
      if (!isSuper)
        return NextResponse.json(
          { error: 'Only the platform operator may force-verify' },
          { status: 403 }
        )
      await prisma.tenantDomain.update({
        where: { id: domain.id },
        data: { status: 'verified', verifiedAt: new Date() },
      })
      invalidateTenantHostCache()
      return NextResponse.json({ ok: true, forced: true })
    }

    const { runDomainCheck } = await import('@/lib/domains/monitor')
    const r = await runDomainCheck(domain.id)
    if (!r) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    return NextResponse.json({
      ok: r.status === 'verified',
      verified: r.status === 'verified',
      status: r.status,
      message: r.message,
    })
  } catch (error: unknown) {
    return handle(error, 'Failed to verify domain')
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id, domainId } = await params
    await access(id)
    const domain = await prisma.tenantDomain.findFirst({ where: { id: domainId, tenantId: id } })
    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    if (domain.type === 'in_house' || domain.isPrimary) {
      return NextResponse.json(
        { error: 'The primary/in-house host cannot be removed here' },
        { status: 400 }
      )
    }
    await prisma.tenantDomain.delete({ where: { id: domain.id } })
    invalidateTenantHostCache()
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handle(error, 'Failed to remove domain')
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id, domainId } = await params
    await access(id)
    const body = await req.json()
    const want = String(body?.status ?? '')
    if (!['disabled', 'verified'].includes(want)) {
      return NextResponse.json(
        { error: "status must be 'disabled' or 'verified'" },
        { status: 400 }
      )
    }
    const domain = await prisma.tenantDomain.findFirst({ where: { id: domainId, tenantId: id } })
    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    if (domain.type !== 'custom')
      return NextResponse.json(
        { error: 'In-house hosts are managed automatically' },
        { status: 400 }
      )
    if (want === 'verified' && domain.status !== 'disabled' && domain.status !== 'failing') {
      return NextResponse.json(
        { error: 'Only disabled/failing domains can be re-enabled; use Check for staged ones' },
        { status: 400 }
      )
    }
    await prisma.tenantDomain.update({ where: { id: domain.id }, data: { status: want } })
    invalidateTenantHostCache()
    return NextResponse.json({ ok: true, status: want })
  } catch (error: unknown) {
    return handle(error, 'Failed to update domain state')
  }
}

function handle(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
  if (message === 'Forbidden') return NextResponse.json({ error: message }, { status: 403 })
  logError(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
