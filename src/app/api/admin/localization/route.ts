/**
 * Tenant localization settings (languages + default region/currency)
 * GET  -> { locale, regions }   (regions = this tenant's active regions)
 * PATCH -> merge locale + set default region
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { logError } from '@/lib/logger'
import { getTenantContext, TenantNotFoundError } from '@/lib/tenant'
import { mergeLocale } from '@/lib/tenant-defaults'

export type LocalizationBody = {
  supportedLanguages?: string[]
  defaultLanguage?: string
  defaultRegionKey?: string
}

async function checkAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
    throw new Error('Admin access required')
  }
  const ctx = await getTenantContext()
  if (session.user.tenantId !== ctx.tenantId) throw new Error('Unauthorized')
  return ctx
}

export async function GET() {
  try {
    const ctx = await checkAdmin()
    const regions = await prisma.region.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({
      locale: mergeLocale(ctx.settings.locales),
      regions: regions.map(r => ({
        key: r.key,
        name: r.name,
        code: r.code,
        currency: r.currency,
        isDefault: r.isDefault,
        priceMultiplier: r.priceMultiplier,
      })),
    })
  } catch (error: unknown) {
    if (error instanceof TenantNotFoundError)
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Localization GET error', error)
    return NextResponse.json({ error: 'Failed to load localization' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await checkAdmin()
    const body = (await req.json()) as LocalizationBody

    const validCodes: Set<string> = new Set(SUPPORTED_LANGUAGES.map(l => l.code))
    const supported: string[] = (body.supportedLanguages ?? []).filter(c => validCodes.has(c))
    const defaultLanguage: string =
      body.defaultLanguage && validCodes.has(body.defaultLanguage) ? body.defaultLanguage : 'en'
    if (supported.length > 0 && !supported.includes(defaultLanguage)) {
      return NextResponse.json(
        { error: 'Default language must be one of the supported languages' },
        { status: 400 }
      )
    }

    if (body.defaultRegionKey) {
      const region = await prisma.region.findUnique({
        where: { tenantId_key: { tenantId: ctx.tenantId, key: body.defaultRegionKey } },
      })
      if (!region)
        return NextResponse.json({ error: 'Unknown region for this platform' }, { status: 400 })
      await prisma.region.updateMany({
        where: { tenantId: ctx.tenantId },
        data: { isDefault: false },
      })
      await prisma.region.update({ where: { id: region.id }, data: { isDefault: true } })
    }

    const locales = {
      supportedLanguages: supported.length
        ? supported
        : mergeLocale(ctx.settings.locales).supportedLanguages,
      defaultLanguage: supported.length
        ? defaultLanguage
        : mergeLocale(ctx.settings.locales).defaultLanguage,
      currencyRegion: body.defaultRegionKey ?? mergeLocale(ctx.settings.locales).currencyRegion,
    }
    const settings = { ...ctx.settings, locales }
    await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: { settings: settings as never },
    })

    return NextResponse.json({ locale: locales })
  } catch (error: unknown) {
    if (error instanceof TenantNotFoundError)
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Admin access required') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    logError('Localization PATCH error', error)
    return NextResponse.json({ error: 'Failed to save localization' }, { status: 500 })
  }
}
