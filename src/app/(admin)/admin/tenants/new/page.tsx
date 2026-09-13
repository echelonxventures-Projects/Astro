/**
 * Server gate for the New Platform wizard (superadmin only)
 */

import { redirect } from 'next/navigation'
import NewTenantClient from './page.client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { effectiveMaster } from '@/lib/master-config'

export default async function NewTenantPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/tenants/new')
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const isSuper = user?.role === 'superadmin'
  if (!isSuper) {
    const eff = session.user.tenantId ? await effectiveMaster(session.user.tenantId) : null
    if (!eff?.canCreateChildren) {
      redirect('/dashboard?error=Your+platform+cannot+create+sub-platforms')
    }
  }
  return <NewTenantClient isSuper={isSuper} />
}
