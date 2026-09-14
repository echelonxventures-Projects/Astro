import { describe, expect, it } from 'vitest'
import { resolveAiPolicy, selectProviderEntry, type CatalogEntry } from '../ai/catalog'

const entry = (over: Partial<CatalogEntry>): CatalogEntry => ({
  id: over.key ?? 'x',
  key: over.key ?? 'x',
  label: over.label ?? over.key ?? 'x',
  kind: 'openai-compatible',
  cost: 'free',
  baseUrl: 'https://x.test/v1',
  apiKey: 'k',
  models: ['m1'],
  capabilities: [],
  options: {},
  enabled: true,
  isDefault: false,
  sortOrder: 50,
  ...over,
})

const paid = entry({
  key: 'anthropic',
  label: 'Anthropic',
  cost: 'paid',
  capabilities: ['vision'],
  options: { priority: 30 },
})
const free = entry({
  key: 'openrouter',
  label: 'OpenRouter',
  cost: 'free',
  options: { priority: 10 },
})
const local = entry({ key: 'ollama', label: 'Ollama', cost: 'free', options: { priority: 20 } })
const entries = [paid, free, local]
const policy = resolveAiPolicy(null)

describe('AI routing policy (free-first / paid-gated)', () => {
  it('unpaid users only ever get free-cost providers', () => {
    for (let i = 0; i < entries.length; i++) {
      const sel = selectProviderEntry({ entries, policy, userPaid: false })
      expect(sel.entry?.cost).toBe('free')
    }
  })

  it('free class wins ordering when preferFreeFirst is on', () => {
    const sel = selectProviderEntry({ entries, policy, userPaid: true })
    expect(sel.entry?.key).toBe('openrouter') // lower priority number among free
  })

  it('paid users can reach paid providers when no free is usable', () => {
    const onlyPaid = [paid]
    const sel = selectProviderEntry({ entries: onlyPaid, policy, userPaid: true })
    expect(sel.entry?.key).toBe('anthropic')
  })

  it('plan binding wins when policy allows the cost class', () => {
    const sel = selectProviderEntry({ entries, policy, userPaid: true, binding: paid })
    expect(sel.entry?.key).toBe('anthropic')
    expect(sel.reason).toBe('plan-binding')
  })

  it('paid binding is overridden by the gate for unpaid users', () => {
    const sel = selectProviderEntry({ entries, policy, userPaid: false, binding: paid })
    expect(sel.entry?.cost).toBe('free')
    expect(sel.reason).toBe('binding-blocked-by-policy')
  })

  it('gate off => unpaid users may use paid providers', () => {
    const open = resolveAiPolicy({ gatePaidProviders: false, preferFreeFirst: false })
    const sel = selectProviderEntry({ entries, policy: open, userPaid: false })
    expect(sel.entry?.key).toBe('openrouter') // isDefault none -> priority order without class bias
  })

  it('vision requests fall back to no entry rather than paid when gate is on', () => {
    const sel = selectProviderEntry({ entries, policy, userPaid: false, needsVision: true })
    expect(sel.entry).toBeNull()
    expect(sel.reason).toBe('no-free-vision-provider')
  })

  it('custom paid status values are honored from policy data', () => {
    const custom = resolveAiPolicy({ paidStatusValues: ['trial_paid'] })
    expect(custom.paidStatusValues).toContain('trial_paid')
    expect(custom.preferFreeFirst).toBe(true)
  })
})
