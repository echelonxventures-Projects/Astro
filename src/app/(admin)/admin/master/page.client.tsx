'use client'

import { Check, Loader2, Network, Save, ShieldCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import AdminHeader from '@/components/layout/AdminHeader'
import { logger } from '@/lib/logger'

interface MasterGrants {
  allowedLanguages?: string[]
  allowedRegions?: string[]
  allowedGateways?: string[]
  allowedAiProviders?: string[]
  canCreateChildren?: boolean
  maxChildren?: number | null
  childDefaults?: { language?: string; region?: string; aiProvider?: string }
}

interface Node {
  id: string
  slug: string
  name: string
  parentId: string | null
  master: MasterGrants | null
  children?: Node[]
}

interface Catalog {
  languages: Array<{ code: string; name: string }>
  regions: Array<{ key: string; name: string; currency: string }>
  gateways: string[]
  aiProviders: string[]
}

interface Effective {
  allowedLanguages: string[]
  allowedRegions: string[]
  allowedGateways: string[]
  allowedAiProviders: string[]
  canCreateChildren: boolean
  maxChildren: number | null
}

interface MasterData {
  isSuper: boolean
  scope: string
  self: { id: string; slug: string; name: string; parentId: string | null } | null
  effective: Effective
  canEdit: boolean
  tree: Node[]
  catalog: Catalog
}

function flatten(nodes: Node[], depth = 0): Array<{ node: Node; depth: number }> {
  const out: Array<{ node: Node; depth: number }> = []
  for (const n of nodes) {
    out.push({ node: n, depth })
    if (n.children?.length) out.push(...flatten(n.children, depth + 1))
  }
  return out
}

export default function MasterConfigClient(): React.ReactElement {
  const [data, setData] = useState<MasterData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [grants, setGrants] = useState<MasterGrants | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/master-config')
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? 'Failed to load')
      } else {
        setData(d)
        if (!selectedId && d.self) setSelectedId(d.self.id)
      }
    } catch (err) {
      logger.error({ err }, 'master-config load failed')
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load grants into the editor whenever the selected node changes
  useEffect(() => {
    if (!data || !selectedId) return
    const found = flatten(data.tree).find(x => x.node.id === selectedId)
    if (!found) return
    setGrants({
      allowedLanguages: found.node.master?.allowedLanguages ?? [],
      allowedRegions: found.node.master?.allowedRegions ?? [],
      allowedGateways: found.node.master?.allowedGateways ?? [],
      allowedAiProviders: found.node.master?.allowedAiProviders ?? [],
      canCreateChildren: found.node.master?.canCreateChildren ?? false,
      maxChildren: found.node.master?.maxChildren ?? null,
      childDefaults: found.node.master?.childDefaults ?? {},
    })
  }, [data, selectedId])

  const canEditSelected = (): boolean => {
    if (!data || !selectedId) return false
    if (data.isSuper) return true
    return data.self?.id === selectedId && data.effective.canCreateChildren
  }

  const toggle = (
    field: 'allowedLanguages' | 'allowedRegions' | 'allowedGateways' | 'allowedAiProviders',
    value: string
  ): void => {
    setGrants(g => {
      if (!g) return g
      const cur = g[field] ?? []
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
      return { ...g, [field]: next }
    })
  }

  const save = async (): Promise<void> => {
    if (!selectedId || !grants) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/master-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedId, grants }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Save failed')
      else {
        setFlash('Grants saved. Sub-platform options update instantly.')
        setTimeout(() => setFlash(null), 3000)
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex justify-center">
        <AdminHeader active="master" />
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-light)]" />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="min-h-screen pt-24 px-4">
        <AdminHeader active="master" />
        <div className="max-w-3xl mx-auto p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
          {error ?? 'Unavailable'}
        </div>
      </div>
    )
  }

  const rows = flatten(data.tree)
  const editable = canEditSelected()
  const empty = (a?: string[]) => !a || a.length === 0

  const OptionGroup = ({
    title,
    options,
    field,
  }: {
    title: string
    options: Array<{ value: string; label: string }>
    field: 'allowedLanguages' | 'allowedRegions' | 'allowedGateways' | 'allowedAiProviders'
  }) => (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        <span className="text-xs text-gray-500">
          {empty(grants?.[field]) ? 'inherit all' : `${grants![field]!.length} selected`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = (grants?.[field] ?? []).includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              disabled={!editable}
              onClick={() => toggle(field, o.value)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs transition disabled:opacity-50 ${
                on
                  ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-white'
                  : 'border-white/10 text-gray-400 hover:border-white/25'
              }`}
            >
              {on && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <AdminHeader active="master" />
      <main className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-3">
          <Network className="w-7 h-7 text-[var(--primary-light)]" /> Master Configuration
        </h1>
        <p className="text-gray-400 mb-6">
          The platform tree below grants options and rights to each sub-platform. A child can never
          exceed what its parent allows.
        </p>

        {flash && (
          <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-200">
            {flash}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
            {error}
          </div>
        )}

        {/* My effective rights */}
        <div className="glass rounded-2xl p-5 border border-[var(--border)]/30 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--primary-light)]" /> Your platform&apos;s
              effective options ({data.self?.name})
            </h2>
            <span className="text-xs text-gray-500">
              {data.scope === 'root' ? 'root / super platform' : 'sub-platform (parent-capped)'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Languages</span>
              <div className="text-white">{data.effective.allowedLanguages.join(', ')}</div>
            </div>
            <div>
              <span className="text-gray-500">Markets</span>
              <div className="text-white">{data.effective.allowedRegions.join(', ')}</div>
            </div>
            <div>
              <span className="text-gray-500">Gateways</span>
              <div className="text-white">{data.effective.allowedGateways.join(', ')}</div>
            </div>
            <div>
              <span className="text-gray-500">Can create sub-platforms</span>
              <div className="text-white">
                {data.effective.canCreateChildren
                  ? `Yes${data.effective.maxChildren ? ` (max ${data.effective.maxChildren})` : ''}`
                  : 'No'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Tree */}
          <div className="glass rounded-2xl p-4 border border-white/10 h-max">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--primary-light)]" /> Platforms
            </h2>
            <div className="space-y-1">
              {rows.map(({ node, depth }) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedId(node.id)}
                  style={{ paddingLeft: `${8 + depth * 14}px` }}
                  className={`w-full text-left rounded-lg px-2 py-2 text-sm transition ${selectedId === node.id ? 'bg-[var(--primary)]/20 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                >
                  <span className="font-medium">{node.name}</span>
                  <span className="block text-[11px] text-gray-500">
                    {node.slug}
                    {node.master?.canCreateChildren ? ' · can delegate' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="glass rounded-2xl p-6 border border-[var(--border)]/30">
            <h2 className="text-lg font-bold mb-1">
              Grants for {rows.find(r => r.node.id === selectedId)?.node.name}
            </h2>
            <p className="text-sm text-gray-400 mb-5">
              {editable
                ? 'Leave a set empty to inherit all the options you are allowed to grant.'
                : 'Read-only - only this platform&apos;s parent (or the super admin) can change these.'}
            </p>

            <OptionGroup
              title="Languages"
              field="allowedLanguages"
              options={data.catalog.languages
                .filter(l => data.isSuper || data.effective.allowedLanguages.includes(l.code))
                .map(l => ({ value: l.code, label: `${l.name} (${l.code})` }))}
            />
            <OptionGroup
              title="Markets / currency"
              field="allowedRegions"
              options={data.catalog.regions
                .filter(r => data.isSuper || data.effective.allowedRegions.includes(r.key))
                .map(r => ({ value: r.key, label: `${r.name} · ${r.currency}` }))}
            />
            <OptionGroup
              title="Payment gateways"
              field="allowedGateways"
              options={data.catalog.gateways
                .filter(g => data.isSuper || data.effective.allowedGateways.includes(g))
                .map(g => ({ value: g, label: g }))}
            />
            <OptionGroup
              title="AI providers"
              field="allowedAiProviders"
              options={data.catalog.aiProviders
                .filter(a => data.isSuper || data.effective.allowedAiProviders.includes(a))
                .map(a => ({ value: a, label: a }))}
            />

            <div className="grid md:grid-cols-2 gap-4 mb-5">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={Boolean(grants?.canCreateChildren)}
                  onChange={e =>
                    setGrants(g => (g ? { ...g, canCreateChildren: e.target.checked } : g))
                  }
                  className="w-4 h-4"
                />
                May create its own sub-platforms
              </label>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Max sub-platforms (blank = unlimited)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!editable}
                  value={grants?.maxChildren ?? ''}
                  onChange={e =>
                    setGrants(g =>
                      g
                        ? {
                            ...g,
                            maxChildren: e.target.value === '' ? null : Number(e.target.value),
                          }
                        : g
                    )
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {(['language', 'region', 'aiProvider'] as const).map(key => {
                const field =
                  key === 'language'
                    ? 'allowedLanguages'
                    : key === 'region'
                      ? 'allowedRegions'
                      : 'allowedAiProviders'
                const opts = grants?.[field]?.length ? grants![field]! : []
                return (
                  <div key={key}>
                    <label className="block text-sm text-gray-400 mb-1">Default {key}</label>
                    <select
                      disabled={!editable}
                      value={grants?.childDefaults?.[key] ?? ''}
                      onChange={e =>
                        setGrants(g =>
                          g
                            ? { ...g, childDefaults: { ...g.childDefaults, [key]: e.target.value } }
                            : g
                        )
                      }
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[var(--primary)] outline-none disabled:opacity-50"
                    >
                      <option value="">(none)</option>
                      {opts.map(o => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>

            <button
              onClick={save}
              disabled={saving || !editable}
              className="mt-6 inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-40 text-white px-6 py-3 rounded-full font-semibold transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{' '}
              Save grants
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
