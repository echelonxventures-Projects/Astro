import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import { BrandProvider } from '@/components/BrandProvider'
import { LocaleProvider } from '@/components/LocaleProvider'
import MonitoringProvider from '@/components/MonitoringProvider'
import { brandToCssRules, DEFAULT_BRANDING, type BrandConfig } from '@/lib/branding'
import { getTenantContext, TenantNotActiveError } from '@/lib/tenant'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

interface ResolvedLayout {
  brand: BrandConfig
  ok: boolean
  host: string
  suspended: boolean
  locales: { supportedLanguages: string[]; defaultLanguage: string; currencyRegion: string }
}

const FALLBACK_LOCALES = { supportedLanguages: ['en'], defaultLanguage: 'en', currencyRegion: 'us' }

async function resolveBrand(): Promise<ResolvedLayout> {
  const host = (await headers()).get('host') ?? 'localhost'
  try {
    const ctx = await getTenantContext()
    return {
      brand: ctx.branding,
      ok: true,
      host,
      suspended: false,
      locales: {
        supportedLanguages:
          ctx.settings.locales?.supportedLanguages ?? FALLBACK_LOCALES.supportedLanguages,
        defaultLanguage: ctx.settings.locales?.defaultLanguage ?? FALLBACK_LOCALES.defaultLanguage,
        currencyRegion: ctx.settings.locales?.currencyRegion ?? FALLBACK_LOCALES.currencyRegion,
      },
    }
  } catch (error) {
    const suspended = error instanceof TenantNotActiveError
    return { brand: DEFAULT_BRANDING, ok: false, host, suspended, locales: FALLBACK_LOCALES }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await resolveBrand()
  const title = brand.seo.title ?? `${brand.name} - ${brand.tagline}`
  const description = brand.seo.description ?? brand.tagline
  return {
    metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
    title,
    description,
    keywords:
      'Astrology, Horoscope, Birth Chart, Natal Chart, AI Astrology, Daily Horoscope, Love Horoscope, Career Horoscope, Compatibility, Zodiac Signs',
    manifest: '/manifest.webmanifest',
    icons: brand.faviconUrl ? { icon: brand.faviconUrl } : undefined,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: brand.name,
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: {
      title,
      description,
      siteName: brand.seo.siteName ?? brand.name,
      images: [
        {
          url: '/og-image.jpeg',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.jpeg'],
    },
  }
}

function UnknownTenant({
  host,
  suspended,
}: {
  host: string
  suspended: boolean
}): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold text-white">
        {suspended ? 'This platform is paused' : 'Unknown platform'}
      </h1>
      <p className="max-w-md text-gray-400">
        {suspended ? (
          <>
            The platform at <span className="text-[var(--primary-light)]">{host}</span> has been
            suspended by its provider. Contact support to reactivate it.
          </>
        ) : (
          <>
            No tenant is configured for <span className="text-[var(--primary-light)]">{host}</span>.
            Add this domain in the admin portal or use a configured hostname.
          </>
        )}
      </p>
    </main>
  )
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): Promise<React.ReactElement> {
  const { brand, ok, host, suspended, locales } = await resolveBrand()
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gradient-to-b from-[var(--background)] via-[var(--muted)] to-[var(--background)] text-[var(--foreground)]">
        <style id="tenant-theme" dangerouslySetInnerHTML={{ __html: brandToCssRules(brand) }} />
        {ok ? (
          <LocaleProvider config={locales}>
            <BrandProvider brand={brand}>
              <AuthProvider>
                <MonitoringProvider>{children}</MonitoringProvider>
              </AuthProvider>
            </BrandProvider>
          </LocaleProvider>
        ) : (
          <UnknownTenant host={host} suspended={suspended} />
        )}
      </body>
    </html>
  )
}
