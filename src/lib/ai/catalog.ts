/**
 * AI Provider Catalog (per tenant, DB-driven)
 *
 * The single source of truth for which AI providers/models a tenant offers.
 * Kinds are wire protocols implemented once in code:
 *   openai-compatible | ollama | anthropic | gemini | opencode
 * Any vendor speaking one of those protocols (OpenAI, Groq, Together, DeepSeek,
 * LM Studio, ...) is added through the admin UI with zero code changes.
 */

import { Prisma } from '@prisma/client'
import { OpenAICompatibleProvider } from './openai-compatible-provider'
import type { AIProvider, AIProviderConfig } from './provider'
import { prisma } from '@/lib/db'

export const PROVIDER_KINDS = [
  'openai-compatible',
  'ollama',
  'anthropic',
  'gemini',
  'opencode',
] as const
export type ProviderKind = (typeof PROVIDER_KINDS)[number]

export function isProviderKind(value: unknown): value is ProviderKind {
  return typeof value === 'string' && (PROVIDER_KINDS as readonly string[]).includes(value)
}

export interface CatalogOptions {
  extraHeaders?: Record<string, string>
  noAuth?: boolean
  checkUrl?: string
  priority?: number
}

export interface CatalogEntry {
  id: string
  key: string
  label: string
  kind: ProviderKind
  cost: 'free' | 'paid'
  baseUrl: string | null
  apiKey: string | null
  models: string[]
  capabilities: string[]
  options: CatalogOptions
  enabled: boolean
  isDefault: boolean
  sortOrder: number
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCatalogEntry(row: any): CatalogEntry {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    kind: isProviderKind(row.kind) ? row.kind : 'openai-compatible',
    cost: row.cost === 'paid' ? 'paid' : 'free',
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    models: parseJson<string[]>(row.models, []),
    capabilities: parseJson<string[]>(row.capabilities, []),
    options: parseJson<CatalogOptions>(row.options, {}),
    enabled: row.enabled,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
  }
}

export interface AiPolicy {
  preferFreeFirst: boolean
  gatePaidProviders: boolean
  paidStatusValues: string[]
  paidPlanTiers: string[]
}

export const DEFAULT_AI_POLICY: AiPolicy = {
  preferFreeFirst: true,
  gatePaidProviders: true,
  paidStatusValues: ['premium'],
  paidPlanTiers: ['paid'],
}

export function resolveAiPolicy(raw: Partial<AiPolicy> | null | undefined): AiPolicy {
  return {
    preferFreeFirst: raw?.preferFreeFirst ?? DEFAULT_AI_POLICY.preferFreeFirst,
    gatePaidProviders: raw?.gatePaidProviders ?? DEFAULT_AI_POLICY.gatePaidProviders,
    paidStatusValues: raw?.paidStatusValues?.length
      ? raw.paidStatusValues
      : [...DEFAULT_AI_POLICY.paidStatusValues],
    paidPlanTiers: raw?.paidPlanTiers?.length
      ? raw.paidPlanTiers
      : [...DEFAULT_AI_POLICY.paidPlanTiers],
  }
}

export interface SelectionInput {
  entries: CatalogEntry[] // enabled + usable, in catalog order
  policy: AiPolicy
  userPaid: boolean
  needsVision?: boolean
  binding?: CatalogEntry | null // plan-bound provider (from AIProviderConfig)
}

export interface SelectionResult {
  entry: CatalogEntry | null
  reason: string
}

/**
 * Pure routing policy:
 *  - plan binding wins when the cost gate allows it
 *  - unpaid users: free-cost providers only (unless gate disabled)
 *  - preferFreeFirst: among candidates, free cost class before paid
 *  - within a class: explicit isDefault, then options.priority/sortOrder
 */
export function selectProviderEntry({
  entries,
  policy,
  userPaid,
  needsVision = false,
  binding,
}: SelectionInput): SelectionResult {
  const visionOk = (e: CatalogEntry) => !needsVision || e.capabilities.includes('vision')
  const gatedPaidAllowed = !policy.gatePaidProviders || userPaid

  if (binding && visionOk(binding) && (gatedPaidAllowed || binding.cost === 'free')) {
    return { entry: binding, reason: 'plan-binding' }
  }

  let pool = entries.filter(visionOk)
  if (policy.gatePaidProviders && !userPaid) {
    pool = pool.filter(e => e.cost === 'free')
  }
  if (pool.length === 0) {
    return {
      entry: null,
      reason:
        policy.gatePaidProviders && !userPaid && needsVision
          ? 'no-free-vision-provider'
          : 'no-usable-provider',
    }
  }
  const rank = (e: CatalogEntry): number => e.options.priority ?? e.sortOrder + 100
  const byClass = (e: CatalogEntry): number => (policy.preferFreeFirst && e.cost === 'free' ? 0 : 1)
  pool = [...pool].sort((a, b) => {
    const cls = byClass(a) - byClass(b)
    if (cls !== 0) return cls
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return rank(a) - rank(b)
  })
  const paidUserFreePick = userPaid && policy.preferFreeFirst && pool[0].cost === 'free'
  return {
    entry: pool[0],
    reason: binding
      ? 'binding-blocked-by-policy'
      : paidUserFreePick
        ? 'prefer-free-first'
        : 'policy-priority',
  }
}

export function isUsable(e: CatalogEntry): boolean {
  if (!e.enabled) return false
  if (e.options.noAuth) return true
  return Boolean(e.apiKey && e.apiKey.trim().length > 0)
}

export async function listCatalog(tenantId: string, enabledOnly = false): Promise<CatalogEntry[]> {
  const rows = await prisma.aIProviderCatalog.findMany({
    where: { tenantId, ...(enabledOnly ? { enabled: true } : {}) },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { label: 'asc' }],
  })
  return rows.map(parseCatalogEntry)
}

export async function getEntry(tenantId: string, key: string): Promise<CatalogEntry | null> {
  const row = await prisma.aIProviderCatalog.findUnique({
    where: { tenantId_key: { tenantId, key } },
  })
  return row ? parseCatalogEntry(row) : null
}

/** Pick the tenant's active provider: explicit default first, then priority order. */
export async function getDefaultEntry(
  tenantId: string,
  needsVision = false
): Promise<CatalogEntry | null> {
  const entries = (await listCatalog(tenantId, true)).filter(isUsable)
  const capable = needsVision ? entries.filter(e => e.capabilities.includes('vision')) : entries
  if (capable.length === 0) return null
  const explicit = capable.find(e => e.isDefault)
  if (explicit) return explicit
  return [...capable].sort(
    (a, b) => (a.options.priority ?? a.sortOrder + 100) - (b.options.priority ?? b.sortOrder + 100)
  )[0]
}

/** Build a live AIProvider implementation from a catalog entry. */
export async function buildProviderFromEntry(
  e: CatalogEntry,
  overrides?: { model?: string; maxTokens?: number; apiKey?: string | null }
): Promise<AIProvider> {
  const apiKey = overrides?.apiKey ?? e.apiKey ?? ''
  const model = overrides?.model || e.models[0] || ''
  const maxTokens = overrides?.maxTokens ?? 1024

  const { OllamaProvider } = await import('./ollama-provider')
  const { AnthropicProvider } = await import('./anthropic-provider')
  const { GeminiProvider } = await import('./gemini-provider')
  const { OpenCodeProvider } = await import('./opencode-provider')

  const legacyConfig: AIProviderConfig = {
    provider: e.kind,
    apiKey: apiKey || undefined,
    ollamaUrl: e.baseUrl || undefined,
    baseUrl: e.baseUrl || undefined,
    model: model || undefined,
    maxTokens,
  }

  switch (e.kind) {
    case 'ollama':
      return new OllamaProvider(legacyConfig)
    case 'anthropic':
      return new AnthropicProvider(legacyConfig)
    case 'gemini':
      return new GeminiProvider(legacyConfig)
    case 'opencode':
      return new OpenCodeProvider(legacyConfig)
    case 'openai-compatible':
    default: {
      if (!e.baseUrl) throw new Error(`Provider "${e.key}" (openai-compatible) requires a baseUrl`)
      return new OpenAICompatibleProvider({
        name: e.label,
        baseUrl: e.baseUrl,
        apiKey: apiKey || undefined,
        model,
        maxTokens,
        extraHeaders: e.options.extraHeaders,
        supportsVision: e.capabilities.includes('vision'),
      })
    }
  }
}

export interface CatalogInput {
  key: string
  label: string
  kind: string
  cost?: 'free' | 'paid'
  baseUrl?: string | null
  apiKey?: string | null
  models?: string[]
  capabilities?: string[]
  options?: CatalogOptions
  enabled?: boolean
  isDefault?: boolean
  sortOrder?: number
}

export function toCatalogData(
  tenantId: string,
  input: CatalogInput
): Prisma.AIProviderCatalogUncheckedCreateInput {
  return {
    tenantId,
    key: input.key,
    label: input.label,
    kind: isProviderKind(input.kind) ? input.kind : 'openai-compatible',
    cost: input.cost === 'paid' ? 'paid' : 'free',
    baseUrl: input.baseUrl ?? null,
    apiKey: input.apiKey ?? null,
    models: JSON.stringify(input.models ?? []),
    capabilities: JSON.stringify(input.capabilities ?? []),
    options: JSON.stringify(input.options ?? {}),
    enabled: input.enabled ?? true,
    isDefault: input.isDefault ?? false,
    sortOrder: input.sortOrder ?? 0,
  }
}

/**
 * Bootstrap rows for a brand-new tenant. These are starting points ONLY -
 * everything lives in the DB afterwards and is editable in the admin UI.
 * Values come from environment keys when present.
 */
export async function ensureDefaultCatalog(tenantId: string, tenantName: string): Promise<void> {
  const defaults: CatalogInput[] = [
    {
      key: 'openrouter',
      label: 'OpenRouter',
      kind: 'openai-compatible',
      cost: 'free' as const,
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || null,
      models: ['meta-llama/llama-3.2-3b-instruct:free', 'google/gemma-3-1b-it:free'],
      capabilities: ['vision'],
      options: {
        extraHeaders: {
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': tenantName,
        },
        priority: 10,
      },
    },
    {
      key: 'nvidia',
      label: 'NVIDIA NIM',
      kind: 'openai-compatible',
      cost: 'free' as const,
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey: process.env.NVIDIA_API_KEY || null,
      models: ['meta/llama-3.1-8b-instruct'],
      capabilities: [],
      options: { priority: 15 },
    },
    {
      key: 'ollama',
      label: 'Ollama (local)',
      kind: 'ollama',
      cost: 'free' as const,
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      models: ['llama3.2'],
      capabilities: ['vision'],
      options: {
        noAuth: true,
        checkUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        priority: 20,
      },
    },
    {
      key: 'anthropic',
      label: 'Anthropic Claude',
      kind: 'anthropic',
      cost: 'paid' as const,
      apiKey: process.env.ANTHROPIC_API_KEY || null,
      models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'],
      capabilities: ['vision'],
      options: { priority: 30 },
    },
    {
      key: 'gemini',
      label: 'Google Gemini',
      kind: 'gemini',
      cost: 'paid' as const,
      apiKey: process.env.GEMINI_API_KEY || null,
      models: ['gemini-2.0-flash'],
      capabilities: ['vision'],
      options: { priority: 40 },
    },
    {
      key: 'opencode',
      label: 'OpenCode (local)',
      kind: 'opencode',
      cost: 'free' as const,
      baseUrl: process.env.OPENCODE_URL || 'http://localhost:8080',
      models: ['claude-sonnet-4'],
      capabilities: [],
      options: { noAuth: true, priority: 50 },
    },
  ]

  for (const input of defaults) {
    await prisma.aIProviderCatalog.upsert({
      where: { tenantId_key: { tenantId, key: input.key } },
      update: {},
      create: toCatalogData(tenantId, input),
    })
  }
}
