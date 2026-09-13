/**
 * Tenant provisioning - creates a fully-configured white-label platform:
 * tenant + domains + regions/currencies + features + plans + payment gateways
 * + AI catalog (+ optional admin user). Used by the onboarding wizard API
 * and the seed. Everything lives in the DB and is editable afterwards.
 */

import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { ensureDefaultCatalog } from './ai/catalog'
import { mergeBranding, type BrandConfigInput } from './branding'
import {
  effectiveMaster,
  validateAgainstMaster,
  ROOT_EFFECTIVE,
  type MasterConfig,
} from './master-config'
import { initializeDefaultPlans } from './plans'
import type { TenantSettings } from './tenant'
import { invalidateTenantHostCache, normalizeDomainHost, validateSlug } from './tenant'
import { DEFAULT_REGION_TEMPLATE, type RegionTemplate } from './tenant-defaults'
import { prisma } from '@/lib/db'

export interface GatewaySpec {
  key: string
  name?: string
  apiKey?: string | null
  apiSecret?: string | null
  publicKey?: string | null
  webhookSecret?: string | null
  isEnabled?: boolean
  isDefault?: boolean
  testMode?: boolean
}

export interface PlanSpec {
  key: string
  name: string
  description?: string | null
  price: number
  currency?: string
  interval?: string | null
  isPopular?: boolean
  sortOrder?: number
}

export interface ProvisionOptions {
  slug: string
  name: string
  parentId?: string | null
  master?: MasterConfig
  branding?: BrandConfigInput | null
  domains?: string[]
  locales?: TenantSettings['locales']
  regions?: RegionTemplate[] | 'default'
  plans?: PlanSpec[]
  gateways?: GatewaySpec[]
  aiDefault?: string
  adminUser?: { email: string; name?: string; password: string }
}

export interface ProvisionResult {
  tenantId: string
  slug: string
  primaryHost: string
  adminEmail: string | null
  adminPassword: string | null
}

const GATEWAY_LABELS: Record<string, { name: string; envKeys: Record<string, string> }> = {
  stripe: {
    name: 'Stripe',
    envKeys: { apiKey: 'STRIPE_SECRET_KEY', webhookSecret: 'STRIPE_WEBHOOK_SECRET' },
  },
  razorpay: {
    name: 'Razorpay',
    envKeys: {
      publicKey: 'RAZORPAY_KEY_ID',
      apiSecret: 'RAZORPAY_KEY_SECRET',
      webhookSecret: 'RAZORPAY_WEBHOOK_SECRET',
    },
  },
  paypal: {
    name: 'PayPal',
    envKeys: { apiKey: 'PAYPAL_CLIENT_ID', apiSecret: 'PAYPAL_CLIENT_SECRET' },
  },
}

export function classifyDomainHost(host: string): {
  type: 'in_house' | 'custom'
  status: 'verified' | 'pending'
} {
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
  return isLocal ? { type: 'in_house', status: 'verified' } : { type: 'custom', status: 'pending' }
}

export async function provisionTenant(opts: ProvisionOptions): Promise<ProvisionResult> {
  // Hierarchy: children are bound to a parent and restricted by its effective master
  const regions =
    opts.regions === 'default' || opts.regions === undefined
      ? DEFAULT_REGION_TEMPLATE
      : opts.regions
  let eff = ROOT_EFFECTIVE
  if (opts.parentId) {
    const parent = await prisma.tenant.findUnique({
      where: { id: opts.parentId },
      select: { id: true, status: true },
    })
    if (!parent) throw new Error('Parent platform not found')
    if (parent.status !== 'active') throw new Error('Parent platform is not active')
    eff = await effectiveMaster(parent.id)
  }

  const violations = validateAgainstMaster(eff, {
    languages: opts.locales?.supportedLanguages,
    defaultLanguage: opts.locales?.defaultLanguage,
    regions:
      opts.regions === 'default' || opts.regions === undefined
        ? undefined
        : (regions as Array<{ key: string }>).map(r => r.key),
    gateways: opts.gateways?.map(g => g.key),
    aiDefault: opts.aiDefault,
  })
  if (violations.length > 0) {
    throw new Error(violations.join('; '))
  }

  const slugProblem = validateSlug(opts.slug)
  if (slugProblem) throw new Error(slugProblem)

  const rootHost = normalizeDomainHost(process.env.TENANT_ROOT_DOMAIN ?? '') || 'localhost'
  const isLocalhost = (host: string): boolean =>
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
  const hosts = new Map<string, { type: string; status: string; token: string | null }>()
  const primary = `${opts.slug}.${rootHost}`
  hosts.set(primary, { type: 'in_house', status: 'verified', token: null })
  if (rootHost !== 'localhost') {
    // dev-convenience alias so tooling/tests can use <slug>.localhost anywhere
    hosts.set(`${opts.slug}.localhost`, { type: 'in_house', status: 'verified', token: null })
  }
  for (const h of opts.domains ?? []) {
    const host = normalizeDomainHost(String(h))
    if (!host || hosts.has(host)) continue
    hosts.set(
      host,
      isLocalhost(host)
        ? { type: 'in_house', status: 'verified', token: null }
        : { type: 'custom', status: 'pending', token: `vp_${randomBytes(16).toString('hex')}` }
    )
  }
  for (const host of hosts.keys()) {
    const taken = await prisma.tenantDomain.findUnique({ where: { host } })
    if (taken) throw new Error(`Domain already in use: ${host}`)
  }

  const settings: TenantSettings = {
    ...(opts.locales ? { locales: opts.locales } : {}),
  }

  const tenant = await prisma.tenant.create({
    data: {
      slug: opts.slug,
      name: opts.name,
      branding: opts.branding ? (mergeBranding(opts.branding) as never) : undefined,
      settings: { ...(opts.master ? { ...settings, master: opts.master } : settings) } as never,
      parentId: opts.parentId ?? null,
      domains: {
        create: Array.from(hosts.entries()).map(([host, meta], i) => ({
          host,
          isPrimary: i === 0,
          type: meta.type,
          status: meta.status,
          verificationToken: meta.token,
          verifiedAt: meta.status === 'verified' ? new Date() : null,
        })),
      },
    },
  })

  // Regions / currencies
  for (const r of regions as RegionTemplate[]) {
    const existing = await prisma.region.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: r.key } },
    })
    if (!existing) {
      await prisma.region.create({
        data: {
          tenantId: tenant.id,
          key: r.key,
          name: r.name,
          code: r.code,
          currency: r.currency,
          currencies: r.currencies ? JSON.stringify(r.currencies) : null,
          isActive: r.isActive,
          isDefault: r.isDefault,
          sortOrder: r.sortOrder,
          priceMultiplier: r.priceMultiplier,
        },
      })
    }
  }

  // Features + default plans (idempotent, tenant-scoped). When the wizard
  // supplied an explicit market list, skip the built-in region seeding.
  await initializeDefaultPlans(tenant.id, !Array.isArray(opts.regions))

  // Custom plan overrides (create or update)
  for (const p of opts.plans ?? []) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: p.key } },
    })
    const data = {
      name: p.name,
      description: p.description ?? null,
      price: p.price,
      currency: (p.currency ?? 'usd').toLowerCase(),
      interval: p.interval ?? (p.price > 0 ? 'monthly' : null),
      isPopular: p.isPopular ?? false,
      sortOrder: p.sortOrder ?? (p.key === 'free' ? 0 : p.key === 'monthly' ? 1 : 2),
      tier: p.price > 0 ? 'paid' : 'free',
      isActive: true,
    }
    if (existing) {
      await prisma.subscriptionPlan.update({ where: { id: existing.id }, data })
    } else {
      await prisma.subscriptionPlan.create({ data: { tenantId: tenant.id, key: p.key, ...data } })
    }
  }

  // Payment gateways
  for (const g of opts.gateways ?? []) {
    const meta = GATEWAY_LABELS[g.key] ?? { name: g.key, envKeys: {} }
    const envOf = (field: string): string | null => {
      const envKey = meta.envKeys[field]
      return envKey ? process.env[envKey] || null : null
    }
    const apiKey = g.apiKey ?? envOf('apiKey')
    const apiSecret = g.apiSecret ?? envOf('apiSecret')
    const publicKey = g.publicKey ?? envOf('publicKey')
    const webhookSecret = g.webhookSecret ?? envOf('webhookSecret')
    const enabled = g.isEnabled ?? Boolean(apiKey || apiSecret)
    await prisma.paymentGateway.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: g.key } },
      update: { apiKey, apiSecret, publicKey, webhookSecret, isEnabled: enabled },
      create: {
        tenantId: tenant.id,
        key: g.key,
        name: g.name ?? meta.name,
        description: `${meta.name} payments`,
        apiKey,
        apiSecret,
        publicKey,
        webhookSecret,
        isEnabled: enabled,
        isDefault: g.isDefault ?? false,
        testMode: g.testMode ?? false,
        sortOrder: g.key === 'stripe' ? 1 : g.key === 'razorpay' ? 2 : 3,
      },
    })
  }

  // AI provider catalog (+ optional default)
  await ensureDefaultCatalog(tenant.id, tenant.name)
  if (opts.aiDefault) {
    const entry = await prisma.aIProviderCatalog.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: opts.aiDefault } },
    })
    if (entry) {
      await prisma.aIProviderCatalog.updateMany({
        where: { tenantId: tenant.id },
        data: { isDefault: false },
      })
      await prisma.aIProviderCatalog.update({ where: { id: entry.id }, data: { isDefault: true } })
    }
  }

  // Admin user
  let adminEmail: string | null = null
  let adminPassword: string | null = null
  if (opts.adminUser?.email && opts.adminUser.password) {
    const passwordHash = await bcrypt.hash(opts.adminUser.password, 12)
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: opts.adminUser.email } },
      update: { role: 'admin', passwordHash },
      create: {
        tenantId: tenant.id,
        email: opts.adminUser.email,
        name: opts.adminUser.name ?? `${opts.name} Admin`,
        passwordHash,
        emailVerified: new Date(),
        role: 'admin',
      },
    })
    adminEmail = opts.adminUser.email
    adminPassword = opts.adminUser.password
  }

  invalidateTenantHostCache()
  return { tenantId: tenant.id, slug: tenant.slug, primaryHost: primary, adminEmail, adminPassword }
}
