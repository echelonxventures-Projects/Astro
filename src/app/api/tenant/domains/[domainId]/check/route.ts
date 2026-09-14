/**
 * Manual lifecycle check for one of the tenant's own domains.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runDomainCheck } from '@/lib/domains/monitor'
import { getTenantContext } from '@/lib/tenant'

type Ctx = { params: Promise<{ domainId: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getTenantContext()
    if (
      session.user.tenantId !== ctx.tenantId ||
      (session.user.role !== 'admin' && session.user.role !== 'superadmin')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { domainId } = await params
    const domain = await prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId: ctx.tenantId },
    })
    if (!domain) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const r = await runDomainCheck(domainId)
    return NextResponse.json({
      ok: r?.status === 'verified',
      status: r?.status,
      message: r?.message,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    )
  }
}
