'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Plus, Edit, Trash2, Save, Loader2, X, Check, DollarSign, Star } from 'lucide-react'

interface User {
  email: string
  role: string
}

interface Plan {
  id: string
  name: string
  key: string
  description: string | null
  price: number
  currency: string
  interval: string | null
  stripePriceId: string | null
  isActive: boolean
  isPopular: boolean
  sortOrder: number
  features: string[]
  aiConfig: {
    provider: string
    model: string
    maxTokens: number
  } | null
}

interface Feature {
  id: string
  name: string
  key: string
  description: string | null
  category: string | null
  sortOrder: number
  isActive: boolean
}

interface FeatureAccess {
  featureId: string
  enabled: boolean
  value: string | undefined | null
}

interface Region {
  id: string
  name: string
  key: string
  code: string
  currency: string
  currencies: Array<{ code: string; symbol: string; name: string }> | null
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  priceMultiplier: number
}

export default function AdminPlansClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null)
  const [editingFeature, setEditingFeature] = useState<Partial<Feature> | null>(null)
  const [featureAccess, setFeatureAccess] = useState<Record<string, FeatureAccess>>({})
  const [showFeatureModal, setShowFeatureModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showRegionModal, setShowRegionModal] = useState(false)
  const [editingRegion, setEditingRegion] = useState<Partial<Region> | null>(null)
  const [regions, setRegions] = useState<Region[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Server already authenticated, just load data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/plans')
      const data = await response.json()
      setPlans(data.plans || [])
      setFeatures(data.features || [])
      setRegions(data.regions || [])
    } catch {
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const savePlan = async () => {
    if (!editingPlan) return
    setSaving(true)
    setError('')

    try {
      const isUpdate = !!editingPlan.id
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isUpdate ? 'updatePlan' : 'createPlan',
          ...editingPlan,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save plan')
      }

      setSuccess(isUpdate ? 'Plan updated successfully' : 'Plan created successfully')
      setShowPlanModal(false)
      setEditingPlan(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  const saveFeature = async () => {
    if (!editingFeature) return
    setSaving(true)
    setError('')

    try {
      const isUpdate = !!editingFeature.id
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isUpdate ? 'updateFeature' : 'createFeature',
          ...editingFeature,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save feature')
      }

      setSuccess(isUpdate ? 'Feature updated successfully' : 'Feature created successfully')
      setShowFeatureModal(false)
      setEditingFeature(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feature')
    } finally {
      setSaving(false)
    }
  }

  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return

    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deletePlan',
          id: planId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete plan')
      }

      setSuccess('Plan deleted successfully')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan')
    }
  }

  const deleteFeature = async (featureId: string) => {
    if (!confirm('Are you sure you want to delete this feature?')) return

    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteFeature',
          id: featureId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete feature')
      }

      setSuccess('Feature deleted successfully')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feature')
    }
  }

  const saveRegion = async () => {
    if (!editingRegion) return
    setSaving(true)
    setError('')

    try {
      const isUpdate = !!editingRegion.id
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isUpdate ? 'updateRegion' : 'createRegion',
          ...editingRegion,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save region')
      }

      setSuccess(isUpdate ? 'Region updated successfully' : 'Region created successfully')
      setShowRegionModal(false)
      setEditingRegion(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save region')
    } finally {
      setSaving(false)
    }
  }

  const deleteRegion = async (regionId: string) => {
    if (!confirm('Are you sure you want to delete this region?')) return

    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteRegion',
          id: regionId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete region')
      }

      setSuccess('Region deleted successfully')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete region')
    }
  }

  const updateFeatureAccess = async (planId: string, featureId: string, enabled: boolean, value?: string) => {
    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setFeatureAccess',
          planId,
          featureId,
          enabled,
          value,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update feature access')
      }

      setSuccess('Feature access updated')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature access')
    }
  }

  const openNewPlanModal = () => {
    setEditingPlan({
      name: '',
      key: '',
      description: '',
      price: 0,
      currency: 'usd',
      interval: null,
      stripePriceId: '',
      isActive: true,
      isPopular: false,
      sortOrder: 0,
      features: [],
      aiConfig: null,
    })
    setShowPlanModal(true)
  }

  const openEditPlanModal = (plan: Plan) => {
    setEditingPlan({ ...plan })
    setShowPlanModal(true)
  }

  const openNewFeatureModal = () => {
    setEditingFeature({
      name: '',
      key: '',
      description: '',
      category: '',
      sortOrder: 0,
      isActive: true,
    })
    setShowFeatureModal(true)
  }

  const openEditFeatureModal = (feature: Feature) => {
    setEditingFeature({ ...feature })
    setShowFeatureModal(true)
  }

  const openNewRegionModal = () => {
    setEditingRegion({
      name: '',
      key: '',
      code: '',
      currency: 'usd',
      currencies: [],
      isActive: true,
      isDefault: false,
      sortOrder: 0,
      priceMultiplier: 1.0,
    })
    setShowRegionModal(true)
  }

  const openEditRegionModal = (region: Region) => {
    setEditingRegion({ ...region })
    setShowRegionModal(true)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-xl font-bold gradient-text">StarPath Astrology Admin</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/settings" className="text-purple-200 hover:text-white transition">
                AI Settings
              </Link>
              <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
                Back to App
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 gradient-text">Subscription Plans Manager</h1>
            <p className="text-purple-200">Configure pricing plans and feature comparison table</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-200">
              {success}
            </div>
          )}

          {/* Plans Section */}
          <div className="glass rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Subscription Plans</h2>
              <button
                onClick={openNewPlanModal}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl transition"
              >
                <Plus className="w-5 h-5" />
                Add Plan
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-white/5 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold">{plan.name}</h3>
                    {plan.isPopular && (
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    )}
                  </div>
                  <p className="text-sm text-purple-300 mb-2">{plan.key}</p>
                  <p className="text-xl font-bold mb-2">
                    {plan.price === 0 ? 'Free' : `$${(plan.price / 100).toFixed(2)}`}
                    {plan.interval && <span className="text-sm text-purple-300">/{plan.interval}</span>}
                  </p>
                  <p className="text-sm text-purple-200 mb-4">{plan.description}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditPlanModal(plan)}
                      className="flex-1 flex items-center justify-center gap-1 bg-purple-600/50 hover:bg-purple-600 px-3 py-2 rounded-lg transition text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => deletePlan(plan.id)}
                      className="flex items-center justify-center gap-1 bg-red-600/50 hover:bg-red-600 px-3 py-2 rounded-lg transition text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Features Section */}
          <div className="glass rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Features for Comparison Table</h2>
              <button
                onClick={openNewFeatureModal}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl transition"
              >
                <Plus className="w-5 h-5" />
                Add Feature
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-500/20">
                    <th className="text-left py-3 px-4">Feature Name</th>
                    <th className="text-left py-3 px-4">Key</th>
                    <th className="text-left py-3 px-4">Category</th>
                    <th className="text-center py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => (
                    <tr key={feature.id} className="border-b border-purple-500/10">
                      <td className="py-3 px-4">{feature.name}</td>
                      <td className="py-3 px-4 font-mono text-sm">{feature.key}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-purple-600/30 rounded-full text-xs">
                          {feature.category || 'general'}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openEditFeatureModal(feature)}
                            className="p-2 hover:bg-purple-600/30 rounded-lg transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteFeature(feature.id)}
                            className="p-2 hover:bg-red-600/30 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Regions Section */}
          <div className="glass rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Regions & Currencies</h2>
              <button
                onClick={openNewRegionModal}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl transition"
              >
                <Plus className="w-5 h-5" />
                Add Region
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-500/20">
                    <th className="text-left py-3 px-4">Region</th>
                    <th className="text-left py-3 px-4">Code</th>
                    <th className="text-left py-3 px-4">Currency</th>
                    <th className="text-center py-3 px-4">Default</th>
                    <th className="text-center py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((region) => (
                    <tr key={region.id} className="border-b border-purple-500/10">
                      <td className="py-3 px-4">{region.name}</td>
                      <td className="py-3 px-4 font-mono text-sm">{region.code}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-purple-600/30 rounded-full text-xs uppercase">
                          {region.currency}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        {region.isDefault ? (
                          <Check className="w-5 h-5 text-green-400 mx-auto" />
                        ) : (
                          <span className="text-purple-400">—</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openEditRegionModal(region)}
                            className="p-2 hover:bg-purple-600/30 rounded-lg transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteRegion(region.id)}
                            className="p-2 hover:bg-red-600/30 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Feature Access Matrix */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6">Feature Access Matrix</h2>
            <p className="text-purple-200 mb-4">
              Configure which features are available for each plan
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-500/20">
                    <th className="text-left py-3 px-4">Feature</th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="text-center py-3 px-4">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => (
                    <tr key={feature.id} className="border-b border-purple-500/10">
                      <td className="py-3 px-4">{feature.name}</td>
                      {plans.map((plan) => {
                        const access = featureAccess[`${plan.id}-${feature.id}`]
                        return (
                          <td key={plan.id} className="text-center py-3 px-4">
                            <label className="flex items-center justify-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={access?.enabled || false}
                                onChange={(e) => {
                                  setFeatureAccess({
                                    ...featureAccess,
                                    [`${plan.id}-${feature.id}`]: {
                                      featureId: feature.id,
                                      enabled: e.target.checked,
                                      value: null,
                                    },
                                  })
                                  updateFeatureAccess(plan.id, feature.id, e.target.checked)
                                }}
                                className="w-5 h-5 rounded"
                              />
                              <input
                                type="text"
                                placeholder="Value (optional)"
                                value={access?.value || ''}
                                onChange={(e) => {
                                  setFeatureAccess({
                                    ...featureAccess,
                                    [`${plan.id}-${feature.id}`]: {
                                      featureId: feature.id,
                                      enabled: access?.enabled || false,
                                      value: e.target.value || undefined,
                                    },
                                  })
                                }}
                                onBlur={(e) => {
                                  updateFeatureAccess(
                                    plan.id,
                                    feature.id,
                                    access?.enabled || false,
                                    e.target.value || undefined
                                  )
                                }}
                                className="w-24 px-2 py-1 bg-white/10 rounded text-sm"
                              />
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Modal */}
      {showPlanModal && editingPlan && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">
                {editingPlan.id ? 'Edit Plan' : 'New Plan'}
              </h3>
              <button onClick={() => setShowPlanModal(false)} className="hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Plan Name *</label>
                <input
                  type="text"
                  value={editingPlan.name || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="e.g., Premium Monthly"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Plan Key *</label>
                <input
                  type="text"
                  value={editingPlan.key || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, key: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="e.g., monthly"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Description</label>
                <textarea
                  value={editingPlan.description || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    <DollarSign className="inline w-4 h-4 mr-1" />
                    Price (in cents)
                  </label>
                  <input
                    type="number"
                    value={editingPlan.price || 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Billing Interval</label>
                  <select
                    value={editingPlan.interval || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, interval: e.target.value || null })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  >
                    <option value="">One-time / Free</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Stripe Price ID</label>
                <input
                  type="text"
                  value={editingPlan.stripePriceId || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, stripePriceId: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="price_..."
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.isPopular || false}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isPopular: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-purple-200">Most Popular (show badge)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.isActive || true}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-purple-200">Active</span>
                </label>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={savePlan}
                  disabled={saving || !editingPlan.name || !editingPlan.key}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 disabled:opacity-50 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Plan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Modal */}
      {showFeatureModal && editingFeature && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">
                {editingFeature.id ? 'Edit Feature' : 'New Feature'}
              </h3>
              <button onClick={() => setShowFeatureModal(false)} className="hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Feature Name *</label>
                <input
                  type="text"
                  value={editingFeature.name || ''}
                  onChange={(e) => setEditingFeature({ ...editingFeature, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="e.g., Daily Horoscope"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Feature Key *</label>
                <input
                  type="text"
                  value={editingFeature.key || ''}
                  onChange={(e) => setEditingFeature({ ...editingFeature, key: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="e.g., daily_horoscope"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Category</label>
                <input
                  type="text"
                  value={editingFeature.category || ''}
                  onChange={(e) => setEditingFeature({ ...editingFeature, category: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="e.g., readings, ai, support"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingFeature.isActive !== false}
                    onChange={(e) => setEditingFeature({ ...editingFeature, isActive: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-purple-200">Active</span>
                </label>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowFeatureModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFeature}
                  disabled={saving || !editingFeature.name || !editingFeature.key}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 disabled:opacity-50 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Feature
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Region Modal */}
      {showRegionModal && editingRegion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">
                {editingRegion.id ? 'Edit Region' : 'New Region'}
              </h3>
              <button onClick={() => setShowRegionModal(false)} className="hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Region Name *</label>
                <input
                  type="text"
                  value={editingRegion.name || ''}
                  onChange={(e) => setEditingRegion({ ...editingRegion, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="e.g., United States, Europe, India"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Region Key *</label>
                  <input
                    type="text"
                    value={editingRegion.key || ''}
                    onChange={(e) => setEditingRegion({ ...editingRegion, key: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                    placeholder="e.g., us, eu, in"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Country Code *</label>
                  <input
                    type="text"
                    value={editingRegion.code || ''}
                    onChange={(e) => setEditingRegion({ ...editingRegion, code: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                    placeholder="e.g., US, EU, IN"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Default Currency</label>
                <select
                  value={editingRegion.currency || 'usd'}
                  onChange={(e) => setEditingRegion({ ...editingRegion, currency: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value="usd">USD - US Dollar</option>
                  <option value="eur">EUR - Euro</option>
                  <option value="gbp">GBP - British Pound</option>
                  <option value="inr">INR - Indian Rupee</option>
                  <option value="jpy">JPY - Japanese Yen</option>
                  <option value="aud">AUD - Australian Dollar</option>
                  <option value="cad">CAD - Canadian Dollar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Price Multiplier</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingRegion.priceMultiplier || 1.0}
                  onChange={(e) => setEditingRegion({ ...editingRegion, priceMultiplier: parseFloat(e.target.value) || 1.0 })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="1.0"
                />
                <p className="text-xs text-purple-300 mt-1">
                  Used to calculate regional prices (e.g., 83.5 for INR conversion)
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRegion.isDefault || false}
                    onChange={(e) => setEditingRegion({ ...editingRegion, isDefault: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-purple-200">Default Region</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRegion.isActive !== false}
                    onChange={(e) => setEditingRegion({ ...editingRegion, isActive: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-purple-200">Active</span>
                </label>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowRegionModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRegion}
                  disabled={saving || !editingRegion.name || !editingRegion.key || !editingRegion.code}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 disabled:opacity-50 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Region
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
