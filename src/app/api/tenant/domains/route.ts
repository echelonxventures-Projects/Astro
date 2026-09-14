/**
 * Current tenant's domains (self-service portal).
 * GET  -> list with lifecycle state + DNS instructions
 * POST -> { host } attach a custom domain (pending stages)
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { dnsInstructions } from '@/lib/domains/check'
import { runDomainCheck } from '@/lib/domains/monitor'
import { getTenantContext } from '@/lib/tenant'

export async function GET() {
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
    const domains = await prisma.tenantDomain.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ isPrimary: 'desc' }, { host: 'asc' }],
    })
    return NextResponse.json({
      domains: domains.map(d => ({
        id: d.id,
        host: d.host,
        type: d.type,
        status: d.status,
        isPrimary: d.isPrimary,
        live: d.live,
        lastCheckedAt: d.lastCheckedAt,
        lastCheckMessage: d.lastCheckMessage,
        verificationToken: d.verificationToken,
        dns: d.verificationToken
          ? dnsInstructions({ host: d.host, verificationToken: d.verificationToken })
          : null,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/

export async function POST(req: NextRequest) {
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
    const body = await req.json()
    const host = String(body?.host ?? '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '')
      .replace(/:\d+$/, '')
    if (!HOST_RE.test(host)) {
      return NextResponse.json(
        { error: 'Enter a valid fully-qualified domain, e.g. www.mybrand.com' },
        { status: 400 }
      )
    }
    const taken = await prisma.tenantDomain.findUnique({ where: { host } })
    if (taken) {
      return NextResponse.json(
        { error: taken.tenantId === ctx.tenantId ? 'Already attached' : 'Domain already in use' },
        { status: 409 }
      )
    }
    const token = `vp_${randomBytes(16).toString('hex')}`
    const created = await prisma.tenantDomain.create({
      data: {
        host,
        tenantId: ctx.tenantId,
        type: 'custom',
        status: 'pending_dns',
        verificationToken: token,
      },
    })
    const check = await runDomainCheck(created.id)
    return NextResponse.json({
      ok: true,
      status: check?.status,
      message: check?.message,
      dns: dnsInstructions({ host, verificationToken: token }),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to attach domain' },
      { status: 500 }
    )
  }
}
