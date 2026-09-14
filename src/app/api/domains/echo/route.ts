/**
 * Tenant-masked liveness probe used by the domain monitor and health checks:
 * whatever platform answers on this host, identified by its slug. No secrets,
 * no PII — just "you reached the right place".
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/tenant'

export async function GET() {
  try {
    const ctx = await getTenantContext()
    return NextResponse.json({ platform: ctx.slug, ok: true })
  } catch {
    return NextResponse.json({ error: 'no tenant for host' }, { status: 404 })
  }
}
