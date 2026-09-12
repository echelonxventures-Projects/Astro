export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getTenantContext } from '@/lib/tenant'

/**
 * GET /api/payment/methods
 * Get available payment methods for a gateway or region
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getTenantContext()
    const searchParams = req.nextUrl.searchParams
    const gateway = searchParams.get('gateway')
    const country = searchParams.get('country')
    const currency = searchParams.get('currency')

    // Get all enabled gateways
    const gateways = await prisma.paymentGateway.findMany({
      where: { tenantId: ctx.tenantId, isEnabled: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        paymentMethods: {
          where: { isEnabled: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    let filteredGateways = gateways

    // Filter by gateway if specified
    if (gateway) {
      filteredGateways = filteredGateways.filter(g => g.key === gateway)
    }

    // Filter by country and currency
    if (country || currency) {
      filteredGateways = filteredGateways.filter(g => {
        if (currency && g.supportedCurrencies) {
          const supportedCurrencies = JSON.parse(g.supportedCurrencies)
          if (!supportedCurrencies.includes(currency.toUpperCase())) {
            return false
          }
        }

        if (country && g.supportedCountries) {
          const supportedCountries = JSON.parse(g.supportedCountries)
          if (!supportedCountries.includes(country.toUpperCase())) {
            return false
          }
        }

        return true
      })
    }

    const result = filteredGateways.map(g => ({
      key: g.key,
      name: g.name,
      description: g.description,
      isDefault: g.isDefault,
      testMode: g.testMode,
      paymentMethods: g.paymentMethods.map(pm => ({
        key: pm.key,
        name: pm.name,
        description: pm.description,
        icon: pm.icon,
        config: pm.config ? JSON.parse(pm.config) : {},
      })),
      supportedCurrencies: g.supportedCurrencies ? JSON.parse(g.supportedCurrencies) : [],
      supportedCountries: g.supportedCountries ? JSON.parse(g.supportedCountries) : [],
    }))

    return NextResponse.json({
      gateways: result,
      total: result.length,
    })
  } catch (error) {
    logError('Error fetching payment methods', error)
    return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 })
  }
}
