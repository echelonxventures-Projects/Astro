/**
 * Master configuration hierarchy.
 *
 * Platforms form a tree: a root ("super") platform grants options and rights to
 * its child platforms; children can grant (a subset of) that to their own
 * children. A platform's EFFECTIVE master is the intersection down the ancestor
 * chain - a sub-platform can never exceed what its parent was allowed.
 */

import { SUPPORTED_LANGUAGES } from './i18n'
import type { TenantSettings } from './tenant'
import { DEFAULT_REGION_TEMPLATE } from './tenant-defaults'
import { prisma } from '@/lib/db'

export const GATEWAY_KEYS = ['stripe', 'razorpay', 'paypal'] as const
export const AI_PROVIDER_KEYS = [
  'openrouter',
  'nvidia',
  'ollama',
  'anthropic',
  'gemini',
  'opencode',
] as const

export interface MasterChildDefaults {
  language?: string
  region?: string
  aiProvider?: string
}

export interface MasterConfig {
  allowedLanguages?: string[]
  allowedRegions?: string[]
  allowedGateways?: string[]
  allowedAiProviders?: string[]
  canCreateChildren?: boolean
  maxChildren?: number | null
  childDefaults?: MasterChildDefaults
}

export interface EffectiveMaster {
  allowedLanguages: string[]
  allowedRegions: string[]
  allowedGateways: string[]
  allowedAiProviders: string[]
  canCreateChildren: boolean
  maxChildren: number | null
  childDefaults: Required<MasterChildDefaults>
}

const ALL_LANGS = SUPPORTED_LANGUAGES.map(l => l.code)
const ALL_REGIONS = DEFAULT_REGION_TEMPLATE.map(r => r.key)

export const ROOT_EFFECTIVE: EffectiveMaster = {
  allowedLanguages: ALL_LANGS,
  allowedRegions: ALL_REGIONS,
  allowedGateways: [...GATEWAY_KEYS],
  allowedAiProviders: [...AI_PROVIDER_KEYS],
  canCreateChildren: true,
  maxChildren: null,
  childDefaults: { language: 'en', region: 'us', aiProvider: 'openrouter' },
}

export function parseMaster(settings: TenantSettings | null | undefined): MasterConfig | null {
  const m = settings?.master
  return m && typeof m === 'object' ? (m as MasterConfig) : null
}

function intersect(allowed: string[] | undefined, parentAllowed: string[]): string[] {
  if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return parentAllowed
  const set = new Set(allowed)
  const result = parentAllowed.filter(x => set.has(x))
  // a grant referencing nothing valid falls back to parent's full set
  return result.length > 0 ? result : parentAllowed
}

const TENANT_SELECT = {
  id: true,
  parentId: true,
  settings: true,
} as const

/** Walk the parent chain and compute the platform's effective options + rights. */
export async function effectiveMaster(tenantId: string, depth = 0): Promise<EffectiveMaster> {
  if (depth > 10) return ROOT_EFFECTIVE // hard cycle guard
  const row = await prisma.tenant.findUnique({ where: { id: tenantId }, select: TENANT_SELECT })
  if (!row) return ROOT_EFFECTIVE

  const parent = row.parentId ? await effectiveMaster(row.parentId, depth + 1) : ROOT_EFFECTIVE
  const own = parseMaster(row.settings as TenantSettings | null)

  const cd = { ...parent.childDefaults, ...(own?.childDefaults ?? {}) }
  const validLang = (c: string | undefined): string =>
    c && parent.allowedLanguages.includes(c) ? c : parent.childDefaults.language
  const validRegion = (c: string | undefined): string =>
    c && parent.allowedRegions.includes(c) ? c : parent.childDefaults.region
  const validAi = (c: string | undefined): string =>
    c && parent.allowedAiProviders.includes(c) ? c : parent.childDefaults.aiProvider

  return {
    allowedLanguages: intersect(own?.allowedLanguages, parent.allowedLanguages),
    allowedRegions: intersect(own?.allowedRegions, parent.allowedRegions),
    allowedGateways: intersect(own?.allowedGateways, parent.allowedGateways),
    allowedAiProviders: intersect(own?.allowedAiProviders, parent.allowedAiProviders),
    // rights only ever shrink down the tree
    canCreateChildren: (own?.canCreateChildren ?? true) && parent.canCreateChildren,
    maxChildren: Math.min(own?.maxChildren ?? Infinity, parent.maxChildren ?? Infinity) as
      | number
      | null,
    childDefaults: {
      language: validLang(cd.language),
      region: validRegion(cd.region),
      aiProvider: validAi(cd.aiProvider),
    },
  }
}

/** Clamp a requested child-grant set to what the granting platform itself may give. */
export function clampGrants(
  requested: MasterConfig | undefined,
  eff: EffectiveMaster
): MasterConfig {
  return {
    allowedLanguages: requested?.allowedLanguages?.length
      ? eff.allowedLanguages.filter(l => requested.allowedLanguages!.includes(l))
      : eff.allowedLanguages,
    allowedRegions: requested?.allowedRegions?.length
      ? eff.allowedRegions.filter(r => requested.allowedRegions!.includes(r))
      : eff.allowedRegions,
    allowedGateways: requested?.allowedGateways?.length
      ? eff.allowedGateways.filter(g => requested.allowedGateways!.includes(g))
      : eff.allowedGateways,
    allowedAiProviders: requested?.allowedAiProviders?.length
      ? eff.allowedAiProviders.filter(a => requested.allowedAiProviders!.includes(a))
      : eff.allowedAiProviders,
    canCreateChildren:
      Boolean(requested?.canCreateChildren ?? eff.canCreateChildren) && eff.canCreateChildren,
    maxChildren: Math.min(requested?.maxChildren ?? Infinity, eff.maxChildren ?? Infinity),
    childDefaults: requested?.childDefaults ?? eff.childDefaults,
  }
}

/** Validate a provisioning request against a platform's effective master. Returns list of violations. */
export function validateAgainstMaster(
  eff: EffectiveMaster,
  req: {
    languages?: string[]
    defaultLanguage?: string
    regions?: string[]
    gateways?: string[]
    aiDefault?: string
  }
): string[] {
  const errors: string[] = []
  for (const l of req.languages ?? []) {
    if (!eff.allowedLanguages.includes(l))
      errors.push(
        `Language "${l}" is not in this platform's allowed set (${eff.allowedLanguages.join(', ')})`
      )
  }
  if (req.defaultLanguage && !eff.allowedLanguages.includes(req.defaultLanguage)) {
    errors.push('Default language must be one of the allowed languages')
  }
  for (const r of req.regions ?? []) {
    if (!eff.allowedRegions.includes(r))
      errors.push(
        `Region "${r}" is not in this platform's allowed markets (${eff.allowedRegions.join(', ')})`
      )
  }
  for (const g of req.gateways ?? []) {
    if (!eff.allowedGateways.includes(g))
      errors.push(
        `Payment gateway "${g}" is not permitted by the parent platform (${eff.allowedGateways.join(', ')})`
      )
  }
  if (req.aiDefault && !eff.allowedAiProviders.includes(req.aiDefault)) {
    errors.push(
      `AI provider "${req.aiDefault}" is not permitted (${eff.allowedAiProviders.join(', ')})`
    )
  }
  return errors
}

/** All descendants of a tenant (bounded). */
export async function descendantIds(tenantId: string): Promise<string[]> {
  const out: string[] = []
  const frontier = [tenantId]
  while (frontier.length) {
    const id = frontier.pop()!
    const kids = await prisma.tenant.findMany({ where: { parentId: id }, select: { id: true } })
    for (const k of kids) {
      out.push(k.id)
      frontier.push(k.id)
    }
    if (out.length > 500) break
  }
  return out
}
