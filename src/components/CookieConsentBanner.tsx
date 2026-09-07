'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'

interface CookieConsent {
  analytics: boolean
  marketing: boolean
  functional: boolean
}

const COOKIE_CONSENT_KEY = 'gdpr-cookie-consent'
const COOKIE_CONSENT_VERSION = '1.0'

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [consents, setConsents] = useState<CookieConsent>({
    analytics: false,
    marketing: false,
    functional: true, // Always required for basic functionality
  })

  useEffect(() => {
    // Check if consent already given (hydration-safe read from external system)
    const storedConsent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!storedConsent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowBanner(true)
    } else {
      try {
        const parsed = JSON.parse(storedConsent)
        if (parsed.version !== COOKIE_CONSENT_VERSION) {
          // Version changed, ask again

          setShowBanner(true)
        }
      } catch {
        setShowBanner(true)
      }
    }
  }, [])

  const acceptAll = () => {
    const allConsents = {
      analytics: true,
      marketing: true,
      functional: true,
      timestamp: new Date().toISOString(),
      version: COOKIE_CONSENT_VERSION,
    }
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(allConsents))
    setShowBanner(false)
    setShowSettings(false)
  }

  const rejectAll = () => {
    const minimalConsents = {
      analytics: false,
      marketing: false,
      functional: true,
      timestamp: new Date().toISOString(),
      version: COOKIE_CONSENT_VERSION,
    }
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(minimalConsents))
    setShowBanner(false)
    setShowSettings(false)
  }

  const saveSettings = () => {
    const savedConsents = {
      ...consents,
      timestamp: new Date().toISOString(),
      version: COOKIE_CONSENT_VERSION,
    }
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(savedConsents))
    setShowBanner(false)
    setShowSettings(false)
  }

  if (!showBanner) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4"
      >
        <div className="max-w-4xl mx-auto bg-[#1e1b4b] border border-purple-500/30 rounded-2xl shadow-2xl">
          {!showSettings ? (
            <div className="p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
              <Cookie className="w-8 h-8 text-purple-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Cookie & Privacy Consent</h3>
                <p className="text-purple-200 text-sm">
                  We use cookies to enhance your experience, provide personalized astrology
                  readings, and analyze our traffic. By clicking &quot;Accept All&quot;, you consent
                  to our use of cookies. You can customize your preferences or reject non-essential
                  cookies.
                </p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 text-purple-300 hover:text-white transition-colors"
                >
                  <Settings className="w-5 h-5 inline mr-1" />
                  Settings
                </button>
                <button
                  onClick={rejectAll}
                  className="px-4 py-2 bg-purple-900/50 text-purple-300 rounded-lg hover:bg-purple-900 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={acceptAll}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
                >
                  Accept All
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Cookie Preferences</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-purple-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Functional Cookies */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Functional Cookies</p>
                    <p className="text-purple-300 text-sm">
                      Required for basic site functionality. Cannot be disabled.
                    </p>
                  </div>
                  <div className="w-12 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white">Always</span>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Analytics Cookies</p>
                    <p className="text-purple-300 text-sm">
                      Help us understand how you use our site to improve your experience.
                    </p>
                  </div>
                  <button
                    onClick={() => setConsents(prev => ({ ...prev, analytics: !prev.analytics }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      consents.analytics ? 'bg-purple-600' : 'bg-purple-900'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        consents.analytics ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Marketing Cookies</p>
                    <p className="text-purple-300 text-sm">
                      Used to deliver relevant ads and measure campaign effectiveness.
                    </p>
                  </div>
                  <button
                    onClick={() => setConsents(prev => ({ ...prev, marketing: !prev.marketing }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      consents.marketing ? 'bg-purple-600' : 'bg-purple-900'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        consents.marketing ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6 justify-end">
                <button
                  onClick={rejectAll}
                  className="px-4 py-2 text-purple-300 hover:text-white transition-colors"
                >
                  Reject All
                </button>
                <button
                  onClick={saveSettings}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
                >
                  Save Preferences
                </button>
              </div>

              <p className="text-purple-400 text-xs mt-4">
                View our{' '}
                <a href="/privacy" className="underline hover:text-white">
                  Privacy Policy
                </a>{' '}
                for more details.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
