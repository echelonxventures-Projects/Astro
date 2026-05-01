/**
 * Server-side wrapper for Admin Plans Page
 * Provides authentication and authorization check before rendering client component
 */

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import AdminPlansClient from './page.client'

export default async function AdminPlansPage() {
  // Check authentication
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/plans')
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
  return <AdminPlansClient />
}
