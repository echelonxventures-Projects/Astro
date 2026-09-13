'use client'

import { Users, Heart, Loader2, Sparkles, Repeat } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { BrandName } from '@/components/BrandProvider'
import { logger } from '@/lib/logger'

export default function CompatibilityPage() {
  const { data: _session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [charts, setCharts] = useState<any[]>([])
  const [partnerChartId, setPartnerChartId] = useState('')
  const [reading, setReading] = useState<any>(null)
  const [error, setError] = useState('')
  const [showPartnerForm, setShowPartnerForm] = useState(false)
  const [partnerData, setPartnerData] = useState({
    name: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    birthTime: '',
    birthPlace: '',
    latitude: '',
    longitude: '',
    timezone: 'UTC',
  })

  // Get max days in a month
  const getMaxDaysInMonth = (month: string, year: string): number => {
    if (!month || !year) return 31
    const monthNum = parseInt(month, 10)
    const yearNum = parseInt(year, 10)
    if (isNaN(monthNum) || isNaN(yearNum)) return 31

    // Handle February for leap years
    if (monthNum === 2) {
      const isLeapYear = (yearNum % 4 === 0 && yearNum % 100 !== 0) || yearNum % 400 === 0
      return isLeapYear ? 29 : 28
    }

    // 30 days: April, June, September, November
    if ([4, 6, 9, 11].includes(monthNum)) {
      return 30
    }

    return 31
  }

  // Reset day if it exceeds max days for selected month
  useEffect(() => {
    if (partnerData.birthMonth && partnerData.birthDay) {
      const maxDays = getMaxDaysInMonth(partnerData.birthMonth, partnerData.birthYear)
      const currentDay = parseInt(partnerData.birthDay, 10)
      if (currentDay > maxDays) {
        setPartnerData(prev => ({ ...prev, birthDay: maxDays.toString().padStart(2, '0') }))
      }
    }
  }, [partnerData.birthMonth, partnerData.birthYear])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchCharts()
  }, [])

  const fetchCharts = async () => {
    try {
      const response = await fetch('/api/astrology/chart')
      if (response.ok) {
        const data = await response.json()
        setCharts(data.charts || [])
      }
    } catch (_err) {
      logger.warn('Failed to fetch charts')
    }
  }

  const createPartnerChart = async () => {
    setLoading(true)
    try {
      // Combine day, month, year into birthDate (DD-MM-YYYY format)
      const day = partnerData.birthDay.toString().padStart(2, '0')
      const month = partnerData.birthMonth.toString().padStart(2, '0')
      const birthDate = `${day}-${month}-${partnerData.birthYear}`

      const response = await fetch('/api/astrology/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...partnerData,
          birthDate,
          name: `${partnerData.name || 'Partner'}'s Chart`,
          latitude: parseFloat(partnerData.latitude) || 0,
          longitude: parseFloat(partnerData.longitude) || 0,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create partner chart')
      }

      const data = await response.json()
      setPartnerChartId(data.id)
      setShowPartnerForm(false)
    } catch (_err: any) {
      setError(_err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateCompatibility = async () => {
    if (!partnerChartId) {
      setError('Please select or create a partner chart')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/astrology/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'compatibility', partnerChartId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate reading')
      }

      const data = await response.json()
      setReading(data)
    } catch (_err: any) {
      setError(_err.message)
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600/30 rounded-full mb-4">
              <Users className="w-5 h-5 text-rose-400" />
              <span className="text-sm font-medium">Synastry Reading</span>
            </div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Compatibility Reading</h1>
            <p className="text-purple-200">
              Compare birth charts to discover your cosmic connection
            </p>
          </div>

          {!reading && !loading && (
            <div className="glass rounded-2xl p-8">
              {/* Your Chart */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Your Chart</h2>
                {charts.length > 0 ? (
                  <div className="grid md:grid-cols-3 gap-3">
                    {charts.map(chart => (
                      <div
                        key={chart.id}
                        className="p-4 bg-white/5 rounded-xl border-2 border-purple-500/50"
                      >
                        <div className="font-medium">{chart.name}</div>
                        <div className="text-sm text-purple-300">
                          {chart.planets?.find((p: any) => p.name === 'Sun')?.sign} Sun,{' '}
                          {chart.ascendant?.sign || 'Unknown'} Rising
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-purple-300 mb-4">
                      You don&apos;t have any birth charts yet. Create one first.
                    </p>
                    <Link
                      href="/chart"
                      className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full transition"
                    >
                      Create Birth Chart
                    </Link>
                  </div>
                )}
              </div>

              {/* Partner Selection */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Partner&apos;s Chart</h2>
                  <button
                    onClick={() => setShowPartnerForm(!showPartnerForm)}
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                  >
                    <Repeat className="w-4 h-4" />
                    {showPartnerForm ? 'Select from existing' : 'Create new'}
                  </button>
                </div>

                {showPartnerForm ? (
                  <div className="p-6 bg-white/5 rounded-xl space-y-4">
                    <h3 className="font-medium">Create Partner&apos;s Birth Chart</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Partner's Name"
                        value={partnerData.name}
                        onChange={e => setPartnerData({ ...partnerData, name: e.target.value })}
                        className="px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                      />

                      {/* Birth Date - Three Columns: DD-MM-YYYY */}
                      <div className="col-span-2 grid grid-cols-3 gap-3">
                        <select
                          value={partnerData.birthDay}
                          onChange={e =>
                            setPartnerData({ ...partnerData, birthDay: e.target.value })
                          }
                          className="px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                        >
                          <option value="">Day</option>
                          {Array.from(
                            {
                              length: getMaxDaysInMonth(
                                partnerData.birthMonth,
                                partnerData.birthYear
                              ),
                            },
                            (_, i) => i + 1
                          ).map(day => (
                            <option key={day} value={day.toString().padStart(2, '0')}>
                              {day.toString().padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                        <select
                          value={partnerData.birthMonth}
                          onChange={e =>
                            setPartnerData({ ...partnerData, birthMonth: e.target.value })
                          }
                          className="px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                        >
                          <option value="">Month</option>
                          <option value="01">January</option>
                          <option value="02">February</option>
                          <option value="03">March</option>
                          <option value="04">April</option>
                          <option value="05">May</option>
                          <option value="06">June</option>
                          <option value="07">July</option>
                          <option value="08">August</option>
                          <option value="09">September</option>
                          <option value="10">October</option>
                          <option value="11">November</option>
                          <option value="12">December</option>
                        </select>
                        <select
                          value={partnerData.birthYear}
                          onChange={e =>
                            setPartnerData({ ...partnerData, birthYear: e.target.value })
                          }
                          className="px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                        >
                          <option value="">Year</option>
                          {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(
                            year => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <span className="col-span-2 text-xs text-purple-400 -mt-2">
                        Format: DD-MM-YYYY
                      </span>

                      <input
                        type="time"
                        value={partnerData.birthTime}
                        onChange={e =>
                          setPartnerData({ ...partnerData, birthTime: e.target.value })
                        }
                        className="px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                      />
                      <input
                        type="text"
                        placeholder="Birth Place"
                        value={partnerData.birthPlace}
                        onChange={e =>
                          setPartnerData({ ...partnerData, birthPlace: e.target.value })
                        }
                        className="px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitude"
                        value={partnerData.latitude}
                        onChange={e => setPartnerData({ ...partnerData, latitude: e.target.value })}
                        className="px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Longitude"
                        value={partnerData.longitude}
                        onChange={e =>
                          setPartnerData({ ...partnerData, longitude: e.target.value })
                        }
                        className="px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                      />
                    </div>
                    <button
                      onClick={createPartnerChart}
                      disabled={loading}
                      className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 text-white py-3 rounded-xl font-semibold transition"
                    >
                      {loading ? 'Creating...' : 'Create Partner Chart'}
                    </button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-3">
                    {charts.map(chart => (
                      <button
                        key={chart.id}
                        onClick={() => setPartnerChartId(chart.id)}
                        className={`p-4 bg-white/5 rounded-xl transition ${
                          partnerChartId === chart.id
                            ? 'border-2 border-rose-500'
                            : 'border-2 border-transparent hover:border-purple-500/50'
                        }`}
                      >
                        <div className="font-medium">{chart.name}</div>
                        <div className="text-sm text-purple-300">
                          {chart.planets?.find((p: any) => p.name === 'Sun')?.sign} Sun
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 mb-6">
                  {error}
                </div>
              )}

              <button
                onClick={generateCompatibility}
                disabled={!partnerChartId || charts.length === 0}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-rose-700 disabled:opacity-50 text-white py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <Heart className="w-5 h-5" />
                Generate Compatibility Reading
              </button>
            </div>
          )}

          {loading && (
            <div className="glass rounded-2xl p-12 text-center">
              <Loader2 className="w-12 h-12 text-rose-400 animate-spin mx-auto mb-4" />
              <p className="text-purple-200">Analyzing cosmic connection...</p>
            </div>
          )}

          {reading && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-rose-600/50 to-pink-600/50 p-6">
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

                <button
                  onClick={() => setReading(null)}
                  className="w-full mt-6 bg-rose-600/50 hover:bg-rose-600 text-white py-3 rounded-xl font-semibold transition"
                >
                  New Compatibility Reading
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
