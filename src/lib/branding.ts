/**
 * Runtime brand configuration.
 *
 * Each tenant stores a partial BrandConfig JSON on Tenant.branding. It is merged
 * over DEFAULT_BRANDING at request time (src/lib/tenant.ts) and applied via CSS
 * variables injected by the root layout. Components should read the active brand
 * through the BrandProvider context (src/components/BrandProvider.tsx) - never
 * import constants directly.
 */

export interface BrandColors {
  background: string
  foreground: string
  primary: string
  primaryDark: string
  primaryLight: string
  primaryGlow: string
  secondary: string
  secondaryDark: string
  secondaryLight: string
  silver: string
  silverLight: string
  silverDark: string
  accentPink: string
  accentCyan: string
  accentAmber: string
  accentEmerald: string
  muted: string
  card: string
  border: string
}

export interface BrandSeo {
  title?: string
  description?: string
  siteName?: string
}

export interface BrandConfig {
  name: string
  shortName: string
  tagline: string
  logoUrl: string | null
  faviconUrl: string | null
  colors: BrandColors
  seo: BrandSeo
  // Tailwind-ready gradient/glass utilities built from the brand palette
  visual: {
    gradient: string
    gradientHorizontal: string
    gradientText: string
    glass: string
    glow: string
  }
}

export type BrandConfigInput = Partial<Omit<BrandConfig, 'colors' | 'seo' | 'visual'>> & {
  colors?: Partial<BrandColors>
  seo?: Partial<BrandSeo>
}

// Tailwind utility strings built ONLY from CSS variables, so they re-color
// automatically per tenant once the layout injects the brand variables.
const VISUAL: BrandConfig['visual'] = {
  gradient:
    'bg-gradient-to-br from-[var(--primary)] via-[var(--primary-dark)] to-[var(--background)]',
  gradientHorizontal:
    'bg-gradient-to-r from-[var(--primary)] via-[var(--primary-light)] to-[var(--primary-glow)]',
  gradientText:
    'bg-gradient-to-r from-[var(--silver-light)] via-[var(--foreground)] to-[var(--silver)] bg-clip-text text-transparent',
  glass: 'backdrop-blur-xl bg-[var(--card)]/60 border border-[var(--border)]/30',
  glow: 'shadow-[0_0_40px_-10px_var(--primary)]',
}

export const DEFAULT_BRANDING: BrandConfig = {
  name: 'StarPath Astrology',
  shortName: 'StarPath',
  tagline: 'Navigate Your Cosmic Journey',
  logoUrl: null,
  faviconUrl: null,
  colors: {
    background: '#0F0A1F',
    foreground: '#FFFFFF',
    primary: '#7C3AED',
    primaryDark: '#5B21B6',
    primaryLight: '#A78BFA',
    primaryGlow: '#C4B5FD',
    secondary: '#E5E7EB',
    secondaryDark: '#6B7280',
    secondaryLight: '#F9FAFB',
    silver: '#C0C0C0',
    silverLight: '#E8E8E8',
    silverDark: '#9CA3AF',
    accentPink: '#EC4899',
    accentCyan: '#06B6D4',
    accentAmber: '#F59E0B',
    accentEmerald: '#10B981',
    muted: '#1A1025',
    card: '#1A1025',
    border: '#7C3AED',
  },
  seo: {
    title: 'StarPath Astrology - Navigate Your Cosmic Journey',
    description:
      'Discover personalized astrology readings, birth charts, daily horoscopes, and celestial guidance powered by AI.',
    siteName: 'StarPath Astrology',
  },
  visual: VISUAL,
}

export function mergeBranding(input?: BrandConfigInput | null): BrandConfig {
  if (!input || typeof input !== 'object') {
    return DEFAULT_BRANDING
  }
  const colors: BrandColors = { ...DEFAULT_BRANDING.colors, ...(input.colors ?? {}) }
  const name = input.name ?? DEFAULT_BRANDING.name
  const tagline = input.tagline ?? DEFAULT_BRANDING.tagline
  const seo: BrandSeo = {
    title: input.seo?.title ?? `${name} - ${tagline}`,
    description: input.seo?.description ?? DEFAULT_BRANDING.seo.description ?? '',
    siteName: input.seo?.siteName ?? name,
  }
  const merged: BrandConfig = {
    ...DEFAULT_BRANDING,
    name,
    shortName: input.shortName ?? (input.name ? input.name : DEFAULT_BRANDING.shortName),
    tagline,
    logoUrl: input.logoUrl ?? null,
    faviconUrl: input.faviconUrl ?? null,
    colors,
    seo,
    visual: VISUAL,
  }
  if (input.name === undefined && input.shortName === undefined)
    merged.shortName = DEFAULT_BRANDING.shortName
  return merged
}

const CSS_VAR_MAP: Array<[keyof BrandColors, string]> = [
  ['background', '--background'],
  ['foreground', '--foreground'],
  ['primary', '--primary'],
  ['primaryDark', '--primary-dark'],
  ['primaryLight', '--primary-light'],
  ['primaryGlow', '--primary-glow'],
  ['secondary', '--secondary'],
  ['secondaryDark', '--secondary-dark'],
  ['secondaryLight', '--secondary-light'],
  ['silver', '--silver'],
  ['silverLight', '--silver-light'],
  ['silverDark', '--silver-dark'],
  ['accentPink', '--accent-pink'],
  ['accentCyan', '--accent-cyan'],
  ['accentAmber', '--accent-amber'],
  ['accentEmerald', '--accent-emerald'],
  ['muted', '--muted'],
  ['card', '--card'],
  ['border', '--border'],
]

export function brandToCssRules(brand: BrandConfig): string {
  const decls = CSS_VAR_MAP.map(([key, cssVar]) => `${cssVar}:${brand.colors[key]}`).join(';')
  return `:root{${decls}}`
}
