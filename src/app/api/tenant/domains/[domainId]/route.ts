/**
 * Current tenant domain item: PATCH (disable/enable) / DELETE (detach)
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTenantContext, invalidateTenantHostCache } from '@/lib/tenant'

type Ctx = { params: Promise<{ domainId: string }> }

async function guard() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const ctx = await getTenantContext()
  if (
    session.user.tenantId !== ctx.tenantId ||
    (session.user.role !== 'admin' && session.user.role !== 'superadmin')
  ) {
    throw new Error('Forbidden')
  }
  return ctx
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const ctx = await guard()
    const { domainId } = await params
    const body = await req.json()
    const want = String(body?.status ?? '')
    if (!['disabled', 'verified'].includes(want))
      return NextResponse.json({ error: 'status invalid' }, { status: 400 })
    const domain = await prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId: ctx.tenantId },
    })
    if (!domain) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (domain.type !== 'custom')
      return NextResponse.json(
        { error: 'Platform subdomains cannot be changed here' },
        { status: 400 }
      )
    if (want === 'verified' && !['disabled', 'failing'].includes(domain.status)) {
      return NextResponse.json({ error: 'Use Check for staged domains' }, { status: 400 })
    }
    await prisma.tenantDomain.update({ where: { id: domain.id }, data: { status: want } })
    invalidateTenantHostCache()
    return NextResponse.json({ ok: true, status: want })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const ctx = await guard()
    const { domainId } = await params
    const domain = await prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId: ctx.tenantId },
    })
    if (!domain) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (domain.type !== 'custom' || domain.isPrimary) {
      return NextResponse.json(
        { error: 'Primary/platform hosts cannot be removed' },
        { status: 400 }
      )
    }
    await prisma.tenantDomain.delete({ where: { id: domain.id } })
    invalidateTenantHostCache()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
