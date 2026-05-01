'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, ChevronDown } from 'lucide-react'
import { SUPPORTED_LANGUAGES, LanguageCode, getPreferredLanguage, t } from '@/lib/i18n'

interface LanguageSwitcherProps {
  currentLanguage?: LanguageCode
  onLanguageChange?: (language: LanguageCode) => void
  compact?: boolean
}

export function LanguageSwitcher({
  currentLanguage,
  onLanguageChange,
  compact = false,
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    currentLanguage || 'en'
  )
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Get stored language preference
    const stored = localStorage.getItem('preferred-language') as LanguageCode
    if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
      setSelectedLanguage(stored)
    }
  }, [])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (language: LanguageCode) => {
    setSelectedLanguage(language)
    localStorage.setItem('preferred-language', language)
    setIsOpen(false)
    if (onLanguageChange) {
      onLanguageChange(language)
    }
  }

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-purple-900/50 transition-colors"
        >
          <Globe className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-purple-300">{currentLang?.code.toUpperCase()}</span>
          <ChevronDown className={`w-3 h-3 text-purple-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-48 bg-[#1e1b4b] border border-purple-500/30 rounded-xl shadow-xl overflow-hidden z-50"
            >
              {SUPPORTED_LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleSelect(language.code)}
                  className={`w-full px-4 py-2 text-left hover:bg-purple-900/50 transition-colors ${
                    selectedLanguage === language.code ? 'bg-purple-900/30' : ''
                  }`}
                >
                  <span className="text-white">{language.nativeName}</span>
                  <span className="text-purple-400 text-xs ml-2">{language.code.toUpperCase()}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-[#1e1b4b] border border-purple-500/30 rounded-xl hover:bg-purple-900/50 transition-colors"
      >
        <Globe className="w-5 h-5 text-purple-400" />
        <span className="text-white">{currentLang?.nativeName}</span>
        <ChevronDown
          className={`w-4 h-4 text-purple-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-56 bg-[#1e1b4b] border border-purple-500/30 rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="p-3 border-b border-purple-500/20">
              <p className="text-xs text-purple-400">Select Language</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleSelect(language.code)}
                  className={`w-full px-4 py-3 text-left hover:bg-purple-900/50 transition-colors flex items-center justify-between ${
                    selectedLanguage === language.code ? 'bg-purple-900/30' : ''
                  }`}
                >
                  <div>
                    <span className="text-white font-medium">{language.nativeName}</span>
                    <span className="text-purple-300 text-sm ml-2">{language.name}</span>
                  </div>
                  {selectedLanguage === language.code && (
                    <span className="text-purple-400 text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}