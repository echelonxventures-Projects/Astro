/**
 * Server-side wrapper for Branding editor (tenant admin)
 */

import { redirect } from 'next/navigation'
import BrandingClient from './page.client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function AdminBrandingPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/branding')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    redirect('/dashboard?error=Admin+access+required')
  }

  return <BrandingClient />
}
