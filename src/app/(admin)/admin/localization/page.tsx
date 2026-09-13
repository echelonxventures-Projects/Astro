/**
 * Server gate for the tenant Localization portal (admin/superadmin of current tenant)
 */

import { redirect } from 'next/navigation'
import LocalizationClient from './page.client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function AdminLocalizationPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/localization')
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    redirect('/dashboard?error=Admin+access+required')
  }
  return <LocalizationClient />
}
