/**
 * Admin API for payment gateway management
 * Admin-only access
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getScopedDb } from '@/lib/tenant'

async function checkAdmin(): Promise<Awaited<ReturnType<typeof auth>>> {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    throw new Error('Admin access required')
  }

  return session
}

export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin()
    if (!session?.user) throw new Error('Unauthorized')
    const db = getScopedDb(session.user.tenantId!)

    const url = new URL(req.url)
    const type = url.searchParams.get('type')

    if (type === 'gateways') {
      const gateways = await db.paymentGateway.findMany({
        include: {
          paymentMethods: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json({ gateways })
    }

    if (type === 'plans') {
      const plans = await db.gatewayPlan.findMany({
        include: {
          gateway: {
            select: { name: true, key: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json({ plans })
    }

    if (type === 'transactions') {
      const transactions = await db.paymentTransaction.findMany({
        include: {
          user: {
            select: { email: true, name: true },
          },
          gateway: {
            select: { name: true, key: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      return NextResponse.json({ transactions })
    }

    // Default: return all gateways with methods
    const gateways = await db.paymentGateway.findMany({
      include: {
        paymentMethods: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ gateways })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    logError('Error fetching payment data', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin()
    if (!session?.user) throw new Error('Unauthorized')
    const db = getScopedDb(session.user.tenantId!)

    const body = await req.json()
    const { action, ...data } = body

    switch (action) {
      case 'toggleGateway': {
        const gateway = await db.paymentGateway.update({
          where: { id: data.id },
          data: { isEnabled: data.isEnabled },
        })
        return NextResponse.json({ gateway })
      }

      case 'setDefaultGateway': {
        // First unset all defaults
        await db.paymentGateway.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })

        // Then set the new default
        const gateway = await db.paymentGateway.update({
          where: { id: data.id },
          data: { isDefault: true },
        })
        return NextResponse.json({ gateway })
      }

      case 'createGateway':
      case 'updateGateway': {
        const gatewayData = {
          tenantId: session.user.tenantId!,
          name: data.name,
          key: data.key,
          description: data.description,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
          publicKey: data.publicKey,
          webhookSecret: data.webhookSecret,
          isEnabled: data.isEnabled,
          isDefault: data.isDefault,
          testMode: data.testMode,
          sortOrder: data.sortOrder,
          supportedCurrencies: data.supportedCurrencies,
          supportedCountries: data.supportedCountries,
          config: data.config,
        }

        if (data.id) {
          // Update existing
          const gateway = await db.paymentGateway.update({
            where: { id: data.id },
            data: gatewayData,
          })
          return NextResponse.json({ gateway })
        } else {
          // Create new
          const gateway = await db.paymentGateway.create({
            data: gatewayData,
          })
          return NextResponse.json({ gateway })
        }
      }

      case 'togglePaymentMethod': {
        const method = await db.paymentMethod.update({
          where: { id: data.methodId },
          data: { isEnabled: data.isEnabled },
        })
        return NextResponse.json({ method })
      }

      case 'createPaymentMethod': {
        const method = await db.paymentMethod.create({
          data: {
            gatewayId: data.gatewayId,
            name: data.name,
            key: data.key,
            description: data.description,
            icon: data.icon,
            isEnabled: data.isEnabled ?? true,
            sortOrder: data.sortOrder ?? 0,
            supportedCurrencies: data.supportedCurrencies,
            supportedCountries: data.supportedCountries,
          },
        })
        return NextResponse.json({ method })
      }

      case 'updateGatewayPlan': {
        const plan = await db.gatewayPlan.update({
          where: { id: data.id },
          data: {
            name: data.name,
            price: data.price,
            currency: data.currency,
            interval: data.interval,
            isActive: data.isActive,
            isPopular: data.isPopular,
            sortOrder: data.sortOrder,
          },
        })
        return NextResponse.json({ plan })
      }

      case 'createGatewayPlan': {
        const plan = await db.gatewayPlan.create({
          data: {
            gatewayId: data.gatewayId,
            planId: data.planId,
            gatewayPlanId: data.gatewayPlanId,
            name: data.name,
            price: data.price,
            currency: data.currency,
            interval: data.interval,
            isActive: data.isActive ?? true,
            isPopular: data.isPopular ?? false,
            sortOrder: data.sortOrder ?? 0,
          },
        })
        return NextResponse.json({ plan })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    logError('Error managing payment', error)
    return NextResponse.json({ error: 'Failed to manage payment' }, { status: 500 })
  }
}
