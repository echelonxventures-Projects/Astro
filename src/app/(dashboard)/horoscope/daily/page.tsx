'use client'

import { Sparkles, Loader2, Heart, Briefcase, Share2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'

export default function DailyHoroscopePage() {
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
        body: JSON.stringify({ type: 'daily' }),
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

  const handleShare = async () => {
    if (navigator.share && reading) {
      await navigator.share({
        title: reading.title,
        text: reading.content.slice(0, 100) + '...',
        url: window.location.href,
      })
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
              <span className="text-xl font-bold gradient-text">StarPath Astrology</span>
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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/30 rounded-full mb-4">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium">Daily Horoscope</span>
            </div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h1>
            <p className="text-purple-200">Your personalized cosmic guidance for today</p>
          </div>

          {/* Generate Button */}
          {!reading && !loading && (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="w-24 h-24 rounded-full bg-purple-600/30 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-12 h-12 text-purple-400" />
              </div>
              <p className="text-purple-200 mb-6 max-w-md mx-auto">
                Ready to discover what the stars have aligned for you today? Generate your
                personalized daily horoscope based on your birth chart.
              </p>
              <button
                onClick={generateReading}
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-full font-semibold transition pulse-glow"
              >
                Generate Your Reading
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="glass rounded-2xl p-12 text-center">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-purple-200">Consulting the stars...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="glass rounded-2xl p-8">
              <div className="text-center">
                <p className="text-red-300 mb-4">{error}</p>
                <button
                  onClick={generateReading}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Reading */}
          {reading && (
            <div className="glass rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600/50 to-indigo-600/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{reading.title}</h2>
                    <p className="text-purple-200 text-sm">
                      Generated {new Date(reading.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={handleShare}
                    className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="prose prose-invert max-w-none">
                  {reading.content.split('\n').map((paragraph: string, i: number) => (
                    <p key={i} className="text-purple-100 mb-4 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* More Readings */}
                <div className="mt-8 pt-6 border-t border-purple-500/20">
                  <h3 className="text-lg font-semibold mb-4">More Readings</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href="/horoscope/love"
                      className="flex items-center gap-2 p-3 bg-pink-600/20 hover:bg-pink-600/30 rounded-xl transition"
                    >
                      <Heart className="w-5 h-5 text-pink-400" />
                      <span>Love Reading</span>
                    </Link>
                    <Link
                      href="/horoscope/career"
                      className="flex items-center gap-2 p-3 bg-indigo-600/20 hover:bg-indigo-600/30 rounded-xl transition"
                    >
                      <Briefcase className="w-5 h-5 text-indigo-400" />
                      <span>Career Reading</span>
                    </Link>
                  </div>
                </div>

                {/* New Reading Button */}
                <button
                  onClick={generateReading}
                  className="w-full mt-6 bg-purple-600/50 hover:bg-purple-600 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
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
