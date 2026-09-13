/**
 * Tenant-aware PWA manifest (replaces the static public/manifest.webmanifest)
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/tenant'

export async function GET(): Promise<NextResponse> {
  let brand = {
    name: 'Astrology Platform',
    shortName: 'Astrology',
    tagline: 'Navigate Your Cosmic Journey',
    primary: '#7C3AED',
    background: '#0F0A1F',
    faviconUrl: null as string | null,
    logoUrl: null as string | null,
  }
  try {
    const ctx = await getTenantContext()
    brand = {
      name: `${ctx.branding.name} - ${ctx.branding.tagline}`,
      shortName: ctx.branding.shortName,
      tagline: ctx.branding.tagline,
      primary: ctx.branding.colors.primary,
      background: ctx.branding.colors.background,
      faviconUrl: ctx.branding.faviconUrl,
      logoUrl: ctx.branding.logoUrl,
    }
  } catch {
    /* unknown tenant -> generic manifest */
  }

  const icons = [
    ...(brand.faviconUrl ? [{ src: brand.faviconUrl, sizes: 'any', type: 'image/x-icon' }] : []),
    { src: brand.logoUrl ?? '/favicon.ico', sizes: '192x192', type: 'image/png' },
  ]

  return NextResponse.json(
    {
      name: brand.name,
      short_name: brand.shortName,
      description: brand.tagline,
      start_url: '/dashboard',
      display: 'standalone',
      background_color: brand.background,
      theme_color: brand.primary,
      orientation: 'portrait-primary',
      icons,
      categories: ['lifestyle', 'entertainment'],
      shortcuts: [
        { name: 'Dashboard', url: '/dashboard', description: 'View your astrology dashboard' },
        {
          name: 'Daily Horoscope',
          url: '/horoscope/daily',
          description: 'Read your daily horoscope',
        },
        { name: 'Birth Chart', url: '/chart', description: 'Generate your birth chart' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=60',
      },
    }
  )
}
