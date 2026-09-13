/**
 * ACME "ask" endpoint for on-demand TLS (Caddy calls this before issuing a cert
 * for an unknown SNI hostname):  https://<root>/api/domains/challenge?key=<secret>&domain=<host>
 *
 * 200 -> certificate may be issued (host maps to a tenant and passes ownership rules)
 * 404 -> not issued (unregistered or pending-verification custom domain)
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeDomainHost, resolveTenantByHost } from '@/lib/tenant'

function safeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export async function GET(req: NextRequest) {
  const secret = process.env.CADDY_ASK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ask endpoint not configured' }, { status: 501 })
  }
  const url = new URL(req.url)
  if (!safeEquals(url.searchParams.get('key') ?? '', secret)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const domain = normalizeDomainHost(url.searchParams.get('domain') ?? '')
  if (!domain) {
    return NextResponse.json({ error: 'domain query param required' }, { status: 400 })
  }
  const ctx = await resolveTenantByHost(domain)
  if (!ctx) {
    return NextResponse.json({ error: 'domain not issuable' }, { status: 404 })
  }
  return new NextResponse('ok')
}
