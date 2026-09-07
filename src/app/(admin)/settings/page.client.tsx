'use client'

import {
  Sparkles,
  Loader2,
  Save,
  Settings,
  RotateCcw,
  CheckCircle,
  XCircle,
  Star,
  Zap,
  Crown,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'

interface ProviderConfig {
  provider: string
  model: string
  ollamaUrl: string
  anthropicApiKey: string
  geminiApiKey: string
}

interface AIPlanConfig {
  plan: 'free' | 'monthly' | 'yearly'
  provider: string
  model: string
  apiKey?: string | null
  ollamaUrl?: string | null
  maxTokens: number
  enabled: boolean
}

export default function SettingsClient() {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'success' | '_error' | null>(null)
  const [activeTab, setActiveTab] = useState<'global' | 'plans'>('plans')
  const [planConfigs, setPlanConfigs] = useState<Record<string, AIPlanConfig>>({
    free: { plan: 'free', provider: 'ollama', model: 'llama3.2', maxTokens: 512, enabled: true },
    monthly: {
      plan: 'monthly',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2048,
      enabled: true,
    },
    yearly: {
      plan: 'yearly',
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      maxTokens: 4096,
      enabled: true,
    },
  })
  const [globalConfig, setGlobalConfig] = useState<ProviderConfig>({
    provider: 'ollama',
    model: 'llama3.2',
    ollamaUrl: 'http://localhost:5566',
    anthropicApiKey: '',
    geminiApiKey: '',
  })

  // Server already authenticated, just load settings
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setGlobalConfig(data)
      }
      const planRes = await fetch('/api/settings/plans')
      if (planRes.ok) {
        const plans = await planRes.json()
        const planMap: Record<string, AIPlanConfig> = {}
        plans.forEach((p: AIPlanConfig) => {
          planMap[p.plan] = p
        })
        setPlanConfigs(planMap)
      }
    } catch (_error) {
      logger.warn({ _error }, 'Failed to load settings')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (activeTab === 'global') {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(globalConfig),
        })
        if (res.ok) {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        }
      } else {
        const res = await fetch('/api/settings/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.values(planConfigs)),
        })
        if (res.ok) {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        }
      }
    } catch (_error) {
      logger.warn({ _error }, 'Failed to save settings')
      alert('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const updatePlanConfig = (
    plan: 'free' | 'monthly' | 'yearly',
    updates: Partial<AIPlanConfig>
  ) => {
    setPlanConfigs(prev => ({
      ...prev,
      [plan]: { ...prev[plan], ...updates },
    }))
  }

  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus(null)
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalConfig),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setConnectionStatus('success')
      } else {
        setConnectionStatus('_error')
      }
    } catch (_error) {
      setConnectionStatus('_error')
    } finally {
      setTestingConnection(false)
    }
  }

  const resetToDefaults = () => {
    if (activeTab === 'global') {
      setGlobalConfig({
        provider: 'ollama',
        model: 'llama3.2',
        ollamaUrl: 'http://localhost:5566',
        anthropicApiKey: '',
        geminiApiKey: '',
      })
    } else {
      setPlanConfigs({
        free: {
          plan: 'free',
          provider: 'ollama',
          model: 'llama3.2',
          maxTokens: 512,
          enabled: true,
        },
        monthly: {
          plan: 'monthly',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          maxTokens: 2048,
          enabled: true,
        },
        yearly: {
          plan: 'yearly',
          provider: 'anthropic',
          model: 'claude-opus-4-20250514',
          maxTokens: 4096,
          enabled: true,
        },
      })
    }
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-xl font-bold gradient-text">StarPath Astrology</span>
            </Link>
            <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 gradient-text">AI Provider Settings</h1>
          <p className="text-purple-200 mb-8">Configure AI models for each subscription tier</p>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-2 rounded-xl font-semibold transition ${
                activeTab === 'plans'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              <Star className="w-4 h-4 inline mr-2" />
              By Subscription Plan
            </button>
            <button
              onClick={() => setActiveTab('global')}
              className={`px-4 py-2 rounded-xl font-semibold transition ${
                activeTab === 'global'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Global Settings
            </button>
          </div>

          {activeTab === 'plans' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="text-purple-200 mb-4">
                Configure different AI models for each subscription tier. Premium users get better
                models.
              </div>

              <PlanConfigCard
                title="Free Plan"
                icon={Zap}
                config={planConfigs.free}
                onChange={updates => updatePlanConfig('free', updates)}
              />

              <PlanConfigCard
                title="Premium Monthly"
                icon={Star}
                config={planConfigs.monthly}
                onChange={updates => updatePlanConfig('monthly', updates)}
              />

              <PlanConfigCard
                title="Premium Yearly (VIP)"
                icon={Crown}
                config={planConfigs.yearly}
                onChange={updates => updatePlanConfig('yearly', updates)}
              />

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" /> Save Settings
                    </>
                  )}
                </button>
                {saved && <span className="text-green-400">Settings saved successfully!</span>}
              </div>
            </form>
          )}

          {activeTab === 'global' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="text-purple-200 mb-4">
                Global fallback settings (used when plan-based configuration is disabled).
              </div>

              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-semibold mb-4">AI Provider</h2>
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Select Provider
                  </label>
                  <select
                    value={globalConfig.provider}
                    onChange={e =>
                      setGlobalConfig({
                        ...globalConfig,
                        provider: e.target.value,
                        model: getDefaultModel(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  >
                    <option value="ollama">Ollama (Free, Local)</option>
                    <option value="anthropic">Anthropic Claude (Paid)</option>
                    <option value="gemini">Google Gemini (Paid, Free Tier)</option>
                  </select>
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-semibold mb-4">Model Configuration</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Model Name
                    </label>
                    <input
                      type="text"
                      value={globalConfig.model}
                      onChange={e => setGlobalConfig({ ...globalConfig, model: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                      placeholder={getModelPlaceholder(globalConfig.provider)}
                    />
                  </div>
                  {globalConfig.provider === 'ollama' && (
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Ollama Server URL
                      </label>
                      <input
                        type="url"
                        value={globalConfig.ollamaUrl}
                        onChange={e =>
                          setGlobalConfig({ ...globalConfig, ollamaUrl: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                        placeholder="http://localhost:5566"
                      />
                    </div>
                  )}
                  {globalConfig.provider === 'anthropic' && (
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Anthropic API Key
                      </label>
                      <input
                        type="password"
                        value={globalConfig.anthropicApiKey}
                        onChange={e =>
                          setGlobalConfig({ ...globalConfig, anthropicApiKey: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                        placeholder="sk-ant-..."
                      />
                    </div>
                  )}
                  {globalConfig.provider === 'gemini' && (
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Google Gemini API Key
                      </label>
                      <input
                        type="password"
                        value={globalConfig.geminiApiKey}
                        onChange={e =>
                          setGlobalConfig({ ...globalConfig, geminiApiKey: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                        placeholder="AIza..."
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-semibold mb-4">Test Connection</h2>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={testConnection}
                    disabled={testingConnection}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition"
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </button>
                  {connectionStatus === 'success' && (
                    <span className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-5 h-5" /> Connection successful!
                    </span>
                  )}
                  {connectionStatus === '_error' && (
                    <span className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-5 h-5" /> Connection failed
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" /> Save Settings
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetToDefaults}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition"
                >
                  <RotateCcw className="w-5 h-5" /> Reset to Defaults
                </button>
                {saved && <span className="text-green-400">Settings saved successfully!</span>}
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

interface PlanConfigCardProps {
  title: string
  icon: React.ElementType
  config: AIPlanConfig
  onChange: (updates: Partial<AIPlanConfig>) => void
}

function PlanConfigCard({ title, icon: Icon, config, onChange }: PlanConfigCardProps) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-600/30 rounded-xl">
          <Icon className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-purple-300">AI Model Configuration</p>
        </div>
        <label className="ml-auto flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={e => onChange({ enabled: e.target.checked })}
            className="sr-only"
          />
          <div
            className={`w-12 h-6 rounded-full transition ${config.enabled ? 'bg-purple-600' : 'bg-white/10'}`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition ${config.enabled ? 'translate-x-7' : 'translate-x-1'} transform mt-1`}
            />
          </div>
          <span className="text-sm text-purple-200">{config.enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-purple-200 mb-2">AI Provider</label>
          <select
            value={config.provider}
            onChange={e =>
              onChange({ provider: e.target.value, model: getDefaultModel(e.target.value) })
            }
            className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
          >
            <option value="ollama">Ollama (Free)</option>
            <option value="anthropic">Anthropic Claude (Paid)</option>
            <option value="gemini">Google Gemini (Paid)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-200 mb-2">Model Name</label>
          <input
            type="text"
            value={config.model}
            onChange={e => onChange({ model: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
          />
        </div>

        {config.provider === 'ollama' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Ollama Server URL
            </label>
            <input
              type="url"
              value={config.ollamaUrl || 'http://localhost:5566'}
              onChange={e => onChange({ ollamaUrl: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>
        )}

        {config.provider === 'anthropic' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Anthropic API Key
            </label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={e => onChange({ apiKey: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>
        )}

        {config.provider === 'gemini' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={e => onChange({ apiKey: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-purple-200 mb-2">Max Tokens</label>
          <input
            type="number"
            value={config.maxTokens}
            onChange={e => onChange({ maxTokens: parseInt(e.target.value) })}
            className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
          />
          <p className="text-xs text-purple-400 mt-1">
            Higher = longer readings (more tokens = higher cost)
          </p>
        </div>
      </div>
    </div>
  )
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-20250514'
    case 'gemini':
      return 'gemini-2.0-flash'
    default:
      return 'llama3.2'
  }
}

function getModelPlaceholder(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-20250514'
    case 'gemini':
      return 'gemini-2.0-flash'
    default:
      return 'llama3.2'
  }
}
