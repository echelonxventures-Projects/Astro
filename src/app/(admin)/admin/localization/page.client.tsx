'use client'

import { Globe, Loader2, MapPin, Save } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AdminHeader from '@/components/layout/AdminHeader'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { logger } from '@/lib/logger'
import type { LocaleConfig } from '@/lib/tenant-defaults'

interface RegionRow {
  key: string
  name: string
  code: string
  currency: string
  isDefault: boolean
  priceMultiplier: number
}

export default function LocalizationClient(): React.ReactElement {
  const [locale, setLocale] = useState<LocaleConfig>({
    supportedLanguages: ['en'],
    defaultLanguage: 'en',
    currencyRegion: 'us',
  })
  const [regions, setRegions] = useState<RegionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allowedLangs, setAllowedLangs] = useState<string[] | null>(null)

  useEffect(() => {
    fetch('/api/admin/master-config')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.effective?.allowedLanguages) setAllowedLangs(d.effective.allowedLanguages)
      })
      .catch(() => {})
    fetch('/api/admin/localization')
      .then(async r => {
        const d = await r.json()
        if (r.ok) {
          setLocale(d.locale)
          setRegions(d.regions ?? [])
        } else {
          setError(d.error ?? 'Failed to load')
        }
      })
      .catch(err => logger.error({ err }, 'localization load failed'))
      .finally(() => setLoading(false))
  }, [])

  const toggleLang = (code: string): void => {
    setLocale(prev => {
      const has = prev.supportedLanguages.includes(code)
      const next = has
        ? prev.supportedLanguages.filter(c => c !== code)
        : [...prev.supportedLanguages, code]
      if (next.length === 0) return prev
      const def = has ? (prev.defaultLanguage === code ? next[0] : prev.defaultLanguage) : code
      return { ...prev, supportedLanguages: next, defaultLanguage: def }
    })
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/localization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supportedLanguages: locale.supportedLanguages,
          defaultLanguage: locale.defaultLanguage,
          defaultRegionKey: locale.currencyRegion,
        }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Save failed')
      else {
        setFlash('Localization saved. Visitors will see these languages immediately.')
        setTimeout(() => setFlash(null), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex justify-center">
        <AdminHeader active="localization" />
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-light)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <AdminHeader active="localization" />
      <main className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-3">
          <Globe className="w-7 h-7 text-[var(--primary-light)]" /> Localization
        </h1>
        <p className="text-gray-400 mb-8">
          Languages, markets and currency defaults for this platform.
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

        {/* Languages */}
        <div className="glass rounded-3xl p-6 border border-[var(--border)]/30 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Languages</h2>
            <select
              value={locale.defaultLanguage}
              onChange={e => setLocale({ ...locale, defaultLanguage: e.target.value })}
              className="bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:border-[var(--primary)] outline-none"
            >
              {locale.supportedLanguages.map(code => {
                const meta = SUPPORTED_LANGUAGES.find(l => l.code === code)
                return (
                  <option key={code} value={code}>
                    Default: {meta?.name ?? code}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {SUPPORTED_LANGUAGES.filter(l => !allowedLangs || allowedLangs.includes(l.code)).map(
              l => (
                <label
                  key={l.code}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer transition ${
                    locale.supportedLanguages.includes(l.code)
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-white'
                      : 'border-white/10 text-gray-400 hover:border-white/25'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={locale.supportedLanguages.includes(l.code)}
                    onChange={() => toggleLang(l.code)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{l.nativeName}</span>
                  <span className="text-xs text-gray-500 ml-auto">{l.code.toUpperCase()}</span>
                </label>
              )
            )}
          </div>
        </div>

        {/* Regions / currency */}
        <div className="glass rounded-3xl p-6 border border-[var(--border)]/30 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[var(--primary-light)]" /> Markets &amp; currency
            </h2>
            <Link href="/admin/plans" className="text-sm text-[var(--primary-glow)] underline">
              Add/remove markets
            </Link>
          </div>
          <div className="space-y-2">
            {regions.map(r => (
              <label
                key={r.key}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer transition ${
                  locale.currencyRegion === r.key
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                <input
                  type="radio"
                  name="region"
                  checked={locale.currencyRegion === r.key}
                  onChange={() => setLocale({ ...locale, currencyRegion: r.key })}
                  className="w-4 h-4"
                />
                <span className="font-medium text-white flex-1">{r.name}</span>
                <code className="text-xs uppercase text-gray-400">{r.currency}</code>
                <span className="text-xs text-gray-500">x{r.priceMultiplier}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            The default market sets the currency shown on the pricing page for new visitors.
            Regional pricing overrides per plan are managed in Plans.
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white px-6 py-3 rounded-full font-semibold transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-5 h-5" />}{' '}
          Save Localization
        </button>
      </main>
    </div>
  )
}
