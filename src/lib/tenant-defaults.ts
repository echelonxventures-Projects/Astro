/**
 * Per-tenant onboarding defaults: region/currency template + locale (language)
 * configuration. Templates are starting points stored in the DB and fully
 * editable afterwards via the admin UI.
 */

export interface RegionTemplate {
  key: string
  name: string
  code: string
  currency: string
  currencies: Array<{ code: string; symbol: string; name: string }> | null
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  priceMultiplier: number
}

// Region/currency template applied to each newly provisioned tenant.
export const DEFAULT_REGION_TEMPLATE: RegionTemplate[] = [
  {
    key: 'us',
    name: 'United States',
    code: 'US',
    currency: 'usd',
    currencies: [{ code: 'usd', symbol: '$', name: 'US Dollar' }],
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    priceMultiplier: 1.0,
  },
  {
    key: 'eu',
    name: 'Europe',
    code: 'EU',
    currency: 'eur',
    currencies: [
      { code: 'eur', symbol: '€', name: 'Euro' },
      { code: 'gbp', symbol: '£', name: 'British Pound' },
    ],
    isActive: true,
    isDefault: false,
    sortOrder: 1,
    priceMultiplier: 0.92,
  },
  {
    key: 'in',
    name: 'India',
    code: 'IN',
    currency: 'inr',
    currencies: [{ code: 'inr', symbol: '₹', name: 'Indian Rupee' }],
    isActive: true,
    isDefault: false,
    sortOrder: 2,
    priceMultiplier: 83.5,
  },
  {
    key: 'uk',
    name: 'United Kingdom',
    code: 'GB',
    currency: 'gbp',
    currencies: [{ code: 'gbp', symbol: '£', name: 'British Pound' }],
    isActive: true,
    isDefault: false,
    sortOrder: 3,
    priceMultiplier: 0.79,
  },
  {
    key: 'global',
    name: 'Global',
    code: 'GLOBAL',
    currency: 'usd',
    currencies: [
      { code: 'usd', symbol: '$', name: 'US Dollar' },
      { code: 'eur', symbol: '€', name: 'Euro' },
      { code: 'gbp', symbol: '£', name: 'British Pound' },
      { code: 'inr', symbol: '₹', name: 'Indian Rupee' },
    ],
    isActive: true,
    isDefault: false,
    sortOrder: 4,
    priceMultiplier: 1.0,
  },
]

export interface LocaleConfig {
  supportedLanguages: string[]
  defaultLanguage: string
  currencyRegion: string // default region key
}

export const DEFAULT_LOCALE: LocaleConfig = {
  supportedLanguages: ['en'],
  defaultLanguage: 'en',
  currencyRegion: 'us',
}

export function mergeLocale(existing: Partial<LocaleConfig> | null | undefined): LocaleConfig {
  return {
    supportedLanguages: existing?.supportedLanguages?.length
      ? existing.supportedLanguages
      : DEFAULT_LOCALE.supportedLanguages,
    defaultLanguage: existing?.defaultLanguage || DEFAULT_LOCALE.defaultLanguage,
    currencyRegion: existing?.currencyRegion || DEFAULT_LOCALE.currencyRegion,
  }
}
