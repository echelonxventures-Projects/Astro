/**
 * New Platform onboarding wizard (superadmin)
 * Configures identity + languages + markets/currency + plans + gateways + AI
 * + admin account in one submit -> POST /api/admin/tenants (provisioner).
 */

'use client'

import { Check, ChevronLeft, ChevronRight, Globe, Loader2, Rocket, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AdminHeader from '@/components/layout/AdminHeader'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { logger } from '@/lib/logger'
import { DEFAULT_REGION_TEMPLATE } from '@/lib/tenant-defaults'

interface Eff {
  allowedLanguages: string[]
  allowedRegions: string[]
  allowedGateways: string[]
  allowedAiProviders: string[]
  childDefaults: { language?: string; region?: string; aiProvider?: string }
}

interface PlanRow {
  key: string
  name: string
  price: number
  currency: string
  interval: string
  enabled: boolean
  isPopular: boolean
}

const START_PLANS: PlanRow[] = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    currency: 'usd',
    interval: '',
    enabled: true,
    isPopular: false,
  },
  {
    key: 'monthly',
    name: 'Premium Monthly',
    price: 1499,
    currency: 'usd',
    interval: 'monthly',
    enabled: true,
    isPopular: true,
  },
  {
    key: 'yearly',
    name: 'Premium Yearly',
    price: 14990,
    currency: 'usd',
    interval: 'yearly',
    enabled: true,
    isPopular: false,
  },
]

const AI_CHOICES = [
  { key: 'openrouter', label: 'OpenRouter (free tier available)' },
  { key: 'nvidia', label: 'NVIDIA NIM' },
  { key: 'ollama', label: 'Ollama (local, free)' },
  { key: 'anthropic', label: 'Anthropic Claude' },
  { key: 'gemini', label: 'Google Gemini' },
]

const PRESETS = [
  { label: 'Purple & Silver', primary: '#7C3AED', bg: '#0F0A1F' },
  { label: 'Teal & Gold', primary: '#14B8A6', bg: '#03151E' },
  { label: 'Rose Night', primary: '#E11D48', bg: '#1A0512' },
  { label: 'Ocean', primary: '#2563EB', bg: '#050E20' },
  { label: 'Forest', primary: '#16A34A', bg: '#04140B' },
  { label: 'Amber Dusk', primary: '#D97706', bg: '#170D02' },
]

const STEPS = [
  'Identity',
  'Languages',
  'Markets & Currency',
  'Plans',
  'Payments & AI',
  'Admin Account',
]

function genPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%'
  let out = ''
  const rnd = new Uint32Array(14)
  crypto.getRandomValues(rnd)
  for (let i = 0; i < 14; i++) out += chars[rnd[i] % chars.length]
  return out
}

const inputCls =
  'w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none'

export default function NewTenantClient({
  isSuper = true,
}: {
  isSuper?: boolean
}): React.ReactElement {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [eff, setEff] = useState<Eff | null>(null)
  const [parentOptions, setParentOptions] = useState<
    Array<{ id: string; slug: string; name: string }>
  >([])
  const [parentId, setParentId] = useState('')

  useEffect(() => {
    fetch('/api/admin/master-config')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('master'))))
      .then(d => {
        setEff({
          allowedLanguages: d.effective.allowedLanguages,
          allowedRegions: d.effective.allowedRegions,
          allowedGateways: d.effective.allowedGateways,
          allowedAiProviders: d.effective.allowedAiProviders,
          childDefaults: d.effective.childDefaults ?? {},
        })
        setSupported(prev =>
          prev.some(c => !d.effective.allowedLanguages.includes(c))
            ? d.effective.allowedLanguages.filter((c: string) => prev.includes(c)).length
              ? d.effective.allowedLanguages.filter((c: string) => prev.includes(c))
              : [d.effective.childDefaults?.language ?? 'en']
            : prev
        )
        setRegionKeys(prev =>
          prev.filter(k => d.effective.allowedRegions.includes(k)).length
            ? prev.filter(k => d.effective.allowedRegions.includes(k))
            : [d.effective.childDefaults?.region ?? 'us']
        )
        setAiDefault(
          d.effective.allowedAiProviders.includes('openrouter')
            ? 'openrouter'
            : (d.effective.allowedAiProviders[0] ?? 'openrouter')
        )
        const flat: Array<{ id: string; slug: string; name: string }> = []
        const walk = (
          nodes: Array<{ id: string; slug: string; name: string; children?: unknown[] }>
        ) => {
          for (const n of nodes) {
            flat.push({ id: n.id, slug: n.slug, name: n.name })
            if (Array.isArray(n.children)) walk(n.children as never)
          }
        }
        walk(d.tree ?? [])
        setParentOptions(flat)
        if (!d.isSuper && d.self) setParentId(d.self.id)
      })
      .catch(err => logger.warn({ err }, 'master-config unavailable'))
  }, [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{
    slug: string
    host: string
    email: string
    password: string
  } | null>(null)

  // identity
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [tagline, setTagline] = useState('')
  const [preset, setPreset] = useState(PRESETS[0])
  const [customColor, setCustomColor] = useState<string | null>(null)
  const [domains, setDomains] = useState('')

  // languages
  const [supported, setSupported] = useState<string[]>(['en'])
  const [defaultLang, setDefaultLang] = useState('en')

  // markets
  const [regionKeys, setRegionKeys] = useState<string[]>(['us'])
  const [defaultRegion, setDefaultRegion] = useState('us')

  // plans
  const [plans, setPlans] = useState<PlanRow[]>(START_PLANS)

  // payments & ai
  const [gwStripe, setGwStripe] = useState(true)
  const [gwRazorpay, setGwRazorpay] = useState(false)
  const [gwPaypal, setGwPaypal] = useState(false)
  const [aiDefault, setAiDefault] = useState('openrouter')

  // admin
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState(genPassword())

  const primary = customColor ?? preset.primary

  const stepValid = (): boolean => {
    switch (step) {
      case 0:
        return name.trim().length >= 3 && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)
      case 1:
        return supported.length > 0 && supported.includes(defaultLang)
      case 2:
        return regionKeys.length > 0 && regionKeys.includes(defaultRegion)
      case 3:
        return plans.filter(p => p.enabled).length >= 1
      case 4:
        return true
      case 5:
        return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail) && adminPassword.length >= 8
      default:
        return true
    }
  }

  const submit = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const chosenRegions = DEFAULT_REGION_TEMPLATE.filter(r => regionKeys.includes(r.key)).map(
        r => ({
          ...r,
          isDefault: r.key === defaultRegion,
        })
      )
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          branding: {
            name: name.trim(),
            shortName: slug,
            ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
            colors: { primary },
          },
          domains: domains
            .split(',')
            .map(d => d.trim())
            .filter(Boolean),
          locales: {
            supportedLanguages: supported,
            defaultLanguage: defaultLang,
            currencyRegion: defaultRegion,
          },
          regions: chosenRegions,
          plans: plans
            .filter(p => p.enabled)
            .map(p => ({
              key: p.key,
              name: p.name,
              price: p.price,
              currency: p.currency,
              interval: p.interval || null,
              isPopular: p.isPopular,
            })),
          gateways: [
            ...(gwStripe && (!eff || eff.allowedGateways.includes('stripe'))
              ? [{ key: 'stripe' }]
              : []),
            ...(gwRazorpay && (!eff || eff.allowedGateways.includes('razorpay'))
              ? [{ key: 'razorpay' }]
              : []),
            ...(gwPaypal && (!eff || eff.allowedGateways.includes('paypal'))
              ? [{ key: 'paypal' }]
              : []),
          ],
          aiDefault,
          ...(isSuper && parentId ? { parentId } : {}),
          adminUser: { email: adminEmail, name: adminName || undefined, password: adminPassword },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to provision platform')
        return
      }
      setDone({
        slug,
        host: data.provision?.primaryHost ?? `${slug}.localhost`,
        email: adminEmail,
        password: adminPassword,
      })
    } catch (err) {
      logger.error({ err }, 'wizard submit failed')
      setError('Failed to provision platform')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    const port = typeof window !== 'undefined' ? window.location.port : '3001'
    const url = `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${done.host}${port ? `:${port}` : ''}`
    return (
      <div className="min-h-screen pt-24 pb-16 px-4">
        <AdminHeader active="tenants" />
        <main className="max-w-lg mx-auto glass rounded-3xl p-8 border border-emerald-500/40 text-center">
          <Rocket className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold gradient-text mb-2">Platform is live</h1>
          <p className="text-gray-400 mb-6">
            <strong className="text-white">{name}</strong> has been provisioned with regions, plans,
            gateways, AI catalog and admin account.
          </p>
          <div className="bg-black/30 rounded-2xl p-5 text-left space-y-2 mb-6 font-mono text-sm">
            <p className="text-gray-400">
              URL <span className="text-white">{url}</span>
            </p>
            <p className="text-gray-400">
              Admin <span className="text-white">{done.email}</span>
            </p>
            <p className="text-gray-400">
              Password <span className="text-white">{done.password}</span>
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold transition"
            >
              Open platform
            </a>
            <button
              onClick={() => router.push('/admin/tenants')}
              className="px-5 py-2.5 rounded-full border border-white/15 hover:bg-white/10 transition"
            >
              All platforms
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <AdminHeader active="tenants" />
      <main className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold gradient-text mb-2">
          {isSuper ? 'New Platform' : 'New Sub-platform'}
        </h1>
        <p className="text-gray-400 mb-6">
          Everything the customer needs, configured in one pass. All of it stays editable later.
        </p>

        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${
                i === step
                  ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-white'
                  : i < step
                    ? 'border-emerald-500/50 text-emerald-300'
                    : 'border-white/10 text-gray-500'
              }`}
            >
              {i < step ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <span className="w-3.5 text-center">{i + 1}</span>
              )}{' '}
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
            {error}
          </div>
        )}

        <div className="glass rounded-3xl p-6 border border-[var(--border)]/30 mb-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Platform name</label>
                  <input
                    value={name}
                    onChange={e => {
                      setName(e.target.value)
                      if (!slugTouched)
                        setSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-+|-+$/g, '')
                            .slice(0, 30)
                        )
                    }}
                    placeholder="Aurum Astrology"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Slug (subdomain)</label>
                  <input
                    value={slug}
                    onChange={e => {
                      setSlugTouched(true)
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }}
                    placeholder="aurum"
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Tagline (optional)</label>
                  <input
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    placeholder="Guidance written in gold"
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-2">Brand color</label>
                  <div className="flex flex-wrap gap-3">
                    {PRESETS.map(p => (
                      <button
                        key={p.primary}
                        type="button"
                        onClick={() => {
                          setPreset(p)
                          setCustomColor(null)
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition ${primary === p.primary ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'}`}
                      >
                        <span className="w-4 h-4 rounded-full" style={{ background: p.primary }} />{' '}
                        {p.label}
                      </button>
                    ))}
                    <label className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 hover:border-white/30 text-sm cursor-pointer">
                      <input
                        type="color"
                        value={primary}
                        onChange={e => setCustomColor(e.target.value)}
                        className="w-5 h-5 bg-transparent border-0 p-0"
                      />{' '}
                      Custom
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    Custom domains (comma separated, optional)
                  </label>
                  <input
                    value={domains}
                    onChange={e => setDomains(e.target.value)}
                    placeholder="aurum-astro.com, app.aurum.com"
                    className={inputCls}
                  />

                  {isSuper && (
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-400 mb-1">
                        Parent platform (optional)
                      </label>
                      <select
                        value={parentId}
                        onChange={e => setParentId(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">None - root / super platform</option>
                        {parentOptions.map(p => (
                          <option key={p.id} value={p.id}>
                            Under {p.name} ({p.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 p-4 text-sm text-gray-400">
                Live preview:{' '}
                <span
                  className="text-lg font-bold"
                  style={{
                    background: `linear-gradient(90deg, ${primary}, #fff)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {name || 'Your Platform'}
                </span>
                <span className="block text-xs mt-1">
                  Subdomain {slug || '...'}.localhost will resolve instantly in your browser.
                </span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-[var(--primary-light)]" />
                <h2 className="text-lg font-bold">Languages this platform offers</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                {SUPPORTED_LANGUAGES.filter(l => !eff || eff.allowedLanguages.includes(l.code)).map(
                  l => (
                    <label
                      key={l.code}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer text-sm ${supported.includes(l.code) ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-white' : 'border-white/10 text-gray-400'}`}
                    >
                      <input
                        type="checkbox"
                        checked={supported.includes(l.code)}
                        onChange={() => {
                          setSupported(prev => {
                            const next = prev.includes(l.code)
                              ? prev.filter(c => c !== l.code)
                              : [...prev, l.code]
                            if (!next.length) return prev
                            if (!next.includes(defaultLang)) setDefaultLang(next[0])
                            return next
                          })
                        }}
                        className="w-4 h-4"
                      />
                      {l.nativeName}{' '}
                      <span className="text-xs text-gray-500 ml-auto">{l.code.toUpperCase()}</span>
                    </label>
                  )
                )}
              </div>
              <label className="block text-sm text-gray-400 mb-1">Default language</label>
              <select
                value={defaultLang}
                onChange={e => setDefaultLang(e.target.value)}
                className={inputCls}
              >
                {supported.map(c => {
                  const meta = SUPPORTED_LANGUAGES.find(l => l.code === c)
                  return (
                    <option key={c} value={c}>
                      {meta?.name ?? c}
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-bold mb-4">
                Markets, currency &amp; pricing multipliers
              </h2>
              <div className="space-y-2">
                {DEFAULT_REGION_TEMPLATE.filter(
                  r => !eff || eff.allowedRegions.includes(r.key)
                ).map(r => (
                  <label
                    key={r.key}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer text-sm ${regionKeys.includes(r.key) ? 'border-[var(--primary)]/60 bg-[var(--primary)]/5' : 'border-white/10'}`}
                  >
                    <input
                      type="checkbox"
                      checked={regionKeys.includes(r.key)}
                      onChange={() => {
                        setRegionKeys(prev => {
                          const next = prev.includes(r.key)
                            ? prev.filter(k => k !== r.key)
                            : [...prev, r.key]
                          if (!next.length) return prev
                          if (!next.includes(defaultRegion)) setDefaultRegion(next[0])
                          return next
                        })
                      }}
                      className="w-4 h-4"
                    />
                    <span className="font-medium text-white flex-1">{r.name}</span>
                    <code className="uppercase text-gray-400">{r.currency}</code>
                    <span className="text-gray-500">x{r.priceMultiplier}</span>
                    <input
                      type="radio"
                      name="defaultRegion"
                      checked={defaultRegion === r.key}
                      onChange={() => setDefaultRegion(r.key)}
                      className="w-4 h-4"
                      aria-label={`default region ${r.name}`}
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                The default market sets the pricing-page currency for new visitors. More markets can
                be added later by the platform admin (Plans admin).
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-bold mb-4">
                Subscription plans (prices in the platform base currency)
              </h2>
              <div className="space-y-3">
                {plans.map((p, i) => (
                  <div
                    key={p.key}
                    className={`rounded-xl border p-4 ${p.enabled ? 'border-[var(--primary)]/50' : 'border-white/10 opacity-60'}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={e =>
                          setPlans(
                            plans.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x))
                          )
                        }
                        className="w-4 h-4"
                      />
                      <input
                        value={p.name}
                        onChange={e =>
                          setPlans(
                            plans.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-[var(--primary)]"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-400">
                        <input
                          type="radio"
                          name="popular"
                          checked={p.isPopular}
                          onChange={() =>
                            setPlans(plans.map((x, j) => ({ ...x, isPopular: j === i })))
                          }
                          className="w-3.5 h-3.5"
                        />{' '}
                        popular
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <label className="text-xs text-gray-500">
                          Price ({(p.price / 100).toFixed(2)})
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={p.price}
                          onChange={e =>
                            setPlans(
                              plans.map((x, j) =>
                                j === i ? { ...x, price: Number(e.target.value) } : x
                              )
                            )
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-[var(--primary)]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Currency</label>
                        <select
                          value={p.currency}
                          onChange={e =>
                            setPlans(
                              plans.map((x, j) =>
                                j === i ? { ...x, currency: e.target.value } : x
                              )
                            )
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none"
                        >
                          <option value="usd">USD</option>
                          <option value="eur">EUR</option>
                          <option value="gbp">GBP</option>
                          <option value="inr">INR</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Billing</label>
                        <select
                          value={p.interval}
                          onChange={e =>
                            setPlans(
                              plans.map((x, j) =>
                                j === i ? { ...x, interval: e.target.value } : x
                              )
                            )
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none"
                        >
                          <option value="">one-time</option>
                          <option value="monthly">monthly</option>
                          <option value="yearly">yearly</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-3">Payment gateways</h2>
                <p className="text-xs text-gray-500 mb-3">
                  Keys are picked from platform defaults when available; the customer fills their
                  own later in Payments admin.
                </p>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={gwStripe}
                      onChange={e => setGwStripe(e.target.checked)}
                      className="w-4 h-4"
                    />{' '}
                    Stripe
                  </label>
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={gwRazorpay}
                      onChange={e => setGwRazorpay(e.target.checked)}
                      className="w-4 h-4"
                    />{' '}
                    Razorpay
                  </label>
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={gwPaypal}
                      onChange={e => setGwPaypal(e.target.checked)}
                      className="w-4 h-4"
                    />{' '}
                    PayPal
                  </label>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold mb-3">Default AI provider</h2>
                <select
                  value={aiDefault}
                  onChange={e => setAiDefault(e.target.value)}
                  className={inputCls}
                >
                  {AI_CHOICES.map(a => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  The full catalog (OpenAI, Groq, any OpenAI-compatible API) is editable in Settings
                  - Providers.
                </p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-[var(--primary-light)]" />
                <h2 className="text-lg font-bold">Platform admin account</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Admin name</label>
                  <input
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder={name ? `${name} Admin` : 'Platform Admin'}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Admin email</label>
                  <input
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder={`admin@${slug || 'platform'}.com`}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Initial password</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white font-mono outline-none focus:border-[var(--primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setAdminPassword(genPassword())}
                      className="px-4 rounded-xl border border-white/15 hover:bg-white/10 text-sm transition"
                    >
                      Regenerate
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Share these credentials with the customer - they own this platform from then on.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-white/15 hover:bg-white/10 disabled:opacity-40 text-sm transition"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => stepValid() && setStep(s => s + 1)}
              disabled={!stepValid()}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-40 text-white font-semibold text-sm transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving || !stepValid()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold transition"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}{' '}
              Launch platform
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          <Link href="/admin/tenants" className="underline">
            Back to platforms
          </Link>
        </p>
      </main>
    </div>
  )
}
