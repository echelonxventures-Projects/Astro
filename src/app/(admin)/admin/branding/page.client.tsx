'use client'

import { Check, Loader2, RotateCcw, Save, Brush, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AdminHeader from '@/components/layout/AdminHeader'
import { brandToCssRules, DEFAULT_BRANDING, type BrandConfig } from '@/lib/branding'
import { logger } from '@/lib/logger'

const COLOR_FIELDS: Array<{ key: keyof BrandConfig['colors']; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'primaryDark', label: 'Primary dark' },
  { key: 'primaryLight', label: 'Primary light' },
  { key: 'primaryGlow', label: 'Primary glow' },
  { key: 'background', label: 'Background' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'muted', label: 'Muted / sections' },
  { key: 'card', label: 'Card' },
  { key: 'border', label: 'Border' },
  { key: 'silver', label: 'Silver' },
  { key: 'silverLight', label: 'Silver light' },
  { key: 'silverDark', label: 'Silver dark' },
  { key: 'accentPink', label: 'Accent - Love' },
  { key: 'accentCyan', label: 'Accent - Career' },
  { key: 'accentAmber', label: 'Accent - Wisdom' },
  { key: 'accentEmerald', label: 'Accent - Growth' },
]

function applyPreview(brand: BrandConfig): void {
  if (typeof document === 'undefined') return
  let el = document.getElementById('tenant-theme-preview')
  if (!el) {
    el = document.createElement('style')
    el.id = 'tenant-theme-preview'
    document.head.appendChild(el)
  }
  el.textContent = brandToCssRules(brand)
}

export default function BrandingClient(): React.ReactElement {
  const [brand, setBrand] = useState<BrandConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<'logoUrl' | 'faviconUrl'>('logoUrl')
  const [uploading, setUploading] = useState(false)

  const pickFile = (target: 'logoUrl' | 'faviconUrl'): void => {
    uploadTarget.current = target
    fileInputRef.current?.click()
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/admin/branding/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Upload failed')
      } else {
        setBrand(b => (b ? { ...b, [uploadTarget.current]: data.url } : b))
      }
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch('/api/branding')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load branding')
      } else {
        setBrand(data.effective as BrandConfig)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to load branding')
      setError('Failed to load branding')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // live preview while editing
  useEffect(() => {
    if (brand) applyPreview(brand)
  }, [brand])

  useEffect(
    () => () => {
      document.getElementById('tenant-theme-preview')?.remove()
    },
    []
  )

  const setColor = (key: keyof BrandConfig['colors'], value: string): void => {
    setBrand(b => (b ? { ...b, colors: { ...b.colors, [key]: value } } : b))
  }

  const save = async (): Promise<void> => {
    if (!brand) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brand),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save branding')
      } else {
        setBrand(data.stored as BrandConfig)
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  const reset = async (): Promise<void> => {
    document.getElementById('tenant-theme-preview')?.remove()
    await load()
  }

  const setPreset = (preset: 'starpath' | 'luna' | 'midnight'): void => {
    setBrand(b => {
      if (!b) return b
      const base = { ...b, colors: { ...b.colors } }
      if (preset === 'midnight') {
        base.colors.primary = '#2563EB'
        base.colors.primaryDark = '#1D4ED8'
        base.colors.primaryLight = '#60A5FA'
        base.colors.primaryGlow = '#93C5FD'
      } else if (preset === 'luna') {
        base.colors.primary = '#14B8A6'
        base.colors.primaryDark = '#0F766E'
        base.colors.primaryLight = '#5EEAD4'
        base.colors.primaryGlow = '#99F6E4'
      } else {
        base.colors = { ...DEFAULT_BRANDING.colors }
      }
      return base
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex justify-center">
        <AdminHeader active="branding" />
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-light)]" />
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="min-h-screen pt-24 px-4">
        <AdminHeader active="branding" />
        <div className="max-w-3xl mx-auto p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
          {error ?? 'Branding unavailable'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <AdminHeader active="branding" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
        className="hidden"
        onChange={onFile}
      />
      <main className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-3">
          <Brush className="w-7 h-7 text-[var(--primary-light)]" /> Branding
        </h1>
        <p className="text-gray-400 mb-8">
          Look &amp; feel for <strong className="text-white">{brand.name}</strong> on this hostname.
          Changes preview live and apply to every visitor of this tenant.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
            {error}
          </div>
        )}

        <div className="glass rounded-3xl p-6 border border-[var(--border)]/30 mb-6">
          <h2 className="text-lg font-bold mb-4">Identity</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Platform name</label>
              <input
                value={brand.name}
                onChange={e => setBrand({ ...brand, name: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Short name</label>
              <input
                value={brand.shortName}
                onChange={e => setBrand({ ...brand, shortName: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Tagline</label>
              <input
                value={brand.tagline}
                onChange={e => setBrand({ ...brand, tagline: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Logo URL (https:// or /path)
              </label>
              <div className="flex gap-2">
                <input
                  value={brand.logoUrl ?? ''}
                  placeholder="leave empty for the default icon"
                  onChange={e => setBrand({ ...brand, logoUrl: e.target.value || null })}
                  className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => pickFile('logoUrl')}
                  disabled={uploading}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl border border-white/15 hover:bg-white/10 text-gray-300 text-sm transition"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}{' '}
                  Upload
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Favicon URL</label>
              <div className="flex gap-2">
                <input
                  value={brand.faviconUrl ?? ''}
                  placeholder="/logo-192.png"
                  onChange={e => setBrand({ ...brand, faviconUrl: e.target.value || null })}
                  className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => pickFile('faviconUrl')}
                  disabled={uploading}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl border border-white/15 hover:bg-white/10 text-gray-300 text-sm transition"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}{' '}
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 border border-[var(--border)]/30 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Colors</h2>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setPreset('starpath')}
                className="px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/10 transition"
              >
                StarPath palette
              </button>
              <button
                onClick={() => setPreset('luna')}
                className="px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/10 transition"
              >
                Luna palette
              </button>
              <button
                onClick={() => setPreset('midnight')}
                className="px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/10 transition"
              >
                Midnight palette
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-xl px-3 py-2 cursor-pointer"
              >
                <input
                  type="color"
                  value={brand.colors[key]}
                  onChange={e => setColor(key, e.target.value)}
                  className="w-8 h-8 rounded border-0 bg-transparent p-0"
                />
                <span className="text-sm text-gray-300">
                  {label}
                  <span className="block text-xs text-gray-500 font-mono">{brand.colors[key]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-6 border border-[var(--border)]/30 mb-8">
          <h2 className="text-lg font-bold mb-4">SEO</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Page title</label>
              <input
                value={brand.seo.title ?? ''}
                onChange={e => setBrand({ ...brand, seo: { ...brand.seo, title: e.target.value } })}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Meta description</label>
              <textarea
                rows={2}
                value={brand.seo.description ?? ''}
                onChange={e =>
                  setBrand({ ...brand, seo: { ...brand.seo, description: e.target.value } })
                }
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-[var(--primary)] outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white px-6 py-3 rounded-full font-semibold transition"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedFlash ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savedFlash ? 'Saved' : 'Save Branding'}
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 border border-white/15 hover:bg-white/10 text-gray-300 px-5 py-3 rounded-full transition"
          >
            <RotateCcw className="w-4 h-4" /> Revert
          </button>
        </div>
      </main>
    </div>
  )
}
