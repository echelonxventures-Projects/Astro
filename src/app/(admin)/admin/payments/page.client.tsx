'use client'

import {
  Sparkles,
  CreditCard,
  Building2,
  DollarSign,
  Activity,
  Plus,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { BrandName } from '@/components/BrandProvider'

interface User {
  email: string
  role: string
}

interface PaymentGateway {
  id: string
  name: string
  key: string
  description: string | null
  apiKey: string | null
  apiSecret: string | null
  publicKey: string | null
  webhookSecret: string | null
  isEnabled: boolean
  isDefault: boolean
  supportedCurrencies: string | null
  supportedCountries: string | null
  testMode: boolean
  sortOrder: number
  paymentMethods: PaymentMethod[]
}

interface PaymentMethod {
  id: string
  gatewayId: string
  name: string
  key: string
  description: string | null
  icon: string | null
  isEnabled: boolean
  sortOrder: number
}

interface GatewayPlan {
  id: string
  gatewayId: string
  planId: string
  gatewayPlanId: string
  name: string
  price: number
  currency: string
  interval: string
  isActive: boolean
  isPopular: boolean
  sortOrder: number
  gateway: {
    key: string
    name: string
  }
}

interface Transaction {
  id: string
  userId: string
  gatewayId: string
  amount: number
  currency: string
  status: string
  paymentMethod: string | null
  createdAt: string
  user: {
    email: string
    name: string | null
  }
  gateway: {
    name: string
    key: string
  }
}

interface PaymentsClientProps {
  user: User
  initialGateways: PaymentGateway[]
  initialPlans: GatewayPlan[]
  initialTransactions: Transaction[]
}

export default function PaymentsClient({
  initialGateways,
  initialPlans,
  initialTransactions,
}: PaymentsClientProps) {
  const [activeTab, setActiveTab] = useState<'gateways' | 'methods' | 'plans' | 'transactions'>(
    'gateways'
  )
  const [gateways, setGateways] = useState<PaymentGateway[]>(initialGateways)
  const [plans] = useState<GatewayPlan[]>(initialPlans)
  const [transactions] = useState<Transaction[]>(initialTransactions)
  const [editingGateway, setEditingGateway] = useState<Partial<PaymentGateway> | null>(null)
  const [showGatewayModal, setShowGatewayModal] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const toggleGateway = async (gateway: PaymentGateway) => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleGateway',
          id: gateway.id,
          isEnabled: !gateway.isEnabled,
        }),
      })

      if (!response.ok) throw new Error('Failed to update gateway')

      setGateways(gateways.map(g => (g.id === gateway.id ? { ...g, isEnabled: !g.isEnabled } : g)))
      setMessage({
        type: 'success',
        text: `Gateway ${!gateway.isEnabled ? 'enabled' : 'disabled'}`,
      })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update gateway',
      })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const setDefaultGateway = async (gateway: PaymentGateway) => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setDefaultGateway',
          id: gateway.id,
        }),
      })

      if (!response.ok) throw new Error('Failed to set default gateway')

      setGateways(gateways.map(g => ({ ...g, isDefault: g.id === gateway.id })))
      setMessage({ type: 'success', text: 'Default gateway updated' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to set default gateway',
      })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const openEditGateway = (gateway: PaymentGateway) => {
    setEditingGateway({ ...gateway })
    setShowGatewayModal(true)
  }

  const saveGateway = async () => {
    if (!editingGateway) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingGateway.id ? 'updateGateway' : 'createGateway',
          ...editingGateway,
        }),
      })

      if (!response.ok) throw new Error('Failed to save gateway')

      setGateways(prev => {
        if (editingGateway.id) {
          return prev.map(g =>
            g.id === editingGateway.id ? ({ ...g, ...editingGateway } as PaymentGateway) : g
          )
        }
        return [...prev, editingGateway as PaymentGateway]
      })
      setShowGatewayModal(false)
      setEditingGateway(null)
      setMessage({ type: 'success', text: 'Gateway saved' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save gateway',
      })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const togglePaymentMethod = async (
    gatewayId: string,
    methodId: string,
    currentStatus: boolean
  ) => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'togglePaymentMethod',
          gatewayId,
          methodId,
          isEnabled: !currentStatus,
        }),
      })

      if (!response.ok) throw new Error('Failed to update payment method')

      setGateways(
        gateways.map(g => {
          if (g.id !== gatewayId) return g
          return {
            ...g,
            paymentMethods: g.paymentMethods.map(m =>
              m.id === methodId ? { ...m, isEnabled: !currentStatus } : m
            ),
          }
        })
      )
      setMessage({
        type: 'success',
        text: `Payment method ${!currentStatus ? 'enabled' : 'disabled'}`,
      })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update payment method',
      })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      success: 'bg-green-500/20 text-green-400 border-green-500/50',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      failed: 'bg-red-500/20 text-red-400 border-red-500/50',
      refunded: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    }
    return colors[status.toLowerCase()] || 'bg-gray-500/20 text-gray-400 border-gray-500/50'
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: `${label} copied` })
    setTimeout(() => setMessage(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-xl font-bold gradient-text">
                <BrandName short /> Payments
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/admin/plans" className="text-purple-200 hover:text-white transition">
                Plans
              </Link>
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
            <h1 className="text-4xl font-bold mb-2 gradient-text">Payment Gateway Management</h1>
            <p className="text-purple-200">
              Configure payment gateways, methods, and view transactions
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mb-6 p-4 border rounded-xl flex items-center justify-between ${
                message.type === 'success'
                  ? 'bg-green-500/20 border-green-500/50 text-green-200'
                  : 'bg-red-500/20 border-red-500/50 text-red-200'
              }`}
            >
              <span>{message.text}</span>
              <button onClick={() => setMessage(null)} className="hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-purple-500/20 pb-4">
            <button
              onClick={() => setActiveTab('gateways')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                activeTab === 'gateways'
                  ? 'bg-purple-500/30 text-white'
                  : 'text-purple-300 hover:bg-purple-500/20'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Gateways
            </button>
            <button
              onClick={() => setActiveTab('methods')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                activeTab === 'methods'
                  ? 'bg-purple-500/30 text-white'
                  : 'text-purple-300 hover:bg-purple-500/20'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Payment Methods
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                activeTab === 'plans'
                  ? 'bg-purple-500/30 text-white'
                  : 'text-purple-300 hover:bg-purple-500/20'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Gateway Plans
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                activeTab === 'transactions'
                  ? 'bg-purple-500/30 text-white'
                  : 'text-purple-300 hover:bg-purple-500/20'
              }`}
            >
              <Activity className="w-4 h-4" />
              Transactions
            </button>
          </div>

          {/* Gateways Tab */}
          {activeTab === 'gateways' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Payment Gateways</h2>
                <button
                  onClick={() => {
                    setEditingGateway({
                      name: '',
                      key: '',
                      description: '',
                      isEnabled: true,
                      isDefault: false,
                      testMode: false,
                      sortOrder: gateways.length,
                      supportedCurrencies: '[]',
                      supportedCountries: '[]',
                    })
                    setShowGatewayModal(true)
                  }}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Gateway
                </button>
              </div>

              <div className="grid gap-4">
                {gateways.map(gateway => (
                  <div
                    key={gateway.id}
                    className="p-6 rounded-xl glass border border-purple-500/20"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{gateway.name}</h3>
                          {gateway.isDefault && (
                            <span className="px-2 py-1 bg-purple-500/30 text-purple-200 text-xs rounded-full">
                              Default
                            </span>
                          )}
                          {gateway.testMode && (
                            <span className="px-2 py-1 bg-yellow-500/30 text-yellow-200 text-xs rounded-full">
                              Test Mode
                            </span>
                          )}
                        </div>
                        <p className="text-purple-200 text-sm mb-2">{gateway.description}</p>
                        <div className="flex gap-4 text-sm text-purple-300">
                          <span>
                            Key:{' '}
                            <code className="bg-purple-500/20 px-2 py-1 rounded">
                              {gateway.key}
                            </code>
                          </span>
                          <span>
                            Methods: {gateway.paymentMethods.filter(m => m.isEnabled).length}{' '}
                            enabled
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleGateway(gateway)}
                          className={`px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                            gateway.isEnabled
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          {gateway.isEnabled ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                          {gateway.isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                        {!gateway.isDefault && (
                          <button
                            onClick={() => setDefaultGateway(gateway)}
                            className="px-3 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg transition"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => openEditGateway(gateway)}
                          className="px-3 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Methods Tab */}
          {activeTab === 'methods' && (
            <div className="space-y-6">
              {gateways.map(gateway => (
                <div key={gateway.id} className="p-6 rounded-xl glass border border-purple-500/20">
                  <h3 className="text-xl font-bold text-white mb-4">
                    {gateway.name} - Payment Methods
                  </h3>
                  <div className="grid gap-3">
                    {gateway.paymentMethods.map(method => (
                      <div
                        key={method.id}
                        className="flex justify-between items-center p-4 rounded-lg bg-purple-500/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{method.name}</h4>
                            <p className="text-sm text-purple-300">{method.key}</p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            togglePaymentMethod(gateway.id, method.id, method.isEnabled)
                          }
                          className={`px-4 py-2 rounded-lg transition ${
                            method.isEnabled
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {method.isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gateway Plans Tab */}
          {activeTab === 'plans' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Gateway-Specific Plans</h2>
              <div className="grid gap-4">
                {plans.map(plan => (
                  <div key={plan.id} className="p-6 rounded-xl glass border border-purple-500/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                          {plan.isPopular && (
                            <span className="px-2 py-1 bg-purple-500/30 text-purple-200 text-xs rounded-full">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-purple-300 mb-2">
                          Gateway: <span className="text-white">{plan.gateway.name}</span>
                        </p>
                        <p className="text-sm text-purple-400">
                          Plan ID:{' '}
                          <code className="bg-purple-500/20 px-2 py-1 rounded">
                            {plan.gatewayPlanId}
                          </code>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-400">
                          {formatCurrency(plan.price, plan.currency)}
                        </p>
                        <p className="text-sm text-purple-300 capitalize">{plan.interval}</p>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            plan.isActive
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Recent Transactions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="text-left text-purple-300 border-b border-purple-500/20">
                    <tr>
                      <th className="pb-3 font-semibold">User</th>
                      <th className="pb-3 font-semibold">Gateway</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Method</th>
                      <th className="pb-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id} className="border-b border-purple-500/10">
                        <td className="py-3 text-white">
                          <div>
                            <div className="font-medium">{tx.user.name || tx.user.email}</div>
                            <div className="text-sm text-purple-400">{tx.user.email}</div>
                          </div>
                        </td>
                        <td className="py-3 text-purple-300">{tx.gateway.name}</td>
                        <td className="py-3 text-white font-medium">
                          {formatCurrency(tx.amount, tx.currency)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs border ${getStatusColor(tx.status)}`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 text-purple-300 capitalize">
                          {tx.paymentMethod || 'N/A'}
                        </td>
                        <td className="py-3 text-purple-400 text-sm">
                          {new Date(tx.createdAt).toLocaleDateString()}{' '}
                          {new Date(tx.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Gateway Modal */}
      {showGatewayModal && editingGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 rounded-xl border border-purple-500/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-purple-500/20 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {editingGateway.id ? 'Edit Gateway' : 'Add Gateway'}
              </h3>
              <button
                onClick={() => setShowGatewayModal(false)}
                className="text-purple-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-purple-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editingGateway.name || ''}
                  onChange={e => setEditingGateway({ ...editingGateway, name: e.target.value })}
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-purple-300 mb-1">
                  Key (internal identifier)
                </label>
                <input
                  type="text"
                  value={editingGateway.key || ''}
                  onChange={e => setEditingGateway({ ...editingGateway, key: e.target.value })}
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g., stripe, razorpay"
                />
              </div>
              <div>
                <label className="block text-sm text-purple-300 mb-1">Description</label>
                <textarea
                  value={editingGateway.description || ''}
                  onChange={e =>
                    setEditingGateway({ ...editingGateway, description: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-purple-300 mb-1">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type={showKeys[editingGateway.id || 'new'] ? 'text' : 'password'}
                      value={editingGateway.apiKey || ''}
                      onChange={e =>
                        setEditingGateway({ ...editingGateway, apiKey: e.target.value })
                      }
                      className="flex-1 bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() =>
                        setShowKeys({
                          ...showKeys,
                          [editingGateway.id || 'new']: !showKeys[editingGateway.id || 'new'],
                        })
                      }
                      className="px-3 bg-purple-500/20 text-purple-400 rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-purple-300 mb-1">API Secret</label>
                  <div className="flex gap-2">
                    <input
                      type={showKeys[editingGateway.id || 'new'] ? 'text' : 'password'}
                      value={editingGateway.apiSecret || ''}
                      onChange={e =>
                        setEditingGateway({ ...editingGateway, apiSecret: e.target.value })
                      }
                      className="flex-1 bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() =>
                        setShowKeys({
                          ...showKeys,
                          [editingGateway.id || 'new']: !showKeys[editingGateway.id || 'new'],
                        })
                      }
                      className="px-3 bg-purple-500/20 text-purple-400 rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-purple-300 mb-1">
                  Public Key (e.g., Razorpay Key ID)
                </label>
                <input
                  type="text"
                  value={editingGateway.publicKey || ''}
                  onChange={e =>
                    setEditingGateway({ ...editingGateway, publicKey: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-purple-300 mb-1">Webhook Secret</label>
                <div className="flex gap-2">
                  <input
                    type={showKeys[editingGateway.id || 'new'] ? 'text' : 'password'}
                    value={editingGateway.webhookSecret || ''}
                    onChange={e =>
                      setEditingGateway({ ...editingGateway, webhookSecret: e.target.value })
                    }
                    className="flex-1 bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={() =>
                      copyToClipboard(editingGateway.webhookSecret || '', 'Webhook secret')
                    }
                    className="px-3 bg-purple-500/20 text-purple-400 rounded-lg"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-purple-300 mb-1">
                    Supported Currencies (JSON)
                  </label>
                  <textarea
                    value={editingGateway.supportedCurrencies || '[]'}
                    onChange={e =>
                      setEditingGateway({ ...editingGateway, supportedCurrencies: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                    rows={2}
                    placeholder='["USD", "EUR", "INR"]'
                  />
                </div>
                <div>
                  <label className="block text-sm text-purple-300 mb-1">
                    Supported Countries (JSON)
                  </label>
                  <textarea
                    value={editingGateway.supportedCountries || '[]'}
                    onChange={e =>
                      setEditingGateway({ ...editingGateway, supportedCountries: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                    rows={2}
                    placeholder='["US", "GB", "IN"]'
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-purple-300">
                  <input
                    type="checkbox"
                    checked={editingGateway.isEnabled || false}
                    onChange={e =>
                      setEditingGateway({ ...editingGateway, isEnabled: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-purple-300">
                  <input
                    type="checkbox"
                    checked={editingGateway.isDefault || false}
                    onChange={e =>
                      setEditingGateway({ ...editingGateway, isDefault: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  Default
                </label>
                <label className="flex items-center gap-2 text-purple-300">
                  <input
                    type="checkbox"
                    checked={editingGateway.testMode || false}
                    onChange={e =>
                      setEditingGateway({ ...editingGateway, testMode: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  Test Mode
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-purple-500/20 flex justify-end gap-3">
              <button
                onClick={() => setShowGatewayModal(false)}
                className="px-4 py-2 text-purple-300 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={saveGateway}
                disabled={saving}
                className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Gateway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
