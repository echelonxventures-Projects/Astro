/**
 * GDPR Compliance Utilities
 * Handles data export, deletion, and consent management
 */

import { prisma } from '@/lib/db'

export interface GDPRConsent {
  userId: string
  analyticsConsent: boolean
  marketingConsent: boolean
  thirdPartyConsent: boolean
  cookieConsent: boolean
  consentedAt: Date
  consentVersion: string
}

/**
 * Record user consent preferences
 */
export async function recordConsent(
  userId: string,
  consents: {
    analytics?: boolean
    marketing?: boolean
    thirdParty?: boolean
    cookies?: boolean
  }
): Promise<void> {
  // Update user's consent preferences
  await prisma.user.update({
    where: { id: userId },
    data: {
      // Store consent in metadata field
      gatewayMetadata: JSON.stringify({
        gdprConsent: {
          analytics: consents.analytics ?? false,
          marketing: consents.marketing ?? false,
          thirdParty: consents.thirdParty ?? false,
          cookies: consents.cookies ?? false,
          consentedAt: new Date(),
          consentVersion: '1.0',
        },
      }),
    },
  })
}

/**
 * Get user's consent preferences
 */
export async function getConsent(userId: string): Promise<GDPRConsent | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gatewayMetadata: true },
  })

  if (!user?.gatewayMetadata) return null

  try {
    const metadata = JSON.parse(user.gatewayMetadata)
    return metadata.gdprConsent || null
  } catch {
    return null
  }
}

/**
 * Export all user data (GDPR right to access)
 */
export async function exportUserData(userId: string): Promise<{
  user: any
  birthCharts: any[]
  readings: any[]
  chatSessions: any[]
  payments: any[]
  subscriptions: any[]
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      birthDate: true,
      birthTime: true,
      birthPlace: true,
      subscriptionStatus: true,
      createdAt: true,
      updatedAt: true,
      gatewayMetadata: true,
    },
  })

  const birthCharts = await prisma.birthChart.findMany({
    where: { userId },
  })

  const readings = await prisma.reading.findMany({
    where: { userId },
  })

  const chatSessions = await prisma.chatSession.findMany({
    where: { userId },
  })

  const payments = await prisma.paymentTransaction.findMany({
    where: { userId },
  })

  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
  })

  return {
    user,
    birthCharts,
    readings,
    chatSessions,
    payments,
    subscriptions,
  }
}

/**
 * Delete all user data (GDPR right to erasure)
 */
export async function deleteUserData(userId: string): Promise<void> {
  // Delete in order to respect foreign key constraints

  // Delete payment transactions
  await prisma.paymentTransaction.deleteMany({
    where: { userId },
  })

  // Delete subscriptions
  await prisma.subscription.deleteMany({
    where: { userId },
  })

  // Delete payments
  await prisma.payment.deleteMany({
    where: { userId },
  })

  // Delete chat sessions
  await prisma.chatSession.deleteMany({
    where: { userId },
  })

  // Delete readings
  await prisma.reading.deleteMany({
    where: { userId },
  })

  // Delete birth charts
  await prisma.birthChart.deleteMany({
    where: { userId },
  })

  // Delete sessions
  await prisma.session.deleteMany({
    where: { userId },
  })

  // Delete accounts (OAuth)
  await prisma.account.deleteMany({
    where: { userId },
  })

  // Finally delete the user
  await prisma.user.delete({
    where: { id: userId },
  })
}

/**
 * Anonymize user data (keep for analytics but remove personal info)
 */
export async function anonymizeUserData(userId: string): Promise<void> {
  const anonymousId = `anonymous_${Date.now()}`

  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `${anonymousId}@deleted.com`,
      name: 'Deleted User',
      image: null,
      birthDate: null,
      birthTime: null,
      birthPlace: null,
      birthLatitude: null,
      birthLongitude: null,
      gatewayMetadata: null,
    },
  })

  // Anonymize chat sessions
  await prisma.chatSession.updateMany({
    where: { userId },
    data: {
      title: 'Deleted Session',
      metadata: {},
    },
  })
}

/**
 * Generate GDPR-compliant data export file
 */
export function generateDataExportJSON(data: any): string {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    exportVersion: '1.0',
    dataSubject: {
      id: data.user?.id,
      email: data.user?.email,
    },
    data: data,
    note: 'This file contains all personal data stored by StarPath Astrology as requested under GDPR Article 20 (Right to Data Portability).',
  }, null, 2)
}