/**
 * Device & Session Management
 * Track and manage user devices and active sessions
 */

import { UAParser } from 'ua-parser-js'
import { prisma } from '@/lib/db'

export interface DeviceInfo {
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  browser: string
  os: string
  ipAddress?: string
  location?: string
  userAgent: string
}

/**
 * Parse user agent string to get device info
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const parser = new UAParser(userAgent)
  const result = parser.getResult()

  const deviceType = (result.device.type as 'desktop' | 'mobile' | 'tablet') || 'unknown'

  // Build device name
  let deviceName = 'Unknown Device'
  if (result.device.model) {
    deviceName = result.device.model
  } else if (result.os.name) {
    deviceName = `${result.os.name} Device`
  }

  // Add vendor if available
  if (result.device.vendor && result.device.model) {
    deviceName = `${result.device.vendor} ${result.device.model}`
  }

  return {
    deviceName,
    deviceType,
    browser: result.browser.name || 'Unknown Browser',
    os: result.os.name || 'Unknown OS',
    userAgent,
  }
}

/**
 * Register a new device/session
 */
export async function registerDevice(
  tenantId: string,
  userId: string,
  sessionId: string,
  userAgent: string,
  ipAddress?: string,
  location?: string
): Promise<void> {
  const deviceInfo = parseUserAgent(userAgent)

  // Create or update device record
  await prisma.userDevice.upsert({
    where: { sessionId },
    create: {
      tenantId,
      userId,
      sessionId,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ipAddress,
      location,
      userAgent,
      isActive: true,
    },
    update: {
      lastActiveAt: new Date(),
      isActive: true,
      ipAddress,
      location,
    },
  })
}

/**
 * Get all active devices for a user
 */
export async function getUserDevices(userId: string): Promise<
  {
    id: string
    deviceName: string | null
    deviceType: string | null
    browser: string | null
    os: string | null
    ipAddress: string | null
    location: string | null
    lastActiveAt: Date
    isActive: boolean
    createdAt: Date
  }[]
> {
  return prisma.userDevice.findMany({
    where: { userId, isActive: true },
    orderBy: { lastActiveAt: 'desc' },
  })
}

/**
 * Revoke a device/session
 */
export async function revokeDevice(userId: string, deviceId: string): Promise<void> {
  const device = await prisma.userDevice.findFirst({
    where: { id: deviceId, userId },
  })

  if (!device) {
    throw new Error('Device not found')
  }

  // Mark device as inactive
  await prisma.userDevice.update({
    where: { id: deviceId },
    data: { isActive: false },
  })

  // Also revoke the NextAuth session if exists
  await prisma.session.deleteMany({
    where: { sessionToken: device.sessionId },
  })
}

/**
 * Revoke all devices except current
 */
export async function revokeOtherDevices(
  userId: string,
  currentSessionId: string
): Promise<number> {
  const devices = await prisma.userDevice.findMany({
    where: {
      userId,
      isActive: true,
      sessionId: { not: currentSessionId },
    },
  })

  // Revoke all other sessions
  for (const device of devices) {
    await prisma.session.deleteMany({
      where: { sessionToken: device.sessionId },
    })
    await prisma.userDevice.update({
      where: { id: device.id },
      data: { isActive: false },
    })
  }

  return devices.length
}

/**
 * Update device last active timestamp
 */
export async function updateDeviceActivity(sessionId: string): Promise<void> {
  await prisma.userDevice.update({
    where: { sessionId },
    data: { lastActiveAt: new Date() },
  })
}

/**
 * Clean up inactive devices (older than 30 days)
 */
export async function cleanupInactiveDevices(): Promise<number> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const result = await prisma.userDevice.deleteMany({
    where: {
      isActive: false,
      lastActiveAt: { lt: thirtyDaysAgo },
    },
  })

  return result.count
}

/**
 * Get device count for a user
 */
export async function getDeviceCount(userId: string): Promise<{
  active: number
  total: number
}> {
  const active = await prisma.userDevice.count({
    where: { userId, isActive: true },
  })

  const total = await prisma.userDevice.count({
    where: { userId },
  })

  return { active, total }
}
