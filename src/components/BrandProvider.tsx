'use client'

import { Sparkles } from 'lucide-react'
import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_BRANDING, type BrandConfig } from '@/lib/branding'

const BrandContext = createContext<BrandConfig>(DEFAULT_BRANDING)

export function BrandProvider({
  brand,
  children,
}: {
  brand: BrandConfig
  children: ReactNode
}): React.ReactElement {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

export function useBrand(): BrandConfig {
  return useContext(BrandContext)
}

export function BrandName({ short = false }: { short?: boolean }): React.ReactElement {
  const brand = useBrand()
  return <>{short ? brand.shortName : brand.name}</>
}

export function BrandTagline(): React.ReactElement {
  const brand = useBrand()
  return <>{brand.tagline}</>
}

export function BrandLogo({
  className = 'h-8 w-8 text-[var(--primary-light)]',
}: {
  className?: string
}): React.ReactElement {
  const brand = useBrand()
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logoUrl} alt={brand.name} className={className} />
    )
  }
  return <Sparkles className={className} />
}
