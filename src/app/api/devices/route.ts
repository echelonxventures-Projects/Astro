export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getUserDevices,
  revokeDevice,
  revokeOtherDevices,
  getDeviceCount,
} from '@/lib/device-manager'
import { logError } from '@/lib/logger'

/**
 * GET /api/devices
 * Get all active devices for current user
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const devices = await getUserDevices(session.user.id)
    const count = await getDeviceCount(session.user.id)

    return NextResponse.json({
      devices,
      count,
    })
  } catch (error) {
    logError('Error fetching devices', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
  }
}

/**
 * POST /api/devices
 * Revoke a device or revoke all other devices
 */
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await _req.json()
    const { action, deviceId, currentSessionId } = body

    if (action === 'revoke' && deviceId) {
      await revokeDevice(session.user.id, deviceId)
      return NextResponse.json({
        success: true,
        message: 'Device revoked successfully',
      })
    }

    if (action === 'revokeOthers' && currentSessionId) {
      const count = await revokeOtherDevices(session.user.id, currentSessionId)
      return NextResponse.json({
        success: true,
        message: `Revoked ${count} other devices`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    logError('Error managing devices', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to manage devices' }, { status: 500 })
  }
}
