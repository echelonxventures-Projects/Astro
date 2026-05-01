/**
 * Astro Profile Management
 * Multiple astrological profiles under one account (family members, etc.)
 */

import { prisma } from '@/lib/db'
import { generateBirthChart } from '@/lib/astrology/calculations'

export type RelationshipType = 'self' | 'spouse' | 'child' | 'parent' | 'friend' | 'partner' | 'other'

export interface AstroProfileInput {
  userId: string
  name: string
  relationship?: RelationshipType
  birthDate: Date
  birthTime: string
  birthPlace: string
  latitude: number
  longitude: number
  timezone: string
  gender?: string
  notes?: string
}

export interface AstroProfileData {
  id: string
  userId: string
  name: string
  relationship: string | null
  isDefault: boolean
  birthDate: Date
  birthTime: string
  birthPlace: string
  latitude: number
  longitude: number
  timezone: string
  gender: string | null
  photoUrl: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Create a new astro profile
 */
export async function createAstroProfile(input: AstroProfileInput): Promise<AstroProfileData> {
  // If this is the first profile, make it default
  const existingProfiles = await prisma.astroProfile.count({
    where: { userId: input.userId },
  })

  const profile = await prisma.astroProfile.create({
    data: {
      userId: input.userId,
      name: input.name,
      relationship: input.relationship || 'other',
      isDefault: existingProfiles === 0,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      birthPlace: input.birthPlace,
      latitude: input.latitude,
      longitude: input.longitude,
      timezone: input.timezone,
      gender: input.gender,
      notes: input.notes,
    },
  })

  // Generate initial birth chart for this profile
  const chartData = generateBirthChart(
    input.birthDate,
    input.birthTime,
    input.birthPlace,
    input.latitude,
    input.longitude,
    input.timezone
  )

  await prisma.birthChart.create({
    data: {
      userId: input.userId,
      profileId: profile.id,
      name: `${input.name}'s Birth Chart`,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      birthPlace: input.birthPlace,
      latitude: input.latitude,
      longitude: input.longitude,
      timezone: input.timezone,
      planets: chartData.planets as any,
      houses: chartData.houses as any,
      aspects: chartData.aspects as any,
    },
  })

  return profile
}

/**
 * Get all profiles for a user
 */
export async function getUserProfiles(userId: string): Promise<AstroProfileData[]> {
  return prisma.astroProfile.findMany({
    where: { userId },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'asc' },
    ],
  })
}

/**
 * Get a specific profile
 */
export async function getAstroProfile(profileId: string, userId: string): Promise<AstroProfileData | null> {
  return prisma.astroProfile.findFirst({
    where: { id: profileId, userId },
  })
}

/**
 * Get the default profile for a user
 */
export async function getDefaultProfile(userId: string): Promise<AstroProfileData | null> {
  return prisma.astroProfile.findFirst({
    where: { userId, isDefault: true },
  })
}

/**
 * Update a profile
 */
export async function updateAstroProfile(
  profileId: string,
  userId: string,
  updates: Partial<AstroProfileInput>
): Promise<AstroProfileData> {
  const profile = await prisma.astroProfile.update({
    where: { id: profileId },
    data: {
      name: updates.name,
      relationship: updates.relationship,
      birthDate: updates.birthDate,
      birthTime: updates.birthTime,
      birthPlace: updates.birthPlace,
      latitude: updates.latitude,
      longitude: updates.longitude,
      timezone: updates.timezone,
      gender: updates.gender,
      notes: updates.notes,
    },
  })

  // If birth details changed, regenerate the birth chart
  if (updates.birthDate || updates.birthTime || updates.birthPlace) {
    const chartData = generateBirthChart(
      profile.birthDate,
      profile.birthTime,
      profile.birthPlace,
      profile.latitude,
      profile.longitude,
      profile.timezone
    )

    // Update existing chart or create new one
    const existingChart = await prisma.birthChart.findFirst({
      where: { profileId: profile.id },
    })

    if (existingChart) {
      await prisma.birthChart.update({
        where: { id: existingChart.id },
        data: {
          birthDate: profile.birthDate,
          birthTime: profile.birthTime,
          birthPlace: profile.birthPlace,
          latitude: profile.latitude,
          longitude: profile.longitude,
          timezone: profile.timezone,
          planets: chartData.planets as any,
          houses: chartData.houses as any,
          aspects: chartData.aspects as any,
        },
      })
    }
  }

  return profile
}

/**
 * Set a profile as default
 */
export async function setDefaultProfile(profileId: string, userId: string): Promise<void> {
  // Remove default from all other profiles
  await prisma.astroProfile.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  })

  // Set this profile as default
  await prisma.astroProfile.update({
    where: { id: profileId },
    data: { isDefault: true },
  })
}

/**
 * Delete a profile
 */
export async function deleteAstroProfile(profileId: string, userId: string): Promise<void> {
  const profile = await prisma.astroProfile.findFirst({
    where: { id: profileId, userId },
  })

  if (!profile) {
    throw new Error('Profile not found')
  }

  // Cannot delete the only profile
  const count = await prisma.astroProfile.count({ where: { userId } })
  if (count === 1) {
    throw new Error('Cannot delete the only profile. Create another profile first.')
  }

  // If deleting default, set another as default
  if (profile.isDefault) {
    const otherProfile = await prisma.astroProfile.findFirst({
      where: { userId, id: { not: profileId } },
    })
    if (otherProfile) {
      await prisma.astroProfile.update({
        where: { id: otherProfile.id },
        data: { isDefault: true },
      })
    }
  }

  await prisma.astroProfile.delete({
    where: { id: profileId },
  })
}

/**
 * Get profile with birth chart
 */
export async function getProfileWithChart(profileId: string, userId: string): Promise<{
  profile: AstroProfileData
  chart: any
} | null> {
  const profile = await getAstroProfile(profileId, userId)
  if (!profile) return null

  const chart = await prisma.birthChart.findFirst({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
  })

  return { profile, chart }
}

/**
 * Get profiles formatted for selection dropdown
 */
export async function getProfileOptions(userId: string): Promise<{
  id: string
  name: string
  relationship: string | null
  isDefault: boolean
  zodiacSign: string
}[]> {
  const profiles = await getUserProfiles(userId)

  const options = await Promise.all(profiles.map(async (p) => {
    // Get sun sign from birth chart
    const chart = await prisma.birthChart.findFirst({
      where: { profileId: p.id },
    })

    const sunSign = chart?.planets
      ? (chart.planets as any[]).find((planet: any) => planet.name === 'Sun')?.sign
      : 'Unknown'

    return {
      id: p.id,
      name: p.name,
      relationship: p.relationship,
      isDefault: p.isDefault,
      zodiacSign: sunSign || 'Unknown',
    }
  }))

  return options
}

/**
 * Create profile from existing user birth data
 */
export async function createProfileFromUserData(userId: string): Promise<AstroProfileData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user || !user.birthDate || !user.birthTime || !user.birthPlace || !user.birthLatitude) {
    return null
  }

  return createAstroProfile({
    userId,
    name: user.name || 'My Profile',
    relationship: 'self',
    birthDate: user.birthDate,
    birthTime: user.birthTime,
    birthPlace: user.birthPlace,
    latitude: user.birthLatitude,
    longitude: user.birthLongitude || 0,
    timezone: user.birthTimezone || 'UTC',
  })
}

/**
 * Get profile count
 */
export async function getProfileCount(userId: string): Promise<number> {
  return prisma.astroProfile.count({ where: { userId } })
}