'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Loader2,
  User,
  Users,
  Plus,
  Star,
  MapPin,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Check,
  Heart,
  PersonStanding,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { BrandName } from '@/components/BrandProvider'
import { logger } from '@/lib/logger'

interface Profile {
  id: string
  name: string
  relationship: string | null
  isDefault: boolean
  birthDate: string
  birthTime: string
  birthPlace: string
  zodiacSign?: string
}

const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Me', icon: User },
  { value: 'spouse', label: 'Spouse', icon: Heart },
  { value: 'partner', label: 'Partner', icon: Heart },
  { value: 'child', label: 'Child', icon: PersonStanding },
  { value: 'parent', label: 'Parent', icon: User },
  { value: 'friend', label: 'Friend', icon: Users },
  { value: 'other', label: 'Other', icon: Star },
]

export default function ProfilesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [_editingProfile, _setEditingProfile] = useState<Profile | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    relationship: 'self',
    birthDate: '',
    birthTime: '',
    birthPlace: '',
    latitude: '',
    longitude: '',
  })

  useEffect(() => {
    if (session?.user) {
      fetchProfiles()
    }
  }, [session])

  const fetchProfiles = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles?format=options')
      const data = await res.json()
      setProfiles(data.options || [])
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch profiles')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.birthDate || !formData.birthTime) {
      return
    }

    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setShowCreateModal(false)
        setFormData({
          name: '',
          relationship: 'self',
          birthDate: '',
          birthTime: '',
          birthPlace: '',
          latitude: '',
          longitude: '',
        })
        fetchProfiles()
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to create profile')
    }
  }

  const handleSetDefault = async (profileId: string) => {
    try {
      await fetch('/api/profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, setAsDefault: true }),
      })
      fetchProfiles()
    } catch (error) {
      logger.warn({ error }, 'Failed to set default profile')
    }
  }

  const handleDelete = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return

    try {
      await fetch(`/api/profiles?id=${profileId}`, { method: 'DELETE' })
      fetchProfiles()
    } catch (error: any) {
      alert(error.message)
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
              <span className="text-xl font-bold gradient-text">
                <BrandName short />
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/profile" className="text-purple-200 hover:text-white transition">
                Account
              </Link>
              <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-4xl font-bold gradient-text flex items-center gap-3">
                <Users className="w-10 h-10 text-purple-400" />
                Astro Profiles
              </h1>
              <p className="text-purple-200 mt-2">
                Manage birth charts for yourself and family members
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl transition"
            >
              <Plus className="w-5 h-5" />
              Add Profile
            </button>
          </motion.div>

          {/* Profiles List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile, index) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`glass rounded-2xl p-6 ${
                    profile.isDefault ? 'border-purple-500/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-600/30 flex items-center justify-center">
                        <Star className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                          {profile.name}
                          {profile.isDefault && (
                            <span className="text-xs bg-purple-600 px-2 py-1 rounded-full">
                              Default
                            </span>
                          )}
                        </h3>
                        <p className="text-purple-300 text-sm">
                          {RELATIONSHIP_OPTIONS.find(r => r.value === profile.relationship)
                            ?.label || 'Other'}
                          {profile.zodiacSign && ` • ${profile.zodiacSign}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!profile.isDefault && (
                        <button
                          onClick={() => handleSetDefault(profile.id)}
                          className="p-2 text-purple-300 hover:text-purple-100 hover:bg-purple-900/50 rounded-lg transition"
                          title="Set as default"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/profiles/${profile.id}`)}
                        className="p-2 text-purple-300 hover:text-purple-100 hover:bg-purple-900/50 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      {profiles.length > 1 && (
                        <button
                          onClick={() => handleDelete(profile.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-purple-300">
                      <Calendar className="w-4 h-4" />
                      {new Date(profile.birthDate).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 text-purple-300">
                      <Clock className="w-4 h-4" />
                      {profile.birthTime}
                    </div>
                    <div className="flex items-center gap-2 text-purple-300">
                      <MapPin className="w-4 h-4" />
                      {profile.birthPlace}
                    </div>
                  </div>
                </motion.div>
              ))}

              {profiles.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass rounded-2xl p-12 text-center"
                >
                  <Users className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Profiles Yet</h3>
                  <p className="text-purple-200 mb-6">
                    Create your first astro profile to start getting personalized readings
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl transition"
                  >
                    Create Your Profile
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass rounded-3xl p-8 max-w-md w-full"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Create New Profile</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., My Chart, Spouse, Child"
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Relationship
                  </label>
                  <select
                    value={formData.relationship}
                    onChange={e => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {RELATIONSHIP_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Birth Time
                  </label>
                  <input
                    type="time"
                    value={formData.birthTime}
                    onChange={e => setFormData({ ...formData, birthTime: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Birth Place
                  </label>
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={e => setFormData({ ...formData, birthPlace: e.target.value })}
                    placeholder="e.g., New York, USA"
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-purple-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl transition"
                >
                  Create Profile
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
