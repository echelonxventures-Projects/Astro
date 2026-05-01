/**
 * Server-side wrapper for Payments Admin Page
 */

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import PaymentsClient from './page.client'

export default async function PaymentsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/payments')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })

  if (!user || user.role !== 'admin') {
    redirect('/dashboard?error=Admin access required')
  }

  // Fetch initial data server-side
  const gateways = await prisma.paymentGateway.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      paymentMethods: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  const plans = await prisma.gatewayPlan.findMany({
    include: {
      gateway: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  const transactions = await prisma.paymentTransaction.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      gateway: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }).then(tx => tx.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  })))

  return <PaymentsClient user={user} initialGateways={gateways} initialPlans={plans} initialTransactions={transactions} />
}
