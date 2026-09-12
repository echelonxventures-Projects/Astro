'use client'

import { Cog, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import AdminHeader from '@/components/layout/AdminHeader'
import { logger } from '@/lib/logger'

interface TenantDomainRow {
  host: string
  isPrimary: boolean
}

interface TenantRow {
  id: string
  slug: string
  name: string
  status: string
  isDefault: boolean
  domains: TenantDomainRow[]
  _count: { users: number }
}

const PRESETS = [
  { label: 'Purple & Silver', primary: '#7C3AED' },
  { label: 'Teal & Gold', primary: '#14B8A6' },
  { label: 'Rose Night', primary: '#E11D48' },
  { label: 'Ocean', primary: '#2563EB' },
  { label: 'Forest', primary: '#16A34A' },
]

export default function TenantsClient(): React.ReactElement {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [configFor, setConfigFor] = useState<TenantRow | null>(null)
  const [configJson, setConfigJson] = useState({ branding: '', settings: '' })
  const [configSaving, setConfigSaving] = useState(false)

  const openConfig = (t: TenantRow): void => {
    setConfigFor(t)
    setConfigJson({
      branding: JSON.stringify(
        {
          name: t.name,
          tagline: 'Navigate Your Cosmic Journey',
          colors: { primary: '#7C3AED' },
        },
        null,
        2
      ),
      settings: JSON.stringify({ oauth: {}, emailFrom: '', features: {} }, null, 2),
    })
  }

  const saveConfig = async (): Promise<void> => {
    if (!configFor) return
    let branding: unknown = undefined
    let settings: unknown = undefined
    try {
      branding = configJson.branding.trim() ? JSON.parse(configJson.branding) : undefined
      settings = configJson.settings.trim() ? JSON.parse(configJson.settings) : undefined
    } catch {
      setError('Invalid JSON in branding/settings')
      return
    }
    setConfigSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/tenants/${configFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding, settings }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save config')
        return
      }
      setConfigFor(null)
      setNotice(`Updated config for ${configFor.name}`)
    } finally {
      setConfigSaving(false)
    }
  }

  const [form, setForm] = useState({
    name: '',
    slug: '',
    domains: '',
    primary: PRESETS[0].primary,
  })

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tenants')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load tenants')
      } else {
        setTenants(data.tenants)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to load tenants')
      setError('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createTenant = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          domains: form.domains
            .split(',')
            .map(d => d.trim())
            .filter(Boolean),
          branding: {
            name: form.name,
            shortName: form.slug,
            colors: {
              primary: form.primary,
            },
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create tenant')
      } else {
        setNotice(
          `Tenant "${data.tenant.name}" created at ${data.tenant.domains[0]?.host ?? form.slug + '.localhost'}`
        )
        setForm({ name: '', slug: '', domains: '', primary: PRESETS[0].primary })
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (t: TenantRow, status: string): Promise<void> => {
    setError(null)
    const res = await fetch(`/api/admin/tenants/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to update tenant')
    }
    await load()
  }

  const remove = async (t: TenantRow): Promise<void> => {
    if (!confirm(`Delete tenant "${t.name}"? This cannot be undone.`)) return
    setError(null)
    const res = await fetch(`/api/admin/tenants/${t.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to delete tenant')
      return
    }
    await load()
  }

  const tenantUrl = (t: TenantRow): string => {
    const host = t.domains.find(d => d.isPrimary)?.host ?? `${t.slug}.localhost`
    const port = typeof window !== 'undefined' ? window.location.port : '3001'
    return `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${host}${port ? `:${port}` : ''}`
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <AdminHeader active="tenants" />
      <main className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold gradient-text mb-2">Tenants</h1>
        <p className="text-gray-400 mb-8">
          Each tenant is an independent white-label platform served by this deployment.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-200">
            {notice}
          </div>
        )}

        {/* Create form */}
        <div className="glass rounded-3xl p-6 border border-[var(--border)]/30 mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[var(--primary-light)]" /> New Tenant
          </h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Platform name</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="LunaAstro"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Slug (subdomain)</label>
              <input
                value={form.slug}
                onChange={e =>
                  setForm({
                    ...form,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                }
                placeholder="luna"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">
                Extra domains (comma separated, optional)
              </label>
              <input
                value={form.domains}
                onChange={e => setForm({ ...form, domains: e.target.value })}
                placeholder="luna-astro.com, app.luna.com"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">Brand color preset</label>
              <div className="flex flex-wrap gap-3">
                {PRESETS.map(p => (
                  <button
                    key={p.primary}
                    type="button"
                    onClick={() => setForm({ ...form, primary: p.primary })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border transition ${
                      form.primary === p.primary
                        ? 'border-white bg-white/10'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full" style={{ background: p.primary }} />
                    <span className="text-sm">{p.label}</span>
                  </button>
                ))}
                <label className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 hover:border-white/30 cursor-pointer">
                  <input
                    type="color"
                    value={form.primary}
                    onChange={e => setForm({ ...form, primary: e.target.value })}
                    className="w-5 h-5 bg-transparent border-0 p-0"
                    aria-label="Custom brand color"
                  />
                  <span className="text-sm">Custom</span>
                </label>
              </div>
            </div>
          </div>
          <button
            onClick={createTenant}
            disabled={saving || !form.name || !form.slug}
            className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white px-6 py-2 rounded-full font-semibold transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Tenant
          </button>
        </div>

        {/* Tenant list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-light)]" />
          </div>
        ) : (
          <div className="space-y-4">
            {tenants.map(t => (
              <div
                key={t.id}
                className="glass rounded-2xl p-5 border border-white/10 flex flex-col md:flex-row md:items-center gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold">{t.name}</h3>
                    {t.isDefault && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/30 text-[var(--primary-glow)]">
                        default
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    slug: {t.slug} · {t._count.users} users
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {t.domains.map(d => (
                      <span
                        key={d.host}
                        className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-300"
                      >
                        {d.host}
                        {d.isPrimary ? ' ★' : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={tenantUrl(t)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-full border border-white/15 hover:bg-white/10 transition"
                  >
                    <ExternalLink className="w-4 h-4" /> Open
                  </a>
                  <button
                    onClick={() => openConfig(t)}
                    className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-full border border-white/15 hover:bg-white/10 transition"
                    title="Branding & integrations JSON"
                  >
                    <Cog className="w-4 h-4" /> Config
                  </button>
                  {t.status === 'active' ? (
                    <button
                      onClick={() => setStatus(t, 'suspended')}
                      className="text-sm px-3 py-2 rounded-full border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(t, 'active')}
                      className="text-sm px-3 py-2 rounded-full border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition"
                    >
                      Activate
                    </button>
                  )}
                  {!t.isDefault && (
                    <button
                      onClick={() => remove(t)}
                      className="p-2 rounded-full border border-red-500/40 text-red-300 hover:bg-red-500/10 transition"
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {configFor && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setConfigFor(null)}
        >
          <div
            className="glass w-full max-w-2xl rounded-3xl border border-white/15 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1">Config &mdash; {configFor.name}</h3>
            <p className="text-sm text-gray-400 mb-4">
              Advanced: raw branding &amp; settings JSON (OAuth keys, email sender, feature flags).
              Normal admins edit branding at /admin/branding on the tenant host.
            </p>
            <label className="block text-sm text-gray-400 mb-1">Branding JSON</label>
            <textarea
              rows={7}
              value={configJson.branding}
              onChange={e => setConfigJson({ ...configJson, branding: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-[var(--primary)] outline-none mb-3"
            />
            <label className="block text-sm text-gray-400 mb-1">
              Settings JSON (oauth: {'{ google: { clientId, clientSecret } }'}, emailFrom, features)
            </label>
            <textarea
              rows={7}
              value={configJson.settings}
              onChange={e => setConfigJson({ ...configJson, settings: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-[var(--primary)] outline-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfigFor(null)}
                className="px-4 py-2 rounded-full border border-white/15 hover:bg-white/10 text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={saveConfig}
                disabled={configSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-sm font-semibold transition"
              >
                {configSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
