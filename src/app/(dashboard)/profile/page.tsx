'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Sparkles, Loader2, Save, User, Mail, MapPin, Calendar } from 'lucide-react'
import { logger } from '@/lib/logger'

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    birthDate: '',
    birthTime: '',
    birthPlace: '',
    latitude: '',
    longitude: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Update session
      await update({
        ...session,
        user: {
          ...session?.user,
          name: formData.name,
        },
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      logger.warn('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    )
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
              <span className="text-xl font-bold gradient-text">StarPath Astrology</span>
            </Link>
            <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 gradient-text">Profile Settings</h1>

          <div className="glass rounded-3xl p-8 mb-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              Account Information
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-purple-300 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-purple-400 mt-1">Email cannot be changed</p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>
                {saved && (
                  <span className="ml-4 text-green-400">Profile updated successfully!</span>
                )}
              </div>
            </form>
          </div>

          {/* Birth Details */}
          <div className="glass rounded-3xl p-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              Birth Details
            </h2>
            <p className="text-purple-200 mb-6">
              Your birth details are stored in your birth chart. To update them, create a new
              birth chart with updated information.
            </p>
            <Link
              href="/chart"
              className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-semibold transition"
            >
              Create/Update Birth Chart
            </Link>
          </div>

          {/* Danger Zone */}
          <div className="glass rounded-3xl p-8 mt-8 border border-red-500/30">
            <h2 className="text-xl font-semibold mb-4 text-red-400">Danger Zone</h2>
            <p className="text-purple-200 mb-4">
              Once you delete your account, there is no going back. All your data, including
              birth charts and readings, will be permanently removed.
            </p>
            <button className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-semibold transition">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
