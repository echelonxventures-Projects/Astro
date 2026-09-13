'use client'

import { Heart, Loader2, Sparkles, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { BrandName } from '@/components/BrandProvider'

export default function LoveHoroscopePage() {
  const { data: _session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reading, setReading] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const generateReading = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/astrology/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'love' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate reading')
      }

      const data = await response.json()
      setReading(data)
    } catch (err: any) {
      setError(err.message)
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
                <BrandName />
              </span>
            </Link>
            <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600/30 rounded-full mb-4">
              <Heart className="w-5 h-5 text-pink-400" />
              <span className="text-sm font-medium">Love & Relationships</span>
            </div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Love Horoscope</h1>
            <p className="text-purple-200">
              Discover what the stars reveal about your romantic life
            </p>
          </div>

          {!reading && !loading && (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="w-24 h-24 rounded-full bg-pink-600/30 flex items-center justify-center mx-auto mb-6">
                <Heart className="w-12 h-12 text-pink-400" />
              </div>
              <p className="text-purple-200 mb-6 max-w-md mx-auto">
                Explore your romantic nature, compatibility patterns, and what the cosmos has
                aligned for your love life.
              </p>
              <button
                onClick={generateReading}
                className="bg-pink-600 hover:bg-pink-500 text-white px-8 py-4 rounded-full font-semibold transition"
              >
                Generate Love Reading
              </button>
              <Link href="/compatibility" className="block mt-4 text-pink-400 hover:text-pink-300">
                Or check compatibility with a partner →
              </Link>
            </div>
          )}

          {loading && (
            <div className="glass rounded-2xl p-12 text-center">
              <Loader2 className="w-12 h-12 text-pink-400 animate-spin mx-auto mb-4" />
              <p className="text-purple-200">Consulting Venus and Mars...</p>
            </div>
          )}

          {error && (
            <div className="glass rounded-2xl p-8">
              <div className="text-center">
                <p className="text-red-300 mb-4">{error}</p>
                <button
                  onClick={generateReading}
                  className="bg-pink-600 hover:bg-pink-500 text-white px-6 py-2 rounded-full transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {reading && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-pink-600/50 to-rose-600/50 p-6">
                <h2 className="text-xl font-bold">{reading.title}</h2>
                <p className="text-purple-200 text-sm">
                  Generated {new Date(reading.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="p-6">
                <div className="prose prose-invert max-w-none">
                  {reading.content.split('\n').map((paragraph: string, i: number) => (
                    <p key={i} className="text-purple-100 mb-4 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-purple-500/20">
                  <Link
                    href="/compatibility"
                    className="flex items-center gap-2 p-4 bg-purple-600/20 hover:bg-purple-600/30 rounded-xl transition"
                  >
                    <Users className="w-6 h-6 text-purple-400" />
                    <div>
                      <span className="font-medium block">Compatibility Reading</span>
                      <span className="text-sm text-purple-300">
                        Compare charts with your partner
                      </span>
                    </div>
                  </Link>
                </div>

                <button
                  onClick={generateReading}
                  className="w-full mt-6 bg-pink-600/50 hover:bg-pink-600 text-white py-3 rounded-xl font-semibold transition"
                >
                  Generate New Reading
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
