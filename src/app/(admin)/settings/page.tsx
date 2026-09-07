/**
 * Server-side wrapper for Settings Page
 * Provides authentication and authorization check before rendering client component
 */

import { redirect } from 'next/navigation'
import SettingsClient from './page.client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function SettingsPage() {
  // Check authentication
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/settings')
  }

  // Check admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })

  if (!user || user.role !== 'admin') {
    redirect('/dashboard?error=Admin access required')
  }

  // User is authenticated and is admin - render the client component
  return <SettingsClient />
}
