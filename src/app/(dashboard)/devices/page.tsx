'use client'

import { motion } from 'framer-motion'
import {
  Sparkles,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  MapPin,
  Clock,
  AlertTriangle,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'

interface Device {
  id: string
  deviceName: string | null
  deviceType: string | null
  browser: string | null
  os: string | null
  ipAddress: string | null
  location: string | null
  lastActiveAt: string
  isActive: boolean
  createdAt: string
}

export default function DevicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      fetchDevices()
    }
  }, [session])

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      setDevices(data.devices || [])
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch devices')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this device? You will be logged out from it.'))
      return

    setRevoking(deviceId)
    try {
      await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', deviceId }),
      })
      fetchDevices()
    } catch (error) {
      logger.warn({ error }, 'Failed to revoke device')
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeOthers = async () => {
    if (!confirm('Are you sure you want to revoke all other devices?')) return

    setRevoking('all')
    try {
      await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revokeOthers',
          currentSessionId: 'current', // Will be replaced with actual session ID
        }),
      })
      fetchDevices()
    } catch (error) {
      logger.warn({ error }, 'Failed to revoke other devices')
    } finally {
      setRevoking(null)
    }
  }

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case 'mobile':
        return Smartphone
      case 'tablet':
        return Tablet
      default:
        return Monitor
    }
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-xl font-bold gradient-text">StarPath</span>
            </Link>
            <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold gradient-text flex items-center gap-3">
              <Monitor className="w-10 h-10 text-purple-400" />
              Active Devices
            </h1>
            <p className="text-purple-200 mt-2">Manage devices that have access to your account</p>
          </motion.div>

          {/* Security Notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-4 mb-6 border border-yellow-500/30"
          >
            <AlertTriangle className="w-5 h-5 text-yellow-400 mb-2" />
            <p className="text-yellow-200 text-sm">
              If you notice any unfamiliar devices, revoke them immediately and change your
              password.
            </p>
          </motion.div>

          {/* Revoke All Button */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
            <button
              onClick={handleRevokeOthers}
              disabled={revoking === 'all'}
              className="text-sm text-purple-300 hover:text-red-400 transition flex items-center gap-2"
            >
              {revoking === 'all' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Sign out all other devices
            </button>
          </motion.div>

          {/* Devices List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device, index) => {
                const DeviceIcon = getDeviceIcon(device.deviceType)
                const isCurrent = index === 0 // First device is current

                return (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`glass rounded-2xl p-6 ${isCurrent ? 'border-green-500/30' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isCurrent ? 'bg-green-600/30' : 'bg-purple-600/30'
                          }`}
                        >
                          <DeviceIcon
                            className={`w-6 h-6 ${
                              isCurrent ? 'text-green-400' : 'text-purple-400'
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                            {device.deviceName || 'Unknown Device'}
                            {isCurrent && (
                              <span className="text-xs bg-green-600 px-2 py-1 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Current
                              </span>
                            )}
                          </h3>
                          <p className="text-purple-300 text-sm">
                            {device.browser} on {device.os}
                          </p>
                        </div>
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={() => handleRevoke(device.id)}
                          disabled={revoking === device.id}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded-lg transition"
                          title="Revoke"
                        >
                          {revoking === device.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-purple-300">
                        <MapPin className="w-4 h-4" />
                        {device.location || device.ipAddress || 'Unknown location'}
                      </div>
                      <div className="flex items-center gap-2 text-purple-300">
                        <Clock className="w-4 h-4" />
                        Last active: {new Date(device.lastActiveAt).toLocaleString()}
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {devices.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass rounded-2xl p-12 text-center"
                >
                  <Monitor className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Devices Found</h3>
                  <p className="text-purple-200">You have no active sessions on other devices</p>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
