'use client'

import {
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import AdminHeader from '@/components/layout/AdminHeader'
import { logger } from '@/lib/logger'

interface DnsRecord {
  type: string
  name: string
  value: string
  note?: string
}

interface DomainRow {
  id: string
  host: string
  type: string
  status: string
  isPrimary: boolean
  live: boolean
  lastCheckedAt: string | null
  lastCheckMessage: string | null
  verificationToken: string | null
  dns: { connect: string; records: DnsRecord[] } | null
}

const STATUS_META: Record<string, { cls: string; label: string }> = {
  verified: { cls: 'bg-emerald-500/20 text-emerald-300', label: 'Active' },
  failing: { cls: 'bg-red-500/20 text-red-300', label: 'Failing' },
  pending_dns: { cls: 'bg-amber-500/20 text-amber-300', label: 'Waiting on DNS' },
  pending_verification: { cls: 'bg-sky-500/20 text-sky-300', label: 'Waiting on verification' },
  disabled: { cls: 'bg-gray-500/20 text-gray-400', label: 'Disabled' },
}

function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { cls: 'bg-white/10 text-gray-300', label: status }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
}

export default function DomainsClient(): React.ReactElement {
  const [rows, setRows] = useState<DomainRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newHost, setNewHost] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch('/api/tenant/domains')
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setError(d?.error ?? 'Failed to load domains')
      } else {
        const d = await res.json()
        setRows(d.domains ?? [])
      }
    } catch (err) {
      logger.error({ err }, 'domains load failed')
      setError('Failed to load domains')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const note = (msg: string): void => {
    setFlash(msg)
    setError(null)
    setTimeout(() => setFlash(null), 4000)
  }

  const call = async (
    url: string,
    init?: { method?: string; body?: unknown }
  ): Promise<{ ok: boolean; data: Record<string, unknown> }> => {
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setError(String(data.error ?? 'Request failed'))
    return { ok: res.ok, data }
  }

  const doAttach = async (): Promise<void> => {
    if (!newHost.trim()) return
    setBusy('new')
    try {
      const r = await call('/api/tenant/domains', {
        method: 'POST',
        body: { host: newHost.trim() },
      })
      if (r.ok) {
        setAdding(false)
        setNewHost('')
        note(
          'Domain attached. Add the DNS records below at your registrar — we advance the stage automatically.'
        )
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const doCheck = async (row: DomainRow): Promise<void> => {
    setBusy(row.id)
    try {
      const r = await call(`/api/tenant/domains/${row.id}/check`, { method: 'POST' })
      if (r.ok) note(`Check complete — ${String(r.data.status ?? '').replace(/_/g, ' ')}`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  const doToggle = async (row: DomainRow): Promise<void> => {
    setBusy(row.id)
    try {
      await call(`/api/tenant/domains/${row.id}`, {
        method: 'PATCH',
        body: { status: row.status === 'disabled' ? 'verified' : 'disabled' },
      })
      await load()
    } finally {
      setBusy(null)
    }
  }

  const doRemove = async (row: DomainRow): Promise<void> => {
    if (!window.confirm(`Remove ${row.host}? The domain will stop serving immediately.`)) return
    setBusy(row.id)
    try {
      const r = await call(`/api/tenant/domains/${row.id}`, { method: 'DELETE' })
      if (r.ok) note('Domain removed')
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <AdminHeader active="domains" />
      <main className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold gradient-text">Domains</h1>
          <button
            onClick={() => setAdding(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Add domain
          </button>
        </div>
        <p className="text-gray-400 mb-6">
          Point a domain you own (purchased at any registrar) here. It serves your branded platform
          once DNS + verification pass; HTTPS certificates are issued automatically. Your
          platform&apos;s underlying host is never shown to visitors.
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

        {adding && (
          <div className="glass rounded-2xl p-5 border border-[var(--border)]/30 mb-6 flex items-center gap-3">
            <input
              value={newHost}
              onChange={e => setNewHost(e.target.value)}
              placeholder="www.mybrand.com or mybrand.com"
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
            />
            <button
              onClick={doAttach}
              disabled={busy === 'new' || !newHost.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-semibold text-sm transition"
            >
              {busy === 'new' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}{' '}
              Attach
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-light)]" />
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map(row => (
              <div key={row.id} className="glass rounded-2xl p-5 border border-white/10">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-white">{row.host}</span>
                  {row.isPrimary && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                      primary
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${row.type === 'in_house' ? 'bg-[var(--primary)]/20 text-[var(--primary-glow)]' : 'bg-white/10 text-gray-300'}`}
                  >
                    {row.type === 'in_house' ? 'platform subdomain' : 'custom domain'}
                  </span>
                  <StatusChip status={row.status} />
                  {row.type === 'custom' &&
                    (row.status === 'verified' || row.status === 'failing') && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                        {row.live ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-gray-500" />
                        )}
                        serving
                      </span>
                    )}
                  <span className="ml-auto flex items-center gap-2">
                    {row.type === 'custom' && (
                      <>
                        <button
                          onClick={() => doCheck(row)}
                          disabled={busy === row.id}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/10 transition"
                          title="Re-check DNS, ownership and serving now"
                        >
                          {busy === row.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}{' '}
                          Check now
                        </button>
                        {row.status !== 'disabled' ? (
                          <button
                            onClick={() => doToggle(row)}
                            className="text-xs px-3 py-1.5 rounded-full border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => doToggle(row)}
                            className="text-xs px-3 py-1.5 rounded-full border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition"
                          >
                            Enable
                          </button>
                        )}
                        <button
                          onClick={() => doRemove(row)}
                          className="p-1.5 rounded-full border border-red-500/40 text-red-300 hover:bg-red-500/10 transition"
                          aria-label={`Remove ${row.host}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </span>
                </div>

                {row.lastCheckMessage && (
                  <p
                    className={`mt-2 text-xs ${row.status === 'failing' ? 'text-red-300' : row.status.startsWith('pending') ? 'text-amber-200' : 'text-gray-400'}`}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    {row.lastCheckMessage}
                  </p>
                )}

                {row.type === 'custom' && row.dns && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-3">
                    {row.dns.records.map(r => (
                      <div
                        key={`${r.type}-${r.name}`}
                        className="bg-black/25 border border-white/10 rounded-xl px-4 py-3 text-xs"
                      >
                        <div className="flex items-center gap-2 mb-1 text-gray-400">
                          <ShieldAlert className="w-3.5 h-3.5" /> {r.type}
                        </div>
                        <div className="font-mono text-white break-all">{r.name}</div>
                        <div className="font-mono text-[var(--primary-glow)] break-all">
                          {r.value}
                        </div>
                        {r.note && <div className="text-gray-500 mt-1">{r.note}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
