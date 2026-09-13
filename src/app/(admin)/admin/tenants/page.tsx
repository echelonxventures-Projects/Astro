/**
 * Server-side wrapper for Tenant Management (superadmin only)
 */

import { redirect } from 'next/navigation'
import TenantsClient from './page.client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { effectiveMaster } from '@/lib/master-config'

export default async function AdminTenantsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/tenants')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  const isSuper = user?.role === 'superadmin'
  if (!isSuper) {
    const eff = session.user.tenantId ? await effectiveMaster(session.user.tenantId) : null
    if (!eff?.canCreateChildren) {
      redirect('/dashboard?error=Platform-admin+rights+required')
    }
  }

  return <TenantsClient isSuper={isSuper} />
}
