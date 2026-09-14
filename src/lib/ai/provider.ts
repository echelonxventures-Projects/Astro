/**
 * AI Provider interface + catalog-driven resolution.
 *
 * Resolution order (per tenant, resolved from the request host):
 *   1. AIProviderCatalog (DB, admin-managed) - default entry or priority order
 *   2. Legacy bootstrap (env + AppSettings) if the tenant has no catalog yet
 */

import type { CatalogEntry } from './catalog'
import { buildProviderFromEntry, getEntry, isUsable, listCatalog } from './catalog'
import { DEFAULT_TENANT_ID, resolveTenantByHost } from '@/lib/tenant'

export interface AIProviderConfig {
  provider: string
  apiKey?: string
  ollamaUrl?: string
  baseUrl?: string
  model?: string
  maxTokens?: number
}

export interface TextCompletionRequest {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  system?: string
  maxTokens?: number
}

export interface VisionCompletionRequest extends TextCompletionRequest {
  imageUrl?: string
  imageMimeType?: string
}

export interface AIProvider {
  name: string
  supportsVision: boolean
  complete(request: TextCompletionRequest): Promise<string>
  completeWithVision?(request: VisionCompletionRequest): Promise<string>
}

/** Tenant id for the current request (server components/route handlers). */
export async function resolveAiTenantId(): Promise<string> {
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    const ctx = await resolveTenantByHost(h.get('host') ?? h.get('x-forwarded-host'))
    return ctx?.tenantId ?? DEFAULT_TENANT_ID
  } catch {
    return DEFAULT_TENANT_ID
  }
}

/**
 * Legacy bootstrap for tenants without a provider catalog yet:
 * derive a synthetic entry from env keys / AppSettings (mirrors the
 * original hardcoded priority chain: openrouter > nvidia > ollama > anthropic > gemini).
 */
async function legacyEntry(tenantId: string): Promise<CatalogEntry | null> {
  const { prisma } = await import('@/lib/db')
  const settings = await prisma.appSettings.findMany({
    where: {
      tenantId,
      key: {
        in: [
          'AI_PROVIDER',
          'AI_MODEL',
          'OLLAMA_URL',
          'ANTHROPIC_API_KEY',
          'GEMINI_API_KEY',
          'OPENROUTER_API_KEY',
          'NVIDIA_API_KEY',
        ],
      },
    },
  })
  const m = Object.fromEntries(settings.map(s => [s.key, s.value]))

  const base = (over: Partial<CatalogEntry>): CatalogEntry => ({
    id: `legacy-${over.key}`,
    key: over.key ?? 'legacy',
    label: over.label ?? 'Legacy',
    kind: over.kind ?? 'openai-compatible',
    cost: over.cost ?? 'free',
    baseUrl: null,
    apiKey: null,
    models: [],
    capabilities: [],
    options: {},
    enabled: true,
    isDefault: false,
    sortOrder: 999,
    ...over,
  })

  const openrouterKey = m['OPENROUTER_API_KEY'] || process.env.OPENROUTER_API_KEY
  if (openrouterKey) {
    return base({
      key: 'openrouter',
      label: 'OpenRouter',
      kind: 'openai-compatible',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: openrouterKey,
      models: [m['AI_MODEL'] || 'inclusionai/ling-3.0-flash-vl:free'],
      capabilities: ['vision'],
      options: {
        extraHeaders: {
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'Astrology Platform',
        },
      },
    })
  }
  const nvidiaKey = m['NVIDIA_API_KEY'] || process.env.NVIDIA_API_KEY
  if (nvidiaKey) {
    return base({
      key: 'nvidia',
      label: 'NVIDIA NIM',
      kind: 'openai-compatible',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey: nvidiaKey,
      models: [m['AI_MODEL'] || 'deepseek-ai/deepseek-r1'],
    })
  }
  const ollamaUrl = m['OLLAMA_URL'] || 'http://localhost:11434'
  try {
    const res = await fetch(ollamaUrl, { method: 'GET', signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      return base({
        key: 'ollama',
        label: 'Ollama (local)',
        kind: 'ollama',
        baseUrl: ollamaUrl,
        models: [m['AI_MODEL'] || 'llama3.2'],
        capabilities: ['vision'],
        options: { noAuth: true },
      })
    }
  } catch {
    /* unreachable -> next */
  }
  const anthropicKey = m['ANTHROPIC_API_KEY'] || process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    return base({
      key: 'anthropic',
      label: 'Anthropic Claude',
      kind: 'anthropic',
      apiKey: anthropicKey,
      models: [m['AI_MODEL'] || 'claude-sonnet-4-20250514'],
      capabilities: ['vision'],
    })
  }
  const geminiKey = m['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY
  if (geminiKey) {
    return base({
      key: 'gemini',
      label: 'Google Gemini',
      kind: 'gemini',
      apiKey: geminiKey,
      models: [m['AI_MODEL'] || 'gemini-2.0-flash'],
      capabilities: ['vision'],
    })
  }
  return base({
    key: 'openrouter-free',
    label: 'OpenRouter (free)',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['meta-llama/llama-3.2-3b-instruct:free'],
    capabilities: ['vision'],
    options: { noAuth: true },
  })
}

export interface AiUserContext {
  userPaid: boolean
  planKey: string | null
}

/** Is the current session's user a paying customer, per the tenant's policy (all data-driven)? */
export async function resolveAiUserContext(tenantId: string): Promise<AiUserContext> {
  try {
    const { auth } = await import('@/lib/auth')
    const { prisma } = await import('@/lib/db')
    const session = await auth()
    const userId = session?.user?.id
    if (!userId || session?.user?.tenantId !== tenantId) return { userPaid: false, planKey: null }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionPlan: true },
    })
    if (!user) return { userPaid: false, planKey: null }
    const { parseMaster } = await import('@/lib/master-config')
    void parseMaster
    const { resolveAiPolicy } = await import('./catalog')
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })
    const policy = resolveAiPolicy(((tenant?.settings ?? {}) as { aiPolicy?: never }).aiPolicy)
    let userPaid = policy.paidStatusValues.includes(user.subscriptionStatus)
    if (!userPaid && user.subscriptionPlan) {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { tenantId_key: { tenantId, key: user.subscriptionPlan } },
        select: { tier: true },
      })
      userPaid = Boolean(plan && policy.paidPlanTiers.includes(plan.tier))
    }
    return { userPaid, planKey: user.subscriptionPlan ?? null }
  } catch {
    return { userPaid: false, planKey: null }
  }
}

async function resolveEntry(
  tenantId: string,
  needsVision: boolean,
  userPaidHint?: boolean
): Promise<CatalogEntry[]> {
  const { prisma } = await import('@/lib/db')
  const { resolveAiPolicy } = await import('./catalog')
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  })
  const policy = resolveAiPolicy(((tenant?.settings ?? {}) as { aiPolicy?: never }).aiPolicy)
  const ctx =
    userPaidHint === undefined
      ? await resolveAiUserContext(tenantId)
      : { userPaid: userPaidHint, planKey: null as string | null }
  const userPaid = userPaidHint ?? ctx.userPaid

  const entries = (await listCatalog(tenantId, true)).filter(isUsable)
  let binding = null as CatalogEntry | null
  if (ctx.planKey) {
    const { getAIPlanConfig } = await import('./plan-config')
    const cfg = await getAIPlanConfig(tenantId, ctx.planKey)
    if (cfg?.enabled) binding = await getEntry(tenantId, cfg.provider)
  }
  const { rankProviderEntries, probeCatalogEntry } = await import('./catalog')
  const ranked = rankProviderEntries({ entries, policy, userPaid, needsVision, binding })
  const probed = await Promise.all(ranked.map(async e => ({ e, ok: await probeCatalogEntry(e) })))
  const live = probed.filter(x => x.ok).map(x => x.e)
  if (live.length > 0) return live

  const legacy = await legacyEntry(tenantId)
  if (!legacy) {
    throw new Error(
      needsVision && policy.gatePaidProviders && !userPaid
        ? 'No free vision-capable AI provider is configured for this platform. Add one in Settings → Providers.'
        : `No AI provider configured for tenant ${tenantId}. Add one in Settings → Providers.`
    )
  }
  if (policy.gatePaidProviders && !userPaid && legacy.cost === 'paid') {
    throw new Error(
      'Only free AI providers are available for this account. Configure a free provider in Settings → Providers.'
    )
  }
  if (needsVision && !legacy.capabilities.includes('vision')) {
    throw new Error(
      `The active AI provider "${legacy.label}" does not support vision. Add a vision-capable provider in Settings → Providers.`
    )
  }
  return [legacy]
}

/** Get the configured AI provider for the current request's tenant. */
export async function getAIProvider(opts?: {
  needsVision?: boolean
  userPaid?: boolean
}): Promise<AIProvider> {
  const tenantId = await resolveAiTenantId()
  const entries = await resolveEntry(tenantId, opts?.needsVision ?? false, opts?.userPaid)
  const { getSetting } = await import('@/lib/settings')
  const { buildProviderChain } = await import('./catalog')
  const defaultModel = await getSetting(tenantId, 'AI_DEFAULT_MODEL')
  return buildProviderChain(entries, e => ({
    model: defaultModel && e.models.includes(defaultModel) ? defaultModel : undefined,
  }))
}

/**
 * Get AI provider bound to a subscription plan (AIProviderConfig row).
 * Falls back to the tenant default when the plan has no enabled config.
 */
export async function getAIProviderForPlan(tenantId: string, plan: string): Promise<AIProvider> {
  const { getAIPlanConfig } = await import('./plan-config')
  const { getEntry } = await import('./catalog')
  const config = await getAIPlanConfig(tenantId, plan)

  if (config && config.enabled) {
    const entry = await getEntry(tenantId, config.provider)
    if (entry && isUsable(entry)) {
      return buildProviderFromEntry(entry, {
        model: config.model || undefined,
        maxTokens: config.maxTokens,
        apiKey: config.apiKey || undefined,
      })
    }
    // Catalog row deleted/mismatched: bootstrap a synthetic entry from the config
    const synthetic: CatalogEntry = {
      id: `cfg-${config.id ?? config.provider}`,
      key: config.provider,
      label: config.name,
      cost: config.provider === 'anthropic' || config.provider === 'gemini' ? 'paid' : 'free',
      kind:
        config.provider === 'anthropic' ||
        config.provider === 'gemini' ||
        config.provider === 'ollama' ||
        config.provider === 'opencode'
          ? (config.provider as CatalogEntry['kind'])
          : 'openai-compatible',
      baseUrl: config.ollamaUrl || config.baseUrl || null,
      apiKey: config.apiKey || null,
      models: [config.model],
      capabilities: ['vision'],
      options: { noAuth: config.provider === 'ollama' },
      enabled: true,
      isDefault: false,
      sortOrder: 900,
    }
    if (synthetic.kind === 'openai-compatible' && !synthetic.baseUrl) {
      synthetic.baseUrl =
        config.provider === 'openrouter'
          ? 'https://openrouter.ai/api/v1'
          : config.provider === 'nvidia'
            ? 'https://integrate.api.nvidia.com/v1'
            : config.provider === 'opencode'
              ? 'http://localhost:8080'
              : null
    }
    if ((synthetic.options.noAuth || synthetic.apiKey) && synthetic.baseUrl !== undefined) {
      return buildProviderFromEntry(synthetic, { maxTokens: config.maxTokens })
    }
  }

  return getAIProvider()
}
