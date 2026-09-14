'use client'

import {
  CheckCircle,
  Cpu,
  Loader2,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { BrandName } from '@/components/BrandProvider'
import { logger } from '@/lib/logger'

interface PolicyState {
  preferFreeFirst: boolean
  gatePaidProviders: boolean
  paidStatusValues: string[]
  paidPlanTiers: string[]
}

interface ProviderEntry {
  id: string
  key: string
  label: string
  kind: string
  cost: 'free' | 'paid'
  baseUrl: string | null
  apiKey: string | null
  models: string[]
  capabilities: string[]
  options: {
    extraHeaders?: Record<string, string>
    noAuth?: boolean
    checkUrl?: string
    priority?: number
  }
  enabled: boolean
  isDefault: boolean
  sortOrder: number
  usable?: boolean
}

interface PlanDef {
  key: string
  name: string
  tier: string
}

interface PlanBinding {
  plan: string
  provider: string
  model: string
  maxTokens: number
  enabled: boolean
  apiKey?: string | null
}

interface ProviderForm {
  id?: string
  key: string
  label: string
  kind: string
  cost: 'free' | 'paid'
  baseUrl: string
  apiKey: string
  models: string
  noAuth: boolean
  vision: boolean
  priority: number
  enabled: boolean
}

const EMPTY_FORM: ProviderForm = {
  key: '',
  cost: 'free',
  label: '',
  kind: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  models: '',
  noAuth: false,
  vision: false,
  priority: 25,
  enabled: true,
}

export default function SettingsClient(): React.ReactElement {
  const [tab, setTab] = useState<'plans' | 'providers' | 'default'>('plans')
  const [providers, setProviders] = useState<ProviderEntry[]>([])
  const [kinds, setKinds] = useState<string[]>([])
  const [planDefs, setPlanDefs] = useState<PlanDef[]>([])
  const [bindings, setBindings] = useState<Record<string, PlanBinding>>({})
  const [defaultKey, setDefaultKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM)
  const [policy, setPolicy] = useState<PolicyState>({
    preferFreeFirst: true,
    gatePaidProviders: true,
    paidStatusValues: ['premium'],
    paidPlanTiers: ['paid'],
  })
  const [originalPolicy, setOriginalPolicy] = useState<PolicyState>(policy)
  const [policySaving, setPolicySaving] = useState(false)
  const [policySaved, setPolicySaved] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'ok' | 'fail'>>({})

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [setRes, provRes, planRes, polRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings/providers'),
        fetch('/api/plans'),
        fetch('/api/settings/policy'),
      ])
      if (polRes.ok) {
        const pd = await polRes.json()
        setPolicy(pd.policy)
        setOriginalPolicy(pd.policy)
      }
      if (setRes.ok) {
        const d = await setRes.json()
        setDefaultKey(d.defaultKey ?? '')
        setDefaultModel(d.defaultModel ?? '')
      }
      if (provRes.ok) {
        const d = await provRes.json()
        setProviders(d.providers ?? [])
        setKinds(d.kinds ?? [])
      }
      if (planRes.ok) {
        const d = await planRes.json()
        const defs: PlanDef[] = (d.plans ?? []).map(
          (p: { key: string; name: string; tier?: string }) => ({
            key: p.key,
            name: p.name,
            tier: p.tier ?? (p.key === 'free' ? 'free' : 'paid'),
          })
        )
        setPlanDefs(defs)
        const bindRes = await fetch('/api/settings/plans')
        const map: Record<string, PlanBinding> = {}
        const existing: Array<Record<string, unknown>> = bindRes.ok ? await bindRes.json() : []
        for (const p of defs) {
          const found = existing.find((e: Record<string, unknown>) => e.plan === p.key)
          map[p.key] = found
            ? {
                plan: p.key,
                provider: String(found.provider ?? ''),
                model: String(found.model ?? ''),
                maxTokens: Number(found.maxTokens ?? 512),
                enabled: Boolean(found.enabled ?? true),
                apiKey: (found.apiKey as string | null) ?? '',
              }
            : {
                plan: p.key,
                provider:
                  d.providers && (d.providers as ProviderEntry[]).length
                    ? (d.providers as ProviderEntry[])[0].key
                    : '',
                model: '',
                maxTokens: p.tier === 'free' ? 512 : 2048,
                enabled: true,
                apiKey: '',
              }
        }
        setBindings(map)
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to load AI settings')
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const notify = (msg: string): void => {
    setFlash(msg)
    setError(null)
    setTimeout(() => setFlash(null), 3000)
  }

  const saveDefault = async (): Promise<void> => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerKey: defaultKey, model: defaultModel }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Save failed')
      else notify('Default provider saved')
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  const saveBindings = async (): Promise<void> => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.values(bindings)),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Save failed')
      else notify('Plan AI bindings saved')
    } finally {
      setSaving(false)
    }
  }

  const submitProvider = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        action: form.id ? 'update' : 'create',
        id: form.id,
        key: form.key.trim(),
        label: form.label.trim(),
        kind: form.kind,
        cost: form.cost,
        baseUrl: form.baseUrl.trim() || null,
        apiKey: form.apiKey.trim() || null,
        models: form.models
          .split(',')
          .map(m => m.trim())
          .filter(Boolean),
        capabilities: form.vision ? ['vision'] : [],
        options: { noAuth: form.noAuth, priority: form.priority },
        enabled: form.enabled,
      }
      const res = await fetch('/api/settings/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? 'Provider save failed')
        return
      }
      setForm(EMPTY_FORM)
      notify(form.id ? 'Provider updated' : 'Provider added')
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  const providerAction = async (action: string, p: ProviderEntry): Promise<void> => {
    setError(null)
    if (action === 'test') setTestingId(p.id)
    try {
      const res = await fetch('/api/settings/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: p.id }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? 'Action failed')
      } else if (action === 'test') {
        setTestResults(prev => ({ ...prev, [p.id]: d.ok ? 'ok' : 'fail' }))
        if (!d.ok) setError(`${p.label}: ${d.error}`)
      } else {
        notify(
          action === 'delete'
            ? 'Provider removed'
            : action === 'setDefault'
              ? `${p.label} is now the default`
              : 'Provider updated'
        )
        await refresh()
      }
    } finally {
      setTestingId(null)
    }
  }

  const modelsFor = (key: string): string[] => providers.find(p => p.key === key)?.models ?? []

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[var(--border)]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold gradient-text">
                <BrandName />
              </span>
            </Link>
            <Link href="/dashboard" className="text-gray-300 hover:text-white transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 gradient-text">AI Settings</h1>
          <p className="text-gray-400 mb-8">
            Every provider, model and tier binding lives in the database. No code edits needed.
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

          <div className="flex gap-2 mb-6">
            {(
              [
                ['plans', 'Plan Binding', Star],
                ['providers', 'Providers', Cpu],
                ['default', 'Default', Zap],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-xl font-semibold transition flex items-center gap-2 ${
                  tab === key
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-light)]" />
            </div>
          )}

          {/* ============ PROVIDERS TAB ============ */}
          {!loading && tab === 'providers' && (
            <div className="space-y-6">
              <div className="space-y-3">
                {providers.length === 0 && (
                  <div className="glass rounded-2xl p-6 text-gray-400">
                    No providers yet - add one below.
                  </div>
                )}
                {providers.map(p => (
                  <div
                    key={p.id}
                    className="glass rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">{p.label}</span>
                        <code className="text-xs px-2 py-0.5 rounded bg-white/10">{p.key}</code>
                        <code className="text-xs px-2 py-0.5 rounded bg-[var(--primary)]/25 text-[var(--primary-glow)]">
                          {p.kind}
                        </code>
                        {p.isDefault && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                            default
                          </span>
                        )}
                        {!p.enabled && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                            disabled
                          </span>
                        )}
                        {p.usable ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" aria-label="usable" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" aria-label="no api key" />
                        )}
                        {testResults[p.id] === 'ok' && (
                          <span className="text-xs text-emerald-300">reachable</span>
                        )}
                        {testResults[p.id] === 'fail' && (
                          <span className="text-xs text-red-300">test failed</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${p.cost === 'paid' ? 'bg-amber-400/20 text-amber-300' : 'bg-emerald-400/15 text-emerald-300'}`}
                        >
                          {p.cost.toUpperCase()}
                        </span>{' '}
                        {p.baseUrl || '(provider SDK default)'} · {p.models.length} model
                        {p.models.length === 1 ? '' : 's'}
                        {p.capabilities.includes('vision') ? ' · vision' : ''}
                        {p.options.noAuth ? ' · no auth' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!p.isDefault && (
                        <button
                          onClick={() => providerAction('setDefault', p)}
                          className="text-xs px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/10 transition"
                        >
                          Make default
                        </button>
                      )}
                      <button
                        onClick={() => providerAction('test', p)}
                        className="text-xs px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/10 transition inline-flex items-center gap-1"
                      >
                        {testingId === p.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3 h-3" />
                        )}{' '}
                        Test
                      </button>
                      <button
                        onClick={() =>
                          setForm({
                            id: p.id,
                            key: p.key,
                            label: p.label,
                            kind: p.kind,
                            cost: p.cost ?? 'free',
                            baseUrl: p.baseUrl ?? '',
                            apiKey: p.apiKey ?? '',
                            models: p.models.join(', '),
                            noAuth: Boolean(p.options.noAuth),
                            vision: p.capabilities.includes('vision'),
                            priority: p.options.priority ?? 25,
                            enabled: p.enabled,
                          })
                        }
                        className="text-xs px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/10 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => providerAction('delete', p)}
                        className="p-1.5 rounded-full border border-red-500/40 text-red-300 hover:bg-red-500/10 transition"
                        aria-label={`Delete ${p.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* add / edit form */}
              <div className="glass rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[var(--primary-light)]" />{' '}
                  {form.id ? 'Edit provider' : 'Add provider'}
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Key (used by plan bindings)
                    </label>
                    <input
                      value={form.key}
                      disabled={Boolean(form.id)}
                      onChange={e => setForm({ ...form, key: e.target.value })}
                      placeholder="openai / groq / lmstudio"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Display name</label>
                    <input
                      value={form.label}
                      onChange={e => setForm({ ...form, label: e.target.value })}
                      placeholder="OpenAI"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Cost class</label>
                    <select
                      value={form.cost}
                      onChange={e => setForm({ ...form, cost: e.target.value as 'free' | 'paid' })}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                    >
                      <option value="free">free (usable by everyone)</option>
                      <option value="paid">paid (paying customers only)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Protocol kind</label>
                    <select
                      value={form.kind}
                      onChange={e => setForm({ ...form, kind: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                    >
                      {(kinds.length ? kinds : ['openai-compatible']).map(k => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Base URL (openai-compatible / ollama / opencode)
                    </label>
                    <input
                      value={form.baseUrl}
                      onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">API key</label>
                    <input
                      type="password"
                      value={form.apiKey}
                      onChange={e => setForm({ ...form, apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Models (comma separated; first = default)
                    </label>
                    <input
                      value={form.models}
                      onChange={e => setForm({ ...form, models: e.target.value })}
                      placeholder="gpt-4o-mini, gpt-4o"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={form.noAuth}
                        onChange={e => setForm({ ...form, noAuth: e.target.checked })}
                        className="w-4 h-4"
                      />{' '}
                      No auth (local)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={form.vision}
                        onChange={e => setForm({ ...form, vision: e.target.checked })}
                        className="w-4 h-4"
                      />{' '}
                      Vision
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={e => setForm({ ...form, enabled: e.target.checked })}
                        className="w-4 h-4"
                      />{' '}
                      Enabled
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Priority (lower = preferred)
                    </label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={submitProvider}
                    disabled={saving || !form.key || !form.label}
                    className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white px-6 py-2.5 rounded-full font-semibold transition"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {form.id ? 'Update Provider' : 'Add Provider'}
                  </button>
                  {form.id && (
                    <button
                      onClick={() => setForm(EMPTY_FORM)}
                      className="px-4 py-2.5 rounded-full border border-white/15 hover:bg-white/10 text-sm transition"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============ PLANS TAB ============ */}
          {!loading && tab === 'plans' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-400">
                Bind each subscription plan (managed in{' '}
                <Link className="underline" href="/admin/plans">
                  Plans admin
                </Link>
                ) to a provider and model.
              </p>
              {planDefs.map(def => {
                const b = bindings[def.key]
                if (!b) return null
                return (
                  <div key={def.key} className="glass rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">{def.name}</h2>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={b.enabled}
                          onChange={e =>
                            setBindings({
                              ...bindings,
                              [def.key]: { ...b, enabled: e.target.checked },
                            })
                          }
                          className="w-4 h-4"
                        />
                        Active
                      </label>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Provider</label>
                        <select
                          value={b.provider}
                          onChange={e =>
                            setBindings({
                              ...bindings,
                              [def.key]: { ...b, provider: e.target.value, model: '' },
                            })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                        >
                          {providers
                            .filter(p => p.enabled)
                            .map(p => {
                              const blocked =
                                policy.gatePaidProviders &&
                                p.cost === 'paid' &&
                                def.tier != null &&
                                !policy.paidPlanTiers.includes(def.tier)
                              return (
                                <option key={p.key} value={p.key} disabled={blocked}>
                                  {p.label}
                                  {p.cost === 'paid' ? ' · paid' : ''}
                                  {blocked ? ' (policy: paid customers only)' : ''}
                                </option>
                              )
                            })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Model</label>
                        <input
                          list={`models-${def.key}`}
                          value={b.model}
                          onChange={e =>
                            setBindings({ ...bindings, [def.key]: { ...b, model: e.target.value } })
                          }
                          placeholder="(provider default)"
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                        />
                        <datalist id={`models-${def.key}`}>
                          {modelsFor(b.provider).map(m => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Max tokens</label>
                        <input
                          type="number"
                          value={b.maxTokens}
                          onChange={e =>
                            setBindings({
                              ...bindings,
                              [def.key]: { ...b, maxTokens: Number(e.target.value) },
                            })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-sm text-gray-400 mb-1">
                          API key override (optional — uses provider key when empty)
                        </label>
                        <input
                          type="password"
                          value={b.apiKey ?? ''}
                          onChange={e =>
                            setBindings({
                              ...bindings,
                              [def.key]: { ...b, apiKey: e.target.value },
                            })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              <button
                onClick={saveBindings}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white px-6 py-3 rounded-full font-semibold transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}{' '}
                Save Plan Bindings
              </button>
            </div>
          )}

          {/* ============ DEFAULT TAB ============ */}
          {!loading && tab === 'default' && (
            <div className="glass rounded-2xl p-6 space-y-4 max-w-xl">
              <p className="text-sm text-gray-400">
                Fallback provider used whenever a plan binding is inactive.
              </p>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Provider</label>
                <select
                  value={defaultKey}
                  onChange={e => {
                    setDefaultKey(e.target.value)
                    setDefaultModel('')
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                >
                  <option value="">(auto: lowest priority usable)</option>
                  {providers
                    .filter(p => p.enabled)
                    .map(p => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Default model</label>
                <input
                  list="default-models"
                  value={defaultModel}
                  onChange={e => setDefaultModel(e.target.value)}
                  placeholder="(first model of the provider)"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                />
                <datalist id="default-models">
                  {modelsFor(defaultKey).map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h3 className="font-bold mb-3">Routing policy (per platform)</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Stored on this platform - nothing is hardcoded. The paid gate applies at runtime
                  and at binding-save.
                </p>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <input
                    type="checkbox"
                    checked={policy.preferFreeFirst}
                    onChange={e => setPolicy({ ...policy, preferFreeFirst: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Prefer FREE providers first (everyone, incl. paid customers, unless a paid plan is
                  bound explicitly)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-3">
                  <input
                    type="checkbox"
                    checked={policy.gatePaidProviders}
                    onChange={e => setPolicy({ ...policy, gatePaidProviders: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Restrict paid-cost providers to paying customers only
                </label>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <input
                    value={policy.paidStatusValues.join(', ')}
                    onChange={e =>
                      setPolicy({
                        ...policy,
                        paidStatusValues: e.target.value
                          .split(',')
                          .map(x => x.trim())
                          .filter(Boolean),
                      })
                    }
                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[var(--primary)]"
                    placeholder="statuses treated as paid (e.g. premium)"
                  />
                  <input
                    value={policy.paidPlanTiers.join(', ')}
                    onChange={e =>
                      setPolicy({
                        ...policy,
                        paidPlanTiers: e.target.value
                          .split(',')
                          .map(x => x.trim())
                          .filter(Boolean),
                      })
                    }
                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[var(--primary)]"
                    placeholder="plan tiers treated as paid (e.g. paid)"
                  />
                </div>
                <button
                  onClick={async () => {
                    setPolicySaving(true)
                    try {
                      const res = await fetch('/api/settings/policy', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ policy }),
                      })
                      const d = await res.json()
                      if (res.ok) {
                        setOriginalPolicy(d.policy ?? policy)
                        setPolicySaved(true)
                        setTimeout(() => setPolicySaved(false), 2500)
                      } else {
                        setError(d.error ?? 'Could not save policy')
                      }
                    } finally {
                      setPolicySaving(false)
                    }
                  }}
                  disabled={
                    policySaving || JSON.stringify(policy) === JSON.stringify(originalPolicy)
                  }
                  className="mt-4 inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-40 text-white px-5 py-2 rounded-full font-semibold transition"
                >
                  {policySaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}{' '}
                  Save policy
                  {policySaved && <span className="text-emerald-300">saved</span>}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveDefault}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white px-6 py-3 rounded-full font-semibold transition"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Settings className="w-5 h-5" />
                  )}{' '}
                  Save Default
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
