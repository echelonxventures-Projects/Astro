/**
 * Multi-tenant core.
 *
 * A Tenant = one white-label customer platform served by this deployment.
 * Host resolution order:
 *   1. Exact TenantDomain.host match (custom/vanity domains)
 *   2. First label vs tenant slug when host ends with TENANT_ROOT_DOMAIN
 *      (e.g. TENANT_ROOT_DOMAIN=starpath.localhost -> luna.starpath.localhost = "luna")
 *   3. Bare localhost / 127.0.0.1 -> default tenant (dev convenience)
 *
 * All customer data access goes through getScopedDb(tenantId): a Prisma client
 * extension that injects tenantId into creates/reads/updates/deletes on
 * tenant-scoped models. Global models (Region, Account, Session, ...) are untouched.
 */

import { Prisma } from '@prisma/client'
import { LRUCache } from 'lru-cache'
import { headers } from 'next/headers'
import type { BrandConfig, BrandConfigInput } from './branding'
import { mergeBranding } from './branding'
import { prisma } from './db'

export const DEFAULT_TENANT_ID = 'tenant_starpath_default'

export interface TenantSettings {
  oauth?: Record<string, { clientId?: string; clientSecret?: string }>
  emailFrom?: string
  supportEmail?: string
  analyticsId?: string
  features?: Record<string, boolean>
  [key: string]: unknown
}

export interface TenantContext {
  tenantId: string
  slug: string
  name: string
  branding: BrandConfig
  settings: TenantSettings
}

export class TenantNotFoundError extends Error {
  constructor(host: string) {
    super(`Unknown tenant for host "${host}"`)
    this.name = 'TenantNotFoundError'
  }
}

export class TenantNotActiveError extends Error {
  constructor(slug: string, status: string) {
    super(`Tenant "${slug}" is not active (status: ${status})`)
    this.name = 'TenantNotActiveError'
  }
}

const NONE = 'NONE'
const hostCache = new LRUCache<string, string>({ max: 500, ttl: 60_000 })

export function normalizeHost(input: string | null | undefined): string {
  if (!input) return ''
  let host = input.trim().toLowerCase()
  try {
    if (host.includes('://')) host = new URL(host).host
  } catch {
    /* fall through */
  }
  // strip port (localhost:3001 -> localhost, keep IPv6 brackets intact then strip port)
  const v6 = host.match(/^\[([^\]]+)\](?::\d+)?$/)
  if (v6) return v6[1]
  return host.replace(/:\d+$/, '')
}

interface ResolvedRow {
  id: string
  slug: string
  name: string
  status: string
  branding: BrandConfigInput | null
  settings: TenantSettings | null
}

function toContext(row: ResolvedRow): TenantContext {
  return {
    tenantId: row.id,
    slug: row.slug,
    name: row.name,
    branding: mergeBranding(row.branding),
    settings: row.settings ?? {},
  }
}

export async function resolveTenantByHost(
  rawHost: string | null | undefined
): Promise<TenantContext | null> {
  const host = normalizeHost(rawHost)
  if (!host) return null

  const cachedId = hostCache.get(host)
  if (cachedId !== undefined) {
    if (cachedId === NONE) return null
    const row = await prisma.tenant.findUnique({
      where: { id: cachedId },
      select: { id: true, slug: true, name: true, status: true, branding: true, settings: true },
    })
    if (row)
      return toContext({
        ...row,
        branding: row.branding as BrandConfigInput | null,
        settings: row.settings as TenantSettings | null,
      })
    hostCache.delete(host)
  }

  let row: ResolvedRow | null = null

  const domain = await prisma.tenantDomain.findUnique({
    where: { host },
    select: {
      tenant: {
        select: { id: true, slug: true, name: true, status: true, branding: true, settings: true },
      },
    },
  })
  if (domain) {
    row = domain.tenant as ResolvedRow
  }

  if (!row) {
    const root = normalizeHost(process.env.TENANT_ROOT_DOMAIN)
    if (root && host === root) {
      row = await findDefault()
    } else if (root && host.endsWith(`.${root}`)) {
      const slug = host.slice(0, host.length - root.length - 1).split('.')[0]
      if (slug) {
        const t = await prisma.tenant.findUnique({
          where: { slug },
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            branding: true,
            settings: true,
          },
        })
        if (t) row = t as ResolvedRow
      }
    }
  }

  if (!row && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
    row = await findDefault()
  }

  if (!row) {
    hostCache.set(host, NONE)
    return null
  }
  hostCache.set(host, row.id)
  return toContext(row)
}

async function findDefault(): Promise<ResolvedRow | null> {
  const t = await prisma.tenant.findFirst({
    where: { isDefault: true },
    select: { id: true, slug: true, name: true, status: true, branding: true, settings: true },
  })
  return t
    ? {
        ...t,
        branding: t.branding as BrandConfigInput | null,
        settings: t.settings as TenantSettings | null,
      }
    : null
}

/**
 * Resolve the tenant for an inbound payment webhook. Webhook endpoints are
 * registered per-tenant with a ?t=<slug> query param; fall back to host,
 * then to the default tenant.
 */
export async function getWebhookTenant(req: {
  nextUrl: URL
  headers: Headers
}): Promise<TenantContext> {
  const slug = req.nextUrl.searchParams.get('t') ?? req.nextUrl.searchParams.get('tenant')
  if (slug) {
    const t = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, status: true, branding: true, settings: true },
    })
    if (t)
      return toContext({
        ...t,
        branding: t.branding as BrandConfigInput | null,
        settings: t.settings as TenantSettings | null,
      })
  }
  const byHost = await resolveTenantByHost(req.headers.get('host'))
  if (byHost) return byHost
  const def = await findDefault()
  if (!def) throw new TenantNotFoundError(`webhook:${slug ?? 'unknown'}`)
  return toContext(def)
}

/** Server components / route handlers without an explicit request object. */
export async function getTenantContext(): Promise<TenantContext> {
  const h = await headers()
  const host = h.get('host') ?? h.get('x-forwarded-host')
  const ctx = await resolveTenantByHost(host)
  if (!ctx) throw new TenantNotFoundError(host ?? '(no host)')
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { status: true },
  })
  if (!tenant || tenant.status !== 'active')
    throw new TenantNotActiveError(ctx.slug, tenant?.status ?? 'missing')
  return ctx
}

export function invalidateTenantHostCache(): void {
  hostCache.clear()
}

// ===========================================
// Tenant-scoped Prisma client
// ===========================================

const TENANT_SCOPED_MODELS = new Set<string>([
  'User',
  'BirthChart',
  'Reading',
  'ChatSession',
  'Subscription',
  'Payment',
  'PaymentTransaction',
  'Notification',
  'UserDevice',
  'UserMemory',
  'AstroProfile',
  'AppSettings',
  'AIProviderConfig',
  'SubscriptionPlan',
  'PlanFeature',
  'PaymentGateway',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = Record<string, any>

function injectTenant(args: AnyArgs | undefined, tenantId: string): AnyArgs {
  const a: AnyArgs = args ? { ...args } : {}
  if (a.where && typeof a.where === 'object' && !('__prisma_raw__' in a.where)) {
    a.where = { tenantId, ...a.where }
  } else if (a.where === undefined) {
    a.where = { tenantId }
  }
  // data injection for creates
  if (a.data !== undefined) {
    if (Array.isArray(a.data)) {
      a.data = a.data.map(d => ({ tenantId, ...d }))
    } else if (typeof a.data === 'object') {
      a.data = { tenantId, ...a.data }
    }
  }
  // nested create in upsert
  if (a.create !== undefined && typeof a.create === 'object' && !Array.isArray(a.create)) {
    a.create = { tenantId, ...a.create }
  }
  return a
}

const scopedClients = new Map<string, ScopedDb>()

function buildScopedClient(tenantId: string) {
  return prisma.$extends({
    name: `tenant-${tenantId}`,
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args)
          }
          if (operation === 'runQueryRaw' || operation === 'executeRaw') {
            return query(args)
          }
          const modified = injectTenant(args as AnyArgs, tenantId)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return query(modified as any)
        },
      },
    },
  })
}

export type ScopedDb = ReturnType<typeof buildScopedClient>

export function getScopedDb(tenantId: string): ScopedDb {
  let client = scopedClients.get(tenantId)
  if (!client) {
    client = buildScopedClient(tenantId)
    scopedClients.set(tenantId, client)
  }
  return client
}

// ===========================================
// Session <-> tenant guard
// ===========================================

export function assertSameTenant(sessionTenantId: string | undefined, ctx: TenantContext): boolean {
  if (!sessionTenantId) return false
  return sessionTenantId === ctx.tenantId
}

export function tenantFilter(tenantId: string): Prisma.UserWhereInput {
  return { tenantId } as Prisma.UserWhereInput
}
