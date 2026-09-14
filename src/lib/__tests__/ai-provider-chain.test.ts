import { describe, expect, it } from 'vitest'
import {
  buildProviderChain,
  probeCatalogEntry,
  rankProviderEntries,
  resolveAiPolicy,
  type CatalogEntry,
} from '../ai/catalog'

const mk = (over: Partial<CatalogEntry>): CatalogEntry => ({
  id: over.key ?? 'x',
  key: over.key ?? 'x',
  label: over.label ?? over.key ?? 'x',
  kind: 'ollama',
  cost: 'free',
  baseUrl: over.baseUrl ?? 'http://127.0.0.1:9',
  apiKey: over.apiKey ?? 'k',
  models: ['m'],
  capabilities: [],
  options: over.options ?? {},
  enabled: true,
  isDefault: false,
  sortOrder: 50,
})

const policy = resolveAiPolicy(null)

describe('provider fail-over chain', () => {
  it('falls through every candidate and aggregates errors when all are down', async () => {
    const a = mk({ key: 'a', label: 'Alpha' })
    const b = mk({ key: 'b', label: 'Beta' })
    const chain = await buildProviderChain([a, b])
    await expect(chain.complete({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      /Alpha .* \| Beta/
    )
  })

  it('keeps the binding candidate first but retains fall-backs', () => {
    const free1 = mk({ key: 'ollama', options: { priority: 20 } })
    const free2 = mk({ key: 'openrouter', options: { priority: 10 } })
    const binding = mk({ key: 'bound', cost: 'paid' })
    const list = rankProviderEntries({ entries: [free1, free2], policy, userPaid: true, binding })
    expect(list[0].key).toBe('bound')
    expect(list.length).toBe(3)
    expect(list[1].key).toBe('openrouter') // priority order after binding
  })

  it('probes checkUrl entries and skips dead local servers', async () => {
    const dead = mk({
      key: 'dead',
      baseUrl: 'http://127.0.0.1:9',
      options: { checkUrl: 'http://127.0.0.1:9' },
    })
    expect(await probeCatalogEntry(dead)).toBe(false)
    const none = mk({ key: 'none', options: {} })
    expect(await probeCatalogEntry(none)).toBe(true)
  })
})
