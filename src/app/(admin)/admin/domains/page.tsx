/**
 * Server gate for the Domains portal (tenant admin manages their own domains)
 */

import { redirect } from 'next/navigation'
import DomainsClient from './page.client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function AdminDomainsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/domains')
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    redirect('/dashboard?error=Admin+access+required')
  }
  return <DomainsClient />
}
