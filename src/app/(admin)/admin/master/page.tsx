/**
 * Server gate for Master Configuration (superadmin or granted platform admin)
 */

import { redirect } from 'next/navigation'
import MasterConfigClient from './page.client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { effectiveMaster } from '@/lib/master-config'

export default async function AdminMasterPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/master')
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const isSuper = user?.role === 'superadmin'
  if (!isSuper) {
    const eff = session.user.tenantId ? await effectiveMaster(session.user.tenantId) : null
    if (!eff?.canCreateChildren) {
      redirect('/dashboard?error=Master+administration+rights+required')
    }
  }
  return <MasterConfigClient />
}
