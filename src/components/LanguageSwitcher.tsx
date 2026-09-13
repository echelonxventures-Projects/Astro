'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Globe, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useLocale } from '@/components/LocaleProvider'
import { type LanguageCode } from '@/lib/i18n'

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
  const locale = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const selectedLanguage =
    currentLanguage && locale.languages.some(l => l.code === currentLanguage)
      ? currentLanguage
      : locale.current
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    locale.setLanguage(language)
    setIsOpen(false)
    if (onLanguageChange) {
      onLanguageChange(language)
    }
  }

  const currentLang = locale.languages.find(l => l.code === selectedLanguage)

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Globe className="w-4 h-4 text-[var(--primary-light)]" />
          <span className="text-sm text-[var(--primary-glow)]">
            {currentLang?.code.toUpperCase()}
          </span>
          <ChevronDown
            className={`w-3 h-3 text-[var(--primary-light)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-48 bg-[var(--muted)] border border-[var(--border)]/30 rounded-xl shadow-xl overflow-hidden z-50"
            >
              {locale.languages.map(language => (
                <button
                  key={language.code}
                  onClick={() => handleSelect(language.code as LanguageCode)}
                  className={`w-full px-4 py-2 text-left hover:bg-white/10 transition-colors ${
                    selectedLanguage === language.code ? 'bg-white/10' : ''
                  }`}
                >
                  <span className="text-white">{language.nativeName}</span>
                  <span className="text-[var(--primary-light)] text-xs ml-2">
                    {language.code.toUpperCase()}
                  </span>
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
        className="flex items-center gap-3 px-4 py-2 bg-[var(--muted)] border border-[var(--border)]/30 rounded-xl hover:bg-white/10 transition-colors"
      >
        <Globe className="w-5 h-5 text-[var(--primary-light)]" />
        <span className="text-white">{currentLang?.nativeName}</span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--primary-light)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-56 bg-[var(--muted)] border border-[var(--border)]/30 rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="p-3 border-b border-[var(--border)]/20">
              <p className="text-xs text-[var(--primary-light)]">Select Language</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {locale.languages.map(language => (
                <button
                  key={language.code}
                  onClick={() => handleSelect(language.code as LanguageCode)}
                  className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center justify-between ${
                    selectedLanguage === language.code ? 'bg-white/10' : ''
                  }`}
                >
                  <div>
                    <span className="text-white font-medium">{language.nativeName}</span>
                    <span className="text-[var(--primary-glow)] text-sm ml-2">{language.name}</span>
                  </div>
                  {selectedLanguage === language.code && (
                    <span className="text-[var(--primary-light)] text-xs">✓</span>
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
