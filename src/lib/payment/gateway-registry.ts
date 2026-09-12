/**
 * Payment Gateway Registry
 * Factory and registry for managing payment gateways
 */

import { IPaymentGateway, GatewayFactory } from './gateway-interface'
import { prisma } from '@/lib/db'

// Gateway implementations
const gatewayFactories: Map<string, GatewayFactory> = new Map()

/**
 * Register a payment gateway implementation
 */
export function registerGateway(key: string, factory: GatewayFactory) {
  gatewayFactories.set(key, factory)
}

/**
 * Get a gateway instance by key (within tenant)
 */
export async function getGateway(tenantId: string, key: string): Promise<IPaymentGateway | null> {
  const factory = gatewayFactories.get(key)
  if (!factory) {
    return null
  }

  // Load gateway configuration from database
  const gateway = await prisma.paymentGateway.findUnique({
    where: { tenantId_key: { tenantId, key } },
  })

  if (!gateway || !gateway.isEnabled) {
    return null
  }

  const instance = new factory()
  instance.initialize({
    name: gateway.name,
    key: gateway.key,
    apiKey: gateway.apiKey || undefined,
    apiSecret: gateway.apiSecret || undefined,
    publicKey: gateway.publicKey || undefined,
    webhookSecret: gateway.webhookSecret || undefined,
    testMode: gateway.testMode,
    config: gateway.config ? JSON.parse(gateway.config) : {},
  })

  return instance
}

/**
 * Get the default gateway (within tenant)
 */
export async function getDefaultGateway(tenantId: string): Promise<IPaymentGateway | null> {
  const defaultGateway = await prisma.paymentGateway.findFirst({
    where: { tenantId, isEnabled: true, isDefault: true },
  })

  if (defaultGateway) {
    return getGateway(tenantId, defaultGateway.key)
  }

  // Fallback to first enabled gateway
  const firstEnabled = await prisma.paymentGateway.findFirst({
    where: { tenantId, isEnabled: true },
  })

  if (firstEnabled) {
    return getGateway(tenantId, firstEnabled.key)
  }

  return null
}

/**
 * Get all enabled gateways (within tenant)
 */
export async function getEnabledGateways(tenantId: string): Promise<IPaymentGateway[]> {
  const gateways = await prisma.paymentGateway.findMany({
    where: { tenantId, isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  })

  const instances: IPaymentGateway[] = []

  for (const gateway of gateways) {
    const factory = gatewayFactories.get(gateway.key)
    if (factory) {
      const instance = new factory()
      instance.initialize({
        name: gateway.name,
        key: gateway.key,
        apiKey: gateway.apiKey || undefined,
        apiSecret: gateway.apiSecret || undefined,
        publicKey: gateway.publicKey || undefined,
        webhookSecret: gateway.webhookSecret || undefined,
        testMode: gateway.testMode,
        config: gateway.config ? JSON.parse(gateway.config) : {},
      })
      instances.push(instance)
    }
  }

  return instances
}

/**
 * Get available gateways for a specific currency and country
 */
export async function getAvailableGateways(
  tenantId: string,
  currency: string,
  country?: string
): Promise<IPaymentGateway[]> {
  const gateways = await prisma.paymentGateway.findMany({
    where: { tenantId, isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  })

  const available: IPaymentGateway[] = []

  for (const gateway of gateways) {
    // Check currency support
    if (gateway.supportedCurrencies) {
      const supportedCurrencies = JSON.parse(gateway.supportedCurrencies)
      if (!supportedCurrencies.includes(currency.toUpperCase())) {
        continue
      }
    }

    // Check country support
    if (country && gateway.supportedCountries) {
      const supportedCountries = JSON.parse(gateway.supportedCountries)
      if (!supportedCountries.includes(country.toUpperCase())) {
        continue
      }
    }

    const factory = gatewayFactories.get(gateway.key)
    if (factory) {
      const instance = new factory()
      instance.initialize({
        name: gateway.name,
        key: gateway.key,
        apiKey: gateway.apiKey || undefined,
        apiSecret: gateway.apiSecret || undefined,
        publicKey: gateway.publicKey || undefined,
        webhookSecret: gateway.webhookSecret || undefined,
        testMode: gateway.testMode,
        config: gateway.config ? JSON.parse(gateway.config) : {},
      })
      available.push(instance)
    }
  }

  return available
}

/**
 * Get gateway by transaction ID (within tenant)
 */
export async function getGatewayByTransaction(
  tenantId: string,
  gatewayTransactionId: string
): Promise<IPaymentGateway | null> {
  const transaction = await prisma.paymentTransaction.findFirst({
    where: { tenantId, gatewayTransactionId },
    include: { gateway: true },
  })

  if (!transaction) {
    return null
  }

  return getGateway(tenantId, transaction.gateway.key)
}

/**
 * Get available payment methods for a gateway (within tenant)
 */
export async function getPaymentMethods(
  tenantId: string,
  gatewayKey: string,
  currency?: string,
  country?: string
) {
  const gateway = await prisma.paymentGateway.findUnique({
    where: { tenantId_key: { tenantId, key: gatewayKey } },
    include: {
      paymentMethods: {
        where: { isEnabled: true },
      },
    },
  })

  if (!gateway) {
    return []
  }

  return gateway.paymentMethods.filter(method => {
    if (currency && method.supportedCurrencies) {
      const supportedCurrencies = JSON.parse(method.supportedCurrencies)
      if (!supportedCurrencies.includes(currency.toUpperCase())) {
        return false
      }
    }

    if (country && method.supportedCountries) {
      const supportedCountries = JSON.parse(method.supportedCountries)
      if (!supportedCountries.includes(country.toUpperCase())) {
        return false
      }
    }

    return true
  })
}

/**
 * Encrypt sensitive data (API keys, secrets)
 * Uses AES-256-GCM encryption for production security
 */
export async function encryptSensitiveData(data: string): Promise<string> {
  const { encrypt } = await import('@/lib/encryption')
  return encrypt(data)
}

/**
 * Decrypt sensitive data
 */
export async function decryptSensitiveData(encryptedData: string): Promise<string> {
  const { decrypt } = await import('@/lib/encryption')
  return decrypt(encryptedData)
}
