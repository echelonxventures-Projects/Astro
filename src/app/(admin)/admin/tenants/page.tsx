/**
 * Server-side wrapper for Tenant Management (superadmin only)
 */

import { redirect } from 'next/navigation'
import TenantsClient from './page.client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function AdminTenantsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/tenants')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (!user || user.role !== 'superadmin') {
    redirect('/dashboard?error=Superadmin+access+required')
  }

  return <TenantsClient />
}
