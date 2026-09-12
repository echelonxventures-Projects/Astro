export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'
import {
  createAstroProfile,
  getUserProfiles,
  updateAstroProfile,
  setDefaultProfile,
  deleteAstroProfile,
  getProfileOptions,
  getProfileWithChart,
} from '@/lib/profiles'

/**
 * GET /api/profiles
 * Get all astro profiles for current user
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const profileId = url.searchParams.get('id')
    const format = url.searchParams.get('format')

    // Get specific profile with chart
    if (profileId) {
      const data = await getProfileWithChart(profileId, session.user.id)
      if (!data) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }
      return NextResponse.json(data)
    }

    // Get options format (for dropdowns)
    if (format === 'options') {
      const options = await getProfileOptions(session.user.id)
      return NextResponse.json({ options })
    }

    // Get all profiles
    const profiles = await getUserProfiles(session.user.id)
    return NextResponse.json({ profiles })
  } catch (error) {
    logError('Error fetching profiles', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }
}

/**
 * POST /api/profiles
 * Create a new astro profile
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      name,
      relationship,
      birthDate,
      birthTime,
      birthPlace,
      latitude,
      longitude,
      timezone,
      gender,
      notes,
    } = body

    if (!name || !birthDate || !birthTime || !birthPlace || !latitude || !longitude) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const profile = await createAstroProfile({
      tenantId: session.user.tenantId!,
      userId: session.user.id,
      name,
      relationship,
      birthDate: new Date(birthDate),
      birthTime,
      birthPlace,
      latitude,
      longitude,
      timezone: timezone || 'UTC',
      gender,
      notes,
    })

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    logError('Error creating profile', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }
}

/**
 * PATCH /api/profiles
 * Update a profile
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { profileId, updates, setAsDefault } = body

    if (!profileId) {
      return NextResponse.json({ error: 'Missing profileId' }, { status: 400 })
    }

    if (setAsDefault) {
      await setDefaultProfile(profileId, session.user.id)
      return NextResponse.json({
        success: true,
        message: 'Profile set as default',
      })
    }

    if (updates) {
      const profile = await updateAstroProfile(
        profileId,
        session.user.id,
        updates.birthDate ? { ...updates, birthDate: new Date(updates.birthDate) } : updates
      )
      return NextResponse.json({
        success: true,
        profile,
      })
    }

    return NextResponse.json({ error: 'No action specified' }, { status: 400 })
  } catch (error) {
    logError('Error updating profile', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

/**
 * DELETE /api/profiles
 * Delete a profile
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const profileId = url.searchParams.get('id')

    if (!profileId) {
      return NextResponse.json({ error: 'Missing profile id' }, { status: 400 })
    }

    await deleteAstroProfile(profileId, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Profile deleted',
    })
  } catch (error: any) {
    logError('Error deleting profile', error, { userId: session.user.id })
    return NextResponse.json(
      { error: error.message || 'Failed to delete profile' },
      { status: 500 }
    )
  }
}
