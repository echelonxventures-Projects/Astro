/**
 * Verify / remove a platform domain.
 * POST { force? } -> DNS TXT challenge (_starpath-verify.<host> == token); force = superadmin only
 * DELETE -> remove a custom domain (in-house/primary hosts are managed, not removable here)
 */

import { promises as dns } from 'dns'
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

    const recordName = `_starpath-verify.${domain.host}`
    let found: string[] = []
    try {
      const answers = await dns.resolveTxt(recordName)
      found = answers.map(parts => parts.join(''))
    } catch (error) {
      logError('DNS TXT lookup failed', {
        recordName,
        error: error instanceof Error ? error.message : error,
      })
    }
    const matched = domain.verificationToken ? found.includes(domain.verificationToken) : false
    if (matched) {
      await prisma.tenantDomain.update({
        where: { id: domain.id },
        data: { status: 'verified', verifiedAt: new Date() },
      })
      invalidateTenantHostCache()
      return NextResponse.json({ ok: true, verified: true })
    }
    return NextResponse.json({
      ok: false,
      verified: false,
      recordName,
      expected: domain.verificationToken,
      found,
      hint: 'Add the TXT record at the domain’s DNS provider, then retry. Propagation can take a few minutes.',
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

function handle(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
  if (message === 'Forbidden') return NextResponse.json({ error: message }, { status: 403 })
  logError(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
