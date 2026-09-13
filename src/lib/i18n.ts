/**
 * Internationalization (i18n) Configuration
 * Supports multiple languages for global accessibility
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', locale: 'en-US' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', locale: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', locale: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', locale: 'de-DE' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', locale: 'it-IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', locale: 'pt-PT' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', locale: 'ru-RU' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', locale: 'ja-JP' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', locale: 'zh-CN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', locale: 'hi-IN' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', locale: 'ar-SA' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', locale: 'ko-KR' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', locale: 'tr-TR' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', locale: 'nl-NL' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', locale: 'pl-PL' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

// Translation dictionaries
export const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    // Common
    'app.name': 'Astrology Platform',
    'app.tagline': 'Discover Your Cosmic Path',
    'nav.home': 'Home',
    'nav.dashboard': 'Dashboard',
    'nav.chart': 'Birth Chart',
    'nav.horoscope': 'Horoscope',
    'nav.chat': 'AI Astrologer',
    'nav.settings': 'Settings',
    'nav.profile': 'Profile',

    // Auth
    'auth.login': 'Login',
    'auth.signup': 'Sign Up',
    'auth.logout': 'Logout',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Name',
    'auth.forgotPassword': 'Forgot Password?',
    'auth.orContinueWith': 'or continue with',
    'auth.alreadyHaveAccount': 'Already have an account?',
    'auth.dontHaveAccount': "Don't have an account?",

    // Birth Chart
    'chart.title': 'Birth Chart',
    'chart.create': 'Create Your Birth Chart',
    'chart.birthDate': 'Birth Date',
    'chart.birthTime': 'Birth Time',
    'chart.birthPlace': 'Birth Place',
    'chart.generate': 'Generate Chart',
    'chart.sunSign': 'Sun Sign',
    'chart.moonSign': 'Moon Sign',
    'chart.ascendant': 'Ascendant',
    'chart.planets': 'Planets',
    'chart.houses': 'Houses',
    'chart.aspects': 'Aspects',

    // Horoscope
    'horoscope.daily': 'Daily Horoscope',
    'horoscope.love': 'Love Horoscope',
    'horoscope.career': 'Career Horoscope',
    'horoscope.weekly': 'Weekly Horoscope',
    'horoscope.monthly': 'Monthly Horoscope',

    // Chat
    'chat.title': 'Chat with AI Astrologer',
    'chat.placeholder': 'Ask me anything about astrology...',
    'chat.welcome': "Welcome! I'm your personal AI astrologer.",
    'chat.askBirthDetails': 'Please share your birth details for a personalized reading.',

    // Pricing
    'pricing.title': 'Choose Your Plan',
    'pricing.free': 'Free',
    'pricing.premium': 'Premium',
    'pricing.monthly': 'Monthly',
    'pricing.yearly': 'Yearly',
    'pricing.subscribe': 'Subscribe',
    'pricing.currentPlan': 'Current Plan',

    // GDPR
    'gdpr.cookieConsent': 'We use cookies to enhance your experience.',
    'gdpr.accept': 'Accept',
    'gdpr.reject': 'Reject',
    'gdpr.learnMore': 'Learn More',
    'gdpr.exportData': 'Export My Data',
    'gdpr.deleteData': 'Delete My Account',
    'gdpr.dataRights': 'Your Data Rights',

    // Zodiac Signs
    'zodiac.aries': 'Aries',
    'zodiac.taurus': 'Taurus',
    'zodiac.gemini': 'Gemini',
    'zodiac.cancer': 'Cancer',
    'zodiac.leo': 'Leo',
    'zodiac.virgo': 'Virgo',
    'zodiac.libra': 'Libra',
    'zodiac.scorpio': 'Scorpio',
    'zodiac.sagittarius': 'Sagittarius',
    'zodiac.capricorn': 'Capricorn',
    'zodiac.aquarius': 'Aquarius',
    'zodiac.pisces': 'Pisces',

    // Planets
    'planet.sun': 'Sun',
    'planet.moon': 'Moon',
    'planet.mercury': 'Mercury',
    'planet.venus': 'Venus',
    'planet.mars': 'Mars',
    'planet.jupiter': 'Jupiter',
    'planet.saturn': 'Saturn',
    'planet.uranus': 'Uranus',
    'planet.neptune': 'Neptune',
    'planet.pluto': 'Pluto',

    // Aspects
    'aspect.conjunction': 'Conjunction',
    'aspect.sextile': 'Sextile',
    'aspect.square': 'Square',
    'aspect.trine': 'Trine',
    'aspect.opposition': 'Opposition',
  },

  es: {
    'app.name': 'Astrology Platform',
    'app.tagline': 'Discover Your Cosmic Path',
    'nav.home': 'Inicio',
    'nav.dashboard': 'Panel',
    'nav.chart': 'Carta Natal',
    'nav.horoscope': 'Horóscopo',
    'nav.chat': 'Astrólogo IA',
    'auth.login': 'Iniciar Sesión',
    'auth.signup': 'Registrarse',
    'auth.email': 'Correo',
    'auth.password': 'Contraseña',
    'chart.title': 'Carta Natal',
    'chart.birthDate': 'Fecha de Nacimiento',
    'chart.birthTime': 'Hora de Nacimiento',
    'chart.birthPlace': 'Lugar de Nacimiento',
    'horoscope.daily': 'Horóscopo Diario',
    'horoscope.love': 'Horóscopo de Amor',
    'horoscope.career': 'Horóscopo de Carrera',
    'zodiac.aries': 'Aries',
    'zodiac.taurus': 'Tauro',
    'zodiac.gemini': 'Géminis',
    'zodiac.cancer': 'Cáncer',
    'zodiac.leo': 'Leo',
    'zodiac.virgo': 'Virgo',
    'zodiac.libra': 'Libra',
    'zodiac.scorpio': 'Escorpio',
    'zodiac.sagittarius': 'Sagitario',
    'zodiac.capricorn': 'Capricornio',
    'zodiac.aquarius': 'Acuario',
    'zodiac.pisces': 'Piscis',
  },

  fr: {
    'app.name': 'Astrology Platform',
    'app.tagline': 'Discover Your Cosmic Path',
    'nav.home': 'Accueil',
    'nav.dashboard': 'Tableau de Bord',
    'nav.chart': 'Carte Natal',
    'nav.horoscope': 'Horoscope',
    'nav.chat': 'Astrologue IA',
    'auth.login': 'Connexion',
    'auth.signup': "S'inscrire",
    'auth.email': 'Email',
    'auth.password': 'Mot de passe',
    'chart.title': 'Carte Natal',
    'chart.birthDate': 'Date de Naissance',
    'chart.birthTime': 'Heure de Naissance',
    'chart.birthPlace': 'Lieu de Naissance',
    'horoscope.daily': 'Horoscope Quotidien',
    'horoscope.love': 'Horoscope Amour',
    'horoscope.career': 'Horoscope Carrière',
  },

  de: {
    'app.name': 'Astrology Platform',
    'app.tagline': 'Discover Your Cosmic Path',
    'nav.home': 'Startseite',
    'nav.dashboard': 'Dashboard',
    'nav.chart': 'Geburtschart',
    'nav.horoscope': 'Horoskop',
    'nav.chat': 'KI Astrologe',
    'auth.login': 'Anmelden',
    'auth.signup': 'Registrieren',
    'auth.email': 'E-Mail',
    'auth.password': 'Passwort',
    'chart.title': 'Geburtschart',
    'chart.birthDate': 'Geburtsdatum',
    'chart.birthTime': 'Geburtszeit',
    'chart.birthPlace': 'Geburtsort',
    'horoscope.daily': 'Tageshoroskop',
    'horoscope.love': 'Liebeshoroskop',
    'horoscope.career': 'Karrierehoroskop',
  },

  hi: {
    'app.name': 'Astrology Platform',
    'app.tagline': 'Discover Your Cosmic Path',
    'nav.home': 'होम',
    'nav.dashboard': 'डैशबोर्ड',
    'nav.chart': 'जन्म पत्र',
    'nav.horoscope': 'राशिफल',
    'nav.chat': 'AI ज्योतिषी',
    'auth.login': 'लॉग इन',
    'auth.signup': 'साइन अप',
    'auth.email': 'ईमेल',
    'auth.password': 'पासवर्ड',
    'chart.title': 'जन्म पत्र',
    'chart.birthDate': 'जन्म तिथि',
    'chart.birthTime': 'जन्म समय',
    'chart.birthPlace': 'जन्म स्थान',
    'horoscope.daily': 'दैनिक राशिफल',
    'zodiac.aries': 'मेष',
    'zodiac.taurus': 'वृषभ',
    'zodiac.gemini': 'मिथुन',
    'zodiac.cancer': 'कर्क',
    'zodiac.leo': 'सिंह',
    'zodiac.virgo': 'कन्या',
    'zodiac.libra': 'तुला',
    'zodiac.scorpio': 'वृश्चिक',
    'zodiac.sagittarius': 'धनु',
    'zodiac.capricorn': 'मकर',
    'zodiac.aquarius': 'कुंभ',
    'zodiac.pisces': 'मीन',
  },

  zh: {
    'app.name': 'Astrology Platform',
    'app.tagline': 'Discover Your Cosmic Path',
    'nav.home': '首页',
    'nav.dashboard': '仪表板',
    'nav.chart': '出生图',
    'nav.horoscope': '星座运势',
    'nav.chat': 'AI占星师',
    'auth.login': '登录',
    'auth.signup': '注册',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'chart.title': '出生图',
    'chart.birthDate': '出生日期',
    'chart.birthTime': '出生时间',
    'chart.birthPlace': '出生地点',
    'horoscope.daily': '每日运势',
    'zodiac.aries': '白羊座',
    'zodiac.taurus': '金牛座',
    'zodiac.gemini': '双子座',
    'zodiac.cancer': '巨蟹座',
    'zodiac.leo': '狮子座',
    'zodiac.virgo': '处女座',
    'zodiac.libra': '天秤座',
    'zodiac.scorpio': '天蝎座',
    'zodiac.sagittarius': '射手座',
    'zodiac.capricorn': '摩羯座',
    'zodiac.aquarius': '水瓶座',
    'zodiac.pisces': '双鱼座',
  },

  ja: {
    'app.name': 'Astrology Platform',
    'app.tagline': 'Discover Your Cosmic Path',
    'nav.home': 'ホーム',
    'nav.dashboard': 'ダッシュボード',
    'nav.chart': '出生図',
    'nav.horoscope': '星座占い',
    'nav.chat': 'AI占星師',
    'auth.login': 'ログイン',
    'auth.signup': '登録',
    'chart.birthDate': '生年月日',
    'chart.birthTime': '出生時間',
    'chart.birthPlace': '出生地',
    'horoscope.daily': '今日の占い',
    'zodiac.aries': '牡羊座',
    'zodiac.taurus': '牡牛座',
    'zodiac.gemini': '双子座',
    'zodiac.cancer': '蟹座',
    'zodiac.leo': '獅子座',
    'zodiac.virgo': '乙女座',
    'zodiac.libra': '天秤座',
    'zodiac.scorpio': '蠍座',
    'zodiac.sagittarius': '射手座',
    'zodiac.capricorn': '山羊座',
    'zodiac.aquarius': '水瓶座',
    'zodiac.pisces': '魚座',
  },

  // Add empty translations for remaining languages (will fallback to English)
  pt: {},
  ru: {},
  ar: {},
  ko: {},
  tr: {},
  nl: {},
  pl: {},
  it: {},
}

/**
 * Get translation for a key in a specific language
 */
export function t(key: string, language: LanguageCode = 'en'): string {
  const langTranslations = translations[language] || translations.en
  return langTranslations[key] || translations.en[key] || key
}

/**
 * Get user's preferred language from Accept-Language header or stored preference
 */
export function getPreferredLanguage(
  acceptLanguage?: string,
  storedLanguage?: LanguageCode
): LanguageCode {
  if (storedLanguage && SUPPORTED_LANGUAGES.some(l => l.code === storedLanguage)) {
    return storedLanguage
  }

  if (acceptLanguage) {
    const preferred = acceptLanguage.split(',')[0].split('-')[0].toLowerCase()
    const matched = SUPPORTED_LANGUAGES.find(l => l.code === preferred)
    if (matched) return matched.code
  }

  return 'en'
}

/**
 * Get locale string for date formatting
 */
export function getLocale(language: LanguageCode): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === language)
  return lang?.locale || 'en-US'
}
