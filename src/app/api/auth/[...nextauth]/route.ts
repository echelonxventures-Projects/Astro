import { NextRequest, NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { buildAuthOptions } from '@/lib/auth'
import { normalizeHost, resolveTenantByHost } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AuthRouteContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any
}

async function run(req: NextRequest, context: AuthRouteContext): Promise<NextResponse | Response> {
  const host = normalizeHost(req.headers.get('host') ?? req.nextUrl?.host ?? '')
  const tenant = await resolveTenantByHost(host)
  const handler = NextAuth(buildAuthOptions(tenant))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (handler as any)(req, context) as Promise<NextResponse | Response>
}

export async function GET(
  req: NextRequest,
  context: AuthRouteContext
): Promise<NextResponse | Response> {
  return run(req, context)
}

export async function POST(
  req: NextRequest,
  context: AuthRouteContext
): Promise<NextResponse | Response> {
  return run(req, context)
}
