'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SUPPORTED_LANGUAGES, type LanguageCode, translations } from '@/lib/i18n'
import { DEFAULT_LOCALE, mergeLocale, type LocaleConfig } from '@/lib/tenant-defaults'

const STORAGE_KEY = 'preferred-language'

interface LocaleContextValue extends LocaleConfig {
  languages: Array<{ code: string; name: string; nativeName: string; locale: string }>
  current: LanguageCode
  setLanguage: (code: LanguageCode) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue>({
  ...DEFAULT_LOCALE,
  languages: SUPPORTED_LANGUAGES as unknown as LocaleContextValue['languages'],
  current: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
})

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext)
}

const RTL = new Set(['ar'])

export function LocaleProvider({
  config,
  children,
}: {
  config: Partial<LocaleConfig>
  children: ReactNode
}): React.ReactElement {
  const merged = useMemo(() => mergeLocale(config), [config])
  const languages = useMemo(
    () => SUPPORTED_LANGUAGES.filter(l => merged.supportedLanguages.includes(l.code)),
    [merged.supportedLanguages]
  )

  const initial = (merged.defaultLanguage as LanguageCode) || 'en'
  const [current, setCurrent] = useState<LanguageCode>(initial)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null
    const pick =
      stored && merged.supportedLanguages.includes(stored)
        ? stored
        : (merged.defaultLanguage as LanguageCode)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(pick)
    document.documentElement.lang = pick
    document.documentElement.dir = RTL.has(pick) ? 'rtl' : 'ltr'
  }, [merged])

  const setLanguage = (code: LanguageCode): void => {
    setCurrent(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      /* private mode */
    }
    document.documentElement.lang = code
    document.documentElement.dir = RTL.has(code) ? 'rtl' : 'ltr'
  }

  const t = (key: string): string => translations[current]?.[key] ?? translations.en?.[key] ?? key

  const value: LocaleContextValue = {
    ...merged,
    languages: languages.length
      ? languages
      : (SUPPORTED_LANGUAGES.filter(
          l => l.code === 'en'
        ) as unknown as LocaleContextValue['languages']),
    current,
    setLanguage,
    t,
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
