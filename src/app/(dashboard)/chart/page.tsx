'use client'

import { Sparkles, Star, Calendar, Clock, MapPin, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'

interface BirthChartResult {
  planets: Array<{ name: string; sign: string }>
  ascendant: { sign: string }
  aspects?: Array<{ name: string }>
}

export default function BirthChartPage() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<BirthChartResult | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: 'My Birth Chart',
    birthDate: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    birthTime: '',
    birthPlace: '',
    latitude: '',
    longitude: '',
    timezone: 'UTC',
  })
  const [searchResults, setSearchResults] = useState<
    Array<{
      name: string
      latitude: string
      longitude: string
      country: string
      state?: string
    }>
  >([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchingLocation, setSearchingLocation] = useState(false)

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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Reset day if it exceeds max days for selected month
  useEffect(() => {
    if (formData.birthMonth && formData.birthDay) {
      const maxDays = getMaxDaysInMonth(formData.birthMonth, formData.birthYear)
      const currentDay = parseInt(formData.birthDay, 10)
      if (currentDay > maxDays) {
        setFormData(prev => ({ ...prev, birthDay: maxDays.toString().padStart(2, '0') }))
      }
    }
  }, [formData.birthMonth, formData.birthYear, formData.birthDay])

  const handleGeolocate = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords
        setFormData(prev => ({
          ...prev,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        }))
        setLoading(false)

        // Try to get location name (reverse geocoding would need an API)
        setFormData(prev => ({
          ...prev,
          birthPlace: `Latitude: ${latitude.toFixed(4)}, Longitude: ${longitude.toFixed(4)}`,
        }))
      },
      () => {
        setError('Unable to get your location. Please enter manually.')
        setLoading(false)
      }
    )
  }

  // Search for location using Nominatim (OpenStreetMap)
  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    setSearchingLocation(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      )
      const data = await response.json()

      const results = data.map((item: any) => ({
        name: item.display_name,
        latitude: item.lat,
        longitude: item.lon,
        country: item.address?.country || '',
        state: item.address?.state || '',
      }))

      setSearchResults(results)
      setShowDropdown(true)
    } catch (_err) {
      logger.warn('Failed to search location')
      setSearchResults([])
    } finally {
      setSearchingLocation(false)
    }
  }

  // Handle location selection from dropdown
  const selectLocation = (location: (typeof searchResults)[0]) => {
    setFormData(prev => ({
      ...prev,
      birthPlace: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    }))
    setShowDropdown(false)
    setSearchResults([])

    // Auto-detect timezone based on coordinates (simplified)
    // In production, use a timezone API like timezonefinder or Google Maps
    const lat = parseFloat(location.latitude)
    const lon = parseFloat(location.longitude)

    // Rough timezone estimation based on longitude
    const timezoneOffset = Math.round(lon / 15)
    const timezoneMap: Record<string, string> = {
      '-11': 'Pacific/Midway',
      '-10': 'Pacific/Honolulu',
      '-9': 'America/Anchorage',
      '-8': 'America/Los_Angeles',
      '-7': 'America/Denver',
      '-6': 'America/Chicago',
      '-5': 'America/New_York',
      '-4': 'America/Halifax',
      '-3': 'America/Sao_Paulo',
      '-2': 'Atlantic/South_Georgia',
      '-1': 'Atlantic/Azores',
      '0': 'UTC',
      '1': 'Europe/Paris',
      '2': 'Europe/Athens',
      '3': 'Europe/Moscow',
      '4': 'Asia/Dubai',
      '5': 'Asia/Karachi',
      '5.5': 'Asia/Kolkata',
      '6': 'Asia/Dhaka',
      '7': 'Asia/Bangkok',
      '8': 'Asia/Shanghai',
      '9': 'Asia/Tokyo',
      '10': 'Australia/Sydney',
      '11': 'Pacific/Noumea',
      '12': 'Pacific/Auckland',
    }

    const timezone = timezoneMap[timezoneOffset.toString()] || 'UTC'
    const _istTimezones = ['Asia/Kolkata', 'Asia/Calcutta']
    const indiaLike = Math.abs(lon - 82) < 15 && lat < 40 && lat > 5
    setFormData(prev => ({
      ...prev,
      timezone: indiaLike ? 'Asia/Kolkata' : timezone,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    // Combine day, month, year into birthDate (DD-MM-YYYY format)
    const day = formData.birthDay.toString().padStart(2, '0')
    const month = formData.birthMonth.toString().padStart(2, '0')
    const birthDate = `${day}-${month}-${formData.birthYear}`

    try {
      const response = await fetch('/api/astrology/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          birthDate,
          latitude: parseFloat(formData.latitude) || 0,
          longitude: parseFloat(formData.longitude) || 0,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate chart')
      }

      const data = await response.json()
      setResult(data)
    } catch (_err: any) {
      setError(_err.message)
    } finally {
      setSaving(false)
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 gradient-text">Create Your Birth Chart</h1>
            <p className="text-purple-200">
              Enter your birth details to generate your cosmic blueprint
            </p>
          </div>

          <div className="glass rounded-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Chart Name */}
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Chart Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-purple-400"
                  placeholder="My Birth Chart"
                />
              </div>

              {/* Birth Date - Three Columns: DD-MM-YYYY */}
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Birth Date *
                </label>
                <div className="flex gap-3">
                  {/* Day */}
                  <div className="flex-1">
                    <select
                      value={formData.birthDay}
                      onChange={e => setFormData({ ...formData, birthDay: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white appearance-none"
                      required
                    >
                      <option value="">Day</option>
                      {Array.from(
                        { length: getMaxDaysInMonth(formData.birthMonth, formData.birthYear) },
                        (_, i) => i + 1
                      ).map(day => (
                        <option key={day} value={day.toString().padStart(2, '0')}>
                          {day.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-purple-300 mt-1 block">DD</span>
                  </div>

                  {/* Month */}
                  <div className="flex-1">
                    <select
                      value={formData.birthMonth}
                      onChange={e => setFormData({ ...formData, birthMonth: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white appearance-none"
                      required
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
                    <span className="text-xs text-purple-300 mt-1 block">MM</span>
                  </div>

                  {/* Year */}
                  <div className="flex-1">
                    <select
                      value={formData.birthYear}
                      onChange={e => setFormData({ ...formData, birthYear: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white appearance-none"
                      required
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
                    <span className="text-xs text-purple-300 mt-1 block">YYYY</span>
                  </div>
                </div>
                <span className="text-xs text-purple-400 mt-1 block">Format: DD-MM-YYYY</span>
              </div>

              {/* Birth Time */}
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  <Clock className="inline w-4 h-4 mr-1" />
                  Birth Time * (as exact as possible)
                </label>
                <input
                  type="time"
                  value={formData.birthTime}
                  onChange={e => setFormData({ ...formData, birthTime: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  required
                />
              </div>

              {/* Birth Place */}
              <div className="relative">
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  <MapPin className="inline w-4 h-4 mr-1" />
                  Birth Place *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={e => {
                      setFormData({ ...formData, birthPlace: e.target.value })
                      searchLocation(e.target.value)
                    }}
                    onFocus={() => {
                      if (formData.birthPlace.length >= 3) {
                        setShowDropdown(true)
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowDropdown(false), 200)
                    }}
                    className="flex-1 px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-purple-400"
                    placeholder="Search city, country..."
                    required
                  />
                  <button
                    type="button"
                    onClick={handleGeolocate}
                    disabled={loading}
                    className="px-4 py-3 bg-purple-600/50 hover:bg-purple-600 rounded-xl transition disabled:opacity-50"
                    title="Use current location coordinates"
                  >
                    <MapPin className="w-5 h-5" />
                  </button>
                </div>

                {/* Location Search Dropdown */}
                {showDropdown && (searchResults.length > 0 || searchingLocation) && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-purple-500/30 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                    {searchingLocation ? (
                      <div className="p-4 text-center text-purple-300">
                        <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                        Searching locations...
                      </div>
                    ) : (
                      searchResults.map((location, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => selectLocation(location)}
                          className="w-full px-4 py-3 text-left hover:bg-purple-600/30 transition flex items-start gap-3 border-b border-purple-500/10 last:border-0"
                        >
                          <MapPin className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium text-white">{location.name}</div>
                            {(location.state || location.country) && (
                              <div className="text-sm text-purple-300">
                                {[location.state, location.country].filter(Boolean).join(', ')}
                              </div>
                            )}
                            <div className="text-xs text-purple-400 mt-1">
                              Lat: {parseFloat(location.latitude).toFixed(4)}, Lon:{' '}
                              {parseFloat(location.longitude).toFixed(4)}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-purple-400"
                    placeholder="0.0000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-purple-400"
                    placeholder="0.0000"
                    required
                  />
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value="">Select Timezone</option>

                  {/* UTC/GMT */}
                  <optgroup label="UTC/GMT">
                    <option value="UTC">UTC (Coordinated Universal Time) +0:00</option>
                    <option value="GMT">GMT (Greenwich Mean Time) +0:00</option>
                  </optgroup>

                  {/* Americas */}
                  <optgroup label="Americas">
                    <option value="America/New_York">Eastern Time (ET) - US/Canada -5:00</option>
                    <option value="America/Chicago">Central Time (CT) - US/Canada -6:00</option>
                    <option value="America/Denver">Mountain Time (MT) - US/Canada -7:00</option>
                    <option value="America/Los_Angeles">Pacific Time (PT) - US/Canada -8:00</option>
                    <option value="America/Anchorage">Alaska Time (AKT) -9:00</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HST) -10:00</option>
                    <option value="America/Toronto">Toronto (ET) - Canada -5:00</option>
                    <option value="America/Vancouver">Vancouver (PT) - Canada -8:00</option>
                    <option value="America/Mexico_City">Mexico City (CST) -6:00</option>
                    <option value="America/Sao_Paulo">São Paulo (BRT) - Brazil -3:00</option>
                    <option value="America/Buenos_Aires">
                      Buenos Aires (ART) - Argentina -3:00
                    </option>
                    <option value="America/Bogota">Bogotá (COT) - Colombia -5:00</option>
                    <option value="America/Lima">Lima (PET) - Peru -5:00</option>
                    <option value="America/Santiago">Santiago (CLT) - Chile -4:00</option>
                    <option value="America/Caracas">Caracas (VET) - Venezuela -4:00</option>
                  </optgroup>

                  {/* Europe */}
                  <optgroup label="Europe">
                    <option value="Europe/London">London (GMT/BST) - UK +0:00</option>
                    <option value="Europe/Dublin">Dublin (GMT/IST) - Ireland +0:00</option>
                    <option value="Europe/Lisbon">Lisbon (WET) - Portugal +0:00</option>
                    <option value="Europe/Paris">Paris (CET) - France +1:00</option>
                    <option value="Europe/Berlin">Berlin (CET) - Germany +1:00</option>
                    <option value="Europe/Rome">Rome (CET) - Italy +1:00</option>
                    <option value="Europe/Madrid">Madrid (CET) - Spain +1:00</option>
                    <option value="Europe/Amsterdam">Amsterdam (CET) - Netherlands +1:00</option>
                    <option value="Europe/Brussels">Brussels (CET) - Belgium +1:00</option>
                    <option value="Europe/Vienna">Vienna (CET) - Austria +1:00</option>
                    <option value="Europe/Zurich">Zurich (CET) - Switzerland +1:00</option>
                    <option value="Europe/Stockholm">Stockholm (CET) - Sweden +1:00</option>
                    <option value="Europe/Oslo">Oslo (CET) - Norway +1:00</option>
                    <option value="Europe/Copenhagen">Copenhagen (CET) - Denmark +1:00</option>
                    <option value="Europe/Helsinki">Helsinki (EET) - Finland +2:00</option>
                    <option value="Europe/Warsaw">Warsaw (CET) - Poland +1:00</option>
                    <option value="Europe/Prague">Prague (CET) - Czech Republic +1:00</option>
                    <option value="Europe/Budapest">Budapest (CET) - Hungary +1:00</option>
                    <option value="Europe/Bucharest">Bucharest (EET) - Romania +2:00</option>
                    <option value="Europe/Athens">Athens (EET) - Greece +2:00</option>
                    <option value="Europe/Istanbul">Istanbul (TRT) - Turkey +3:00</option>
                    <option value="Europe/Moscow">Moscow (MSK) - Russia +3:00</option>
                    <option value="Europe/Kiev">Kiev (EET) - Ukraine +2:00</option>
                    <option value="Europe/Minsk">Minsk (MSK) - Belarus +3:00</option>
                  </optgroup>

                  {/* Africa */}
                  <optgroup label="Africa">
                    <option value="Africa/Cairo">Cairo (EET) - Egypt +2:00</option>
                    <option value="Africa/Lagos">Lagos (WAT) - Nigeria +1:00</option>
                    <option value="Africa/Johannesburg">
                      Johannesburg (SAST) - South Africa +2:00
                    </option>
                    <option value="Africa/Nairobi">Nairobi (EAT) - Kenya +3:00</option>
                    <option value="Africa/Addis_Ababa">Addis Ababa (EAT) - Ethiopia +3:00</option>
                    <option value="Africa/Casablanca">Casablanca (WET) - Morocco +0:00</option>
                    <option value="Africa/Accra">Accra (GMT) - Ghana +0:00</option>
                    <option value="Africa/Dakar">Dakar (GMT) - Senegal +0:00</option>
                    <option value="Africa/Tunis">Tunis (CET) - Tunisia +1:00</option>
                    <option value="Africa/Algiers">Algiers (CET) - Algeria +1:00</option>
                    <option value="Africa/Tripoli">Tripoli (EET) - Libya +2:00</option>
                    <option value="Africa/Khartoum">Khartoum (CAT) - Sudan +2:00</option>
                  </optgroup>

                  {/* Asia */}
                  <optgroup label="Asia">
                    <option value="Asia/Dubai">Dubai (GST) - UAE +4:00</option>
                    <option value="Asia/Riyadh">Riyadh (AST) - Saudi Arabia +3:00</option>
                    <option value="Asia/Tehran">Tehran (IRST) - Iran +3:30</option>
                    <option value="Asia/Karachi">Karachi (PKT) - Pakistan +5:00</option>
                    <option value="Asia/Kolkata">Kolkata (IST) - India +5:30</option>
                    <option value="Asia/Dhaka">Dhaka (BST) - Bangladesh +6:00</option>
                    <option value="Asia/Yangon">Yangon (MMT) - Myanmar +6:30</option>
                    <option value="Asia/Bangkok">Bangkok (ICT) - Thailand +7:00</option>
                    <option value="Asia/Ho_Chi_Minh">Ho Chi Minh (ICT) - Vietnam +7:00</option>
                    <option value="Asia/Jakarta">Jakarta (WIB) - Indonesia +7:00</option>
                    <option value="Asia/Singapore">Singapore (SGT) +8:00</option>
                    <option value="Asia/Kuala_Lumpur">Kuala Lumpur (MYT) - Malaysia +8:00</option>
                    <option value="Asia/Manila">Manila (PHT) - Philippines +8:00</option>
                    <option value="Asia/Hong_Kong">Hong Kong (HKT) +8:00</option>
                    <option value="Asia/Taipei">Taipei (CST) - Taiwan +8:00</option>
                    <option value="Asia/Shanghai">Shanghai (CST) - China +8:00</option>
                    <option value="Asia/Beijing">Beijing (CST) - China +8:00</option>
                    <option value="Asia/Seoul">Seoul (KST) - South Korea +9:00</option>
                    <option value="Asia/Tokyo">Tokyo (JST) - Japan +9:00</option>
                    <option value="Asia/Jerusalem">Jerusalem (IST) - Israel +2:00</option>
                    <option value="Asia/Baghdad">Baghdad (AST) - Iraq +3:00</option>
                    <option value="Asia/Kuwait">Kuwait (AST) +3:00</option>
                    <option value="Asia/Qatar">Qatar (AST) +3:00</option>
                    <option value="Asia/Bahrain">Bahrain (AST) +3:00</option>
                    <option value="Asia/Muscat">Muscat (GST) - Oman +4:00</option>
                    <option value="Asia/Tashkent">Tashkent (UZT) - Uzbekistan +5:00</option>
                    <option value="Asia/Almaty">Almaty (ALMT) - Kazakhstan +6:00</option>
                    <option value="Asia/Kabul">Kabul (AFT) - Afghanistan +4:30</option>
                    <option value="Asia/Kathmandu">Kathmandu (NPT) - Nepal +5:45</option>
                    <option value="Asia/Colombo">Colombo (IST) - Sri Lanka +5:30</option>
                    <option value="Asia/Maldives">Maldives (MVT) +5:00</option>
                    <option value="Asia/Thimphu">Thimphu (BTT) - Bhutan +6:00</option>
                    <option value="Asia/Ulaanbaatar">Ulaanbaatar (ULAT) - Mongolia +8:00</option>
                  </optgroup>

                  {/* Australia & Pacific */}
                  <optgroup label="Australia & Pacific">
                    <option value="Australia/Sydney">Sydney (AEST) - Australia +10:00</option>
                    <option value="Australia/Melbourne">Melbourne (AEST) - Australia +10:00</option>
                    <option value="Australia/Brisbane">Brisbane (AEST) - Australia +10:00</option>
                    <option value="Australia/Perth">Perth (AWST) - Australia +8:00</option>
                    <option value="Australia/Adelaide">Adelaide (ACST) - Australia +9:30</option>
                    <option value="Australia/Darwin">Darwin (ACST) - Australia +9:30</option>
                    <option value="Australia/Hobart">Hobart (AEST) - Australia +10:00</option>
                    <option value="Australia/Canberra">Canberra (AEST) - Australia +10:00</option>
                    <option value="Pacific/Auckland">Auckland (NZST) - New Zealand +12:00</option>
                    <option value="Pacific/Wellington">
                      Wellington (NZST) - New Zealand +12:00
                    </option>
                    <option value="Pacific/Fiji">Fiji (FJT) +12:00</option>
                    <option value="Pacific/Papua">
                      Port Moresby (PGT) - Papua New Guinea +10:00
                    </option>
                    <option value="Pacific/Port_Moresby">Port Moresby (PGT) +10:00</option>
                    <option value="Pacific/Guam">Guam (ChST) +10:00</option>
                    <option value="Pacific/Honolulu">Honolulu (HST) - Hawaii -10:00</option>
                    <option value="Pacific/Midway">Midway (SST) -11:00</option>
                    <option value="Pacific/Tahiti">Tahiti (TAHT) -10:00</option>
                    <option value="Pacific/Noumea">Nouméa (NCT) - New Caledonia +11:00</option>
                    <option value="Pacific/Port_Vila">Port Vila (VUT) - Vanuatu +11:00</option>
                    <option value="Pacific/Apia">Apia (WST) - Samoa +13:00</option>
                    <option value="Pacific/Tongatapu">Tongatapu (TOT) - Tonga +13:00</option>
                  </optgroup>

                  {/* Atlantic */}
                  <optgroup label="Atlantic">
                    <option value="Atlantic/Azores">Azores (AZOT) - Portugal -1:00</option>
                    <option value="Atlantic/Madeira">Madeira (WET) - Portugal +0:00</option>
                    <option value="Atlantic/Canary">Canary Islands (WET) - Spain +0:00</option>
                    <option value="Atlantic/Cape_Verde">Cape Verde (CVT) -1:00</option>
                    <option value="Atlantic/South_Georgia">South Georgia (GST) -2:00</option>
                    <option value="Atlantic/Bermuda">Bermuda (AST) -4:00</option>
                    <option value="Atlantic/Faroe">Faroe Islands (WET) +0:00</option>
                    <option value="Atlantic/Reykjavik">Reykjavik (GMT) - Iceland +0:00</option>
                  </optgroup>

                  {/* Indian Ocean */}
                  <optgroup label="Indian Ocean">
                    <option value="Indian/Maldives">Maldives (MVT) +5:00</option>
                    <option value="Indian/Mauritius">Mauritius (MUT) +4:00</option>
                    <option value="Indian/Reunion">Réunion (RET) +4:00</option>
                    <option value="Indian/Comoro">Comoro (EAT) +3:00</option>
                    <option value="Indian/Antananarivo">
                      Antananarivo (EAT) - Madagascar +3:00
                    </option>
                    <option value="Indian/Mayotte">Mayotte (EAT) +3:00</option>
                    <option value="Indian/Chagos">Chagos (IOT) +6:00</option>
                    <option value="Indian/Christmas">Christmas Island (CXT) +7:00</option>
                    <option value="Indian/Cocos">Cocos Islands (CCT) +6:30</option>
                  </optgroup>

                  {/* Antarctica */}
                  <optgroup label="Antarctica">
                    <option value="Antarctica/McMurdo">McMurdo (NZST) +12:00</option>
                    <option value="Antarctica/Casey">Casey (CAST) +8:00</option>
                    <option value="Antarctica/Davis">Davis (DAVT) +7:00</option>
                    <option value="Antarctica/Vostok">Vostok (VOST) +6:00</option>
                    <option value="Antarctica/Syowa">Syowa (SYOT) +3:00</option>
                    <option value="Antarctica/Palmer">Palmer (CLT) -3:00</option>
                    <option value="Antarctica/Rothera">Rothera (ROTT) -3:00</option>
                  </optgroup>
                </select>
              </div>

              {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 text-white py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 pulse-glow"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Calculating Planetary Positions...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Generate Birth Chart
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          {result && (
            <div className="mt-8 glass rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6 gradient-text">Your Birth Chart</h2>

              {/* Sun, Moon, Rising */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-3xl mb-2">☀️</div>
                  <div className="text-sm text-purple-300">Sun</div>
                  <div className="font-semibold">
                    {result.planets.find(p => p.name === 'Sun')?.sign}
                  </div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-3xl mb-2">🌙</div>
                  <div className="text-sm text-purple-300">Moon</div>
                  <div className="font-semibold">
                    {result.planets.find((p: any) => p.name === 'Moon')?.sign}
                  </div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-3xl mb-2">⬆️</div>
                  <div className="text-sm text-purple-300">Rising</div>
                  <div className="font-semibold">{result.ascendant.sign}</div>
                </div>
              </div>

              {/* Planetary Positions */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-purple-400" />
                  Planetary Positions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {result.planets.map((planet: any) => (
                    <div key={planet.name} className="p-3 bg-white/5 rounded-xl text-center">
                      <div className="text-sm text-purple-300">{planet.name}</div>
                      <div className="font-medium">{planet.sign}</div>
                      <div className="text-xs text-purple-400">{planet.degree.toFixed(1)}°</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aspects */}
              {result.aspects && result.aspects.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Major Aspects</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.aspects.slice(0, 10).map((aspect: any, i: number) => (
                      <span key={i} className="px-3 py-1 bg-purple-600/30 rounded-full text-sm">
                        {aspect.planet1} {aspect.type} {aspect.planet2}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/horoscope/daily"
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-semibold text-center transition"
                >
                  Get Daily Reading
                </Link>
                <Link
                  href="/horoscope/love"
                  className="flex-1 bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-xl font-semibold text-center transition"
                >
                  Love Horoscope
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
