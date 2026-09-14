/**
 * Domain health monitor: persists check history, advances lifecycle states,
 * flips verified domains to `failing` (and back), and alerts via webhook.
 */

import { checkDomain } from './check'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { invalidateTenantHostCache } from '@/lib/tenant'

const HISTORY_KEEP = 50

export async function runDomainCheck(
  domainId: string
): Promise<{ ok: boolean; status: string; message: string } | null> {
  const domain = await prisma.tenantDomain.findUnique({
    where: { id: domainId },
    include: { tenant: { select: { slug: true } } },
  })
  if (!domain) return null
  if (domain.status === 'disabled' || domain.type === 'in_house') {
    return {
      ok: domain.status !== 'disabled',
      status: domain.status,
      message:
        domain.status === 'disabled'
          ? 'Domain disabled'
          : 'In-house hosts are managed automatically',
    }
  }

  const result = await checkDomain(
    { host: domain.host, status: domain.status, verificationToken: domain.verificationToken },
    domain.tenant.slug
  )

  let nextStatus = result.status
  const wasLive = domain.live
  // never regress a verified domain back to a pending stage - failing instead
  if ((domain.status === 'verified' || domain.status === 'failing') && !result.ok) {
    nextStatus = 'failing'
  }

  await prisma.domainCheck.create({
    data: {
      domainId: domain.id,
      ok: result.ok,
      status: nextStatus,
      message: result.message,
      dnsFound: result.dnsFound,
      txtFound: result.txtFound,
      httpsOk: result.httpsOk,
    },
  })
  await prisma.tenantDomain.update({
    where: { id: domain.id },
    data: {
      status: nextStatus,
      lastCheckedAt: new Date(),
      lastCheckMessage: result.message,
      live: result.httpsOk,
      ...(nextStatus === 'verified' && !domain.verifiedAt ? { verifiedAt: new Date() } : {}),
    },
  })

  // trim history (keep newest N)
  const stale = await prisma.domainCheck.findMany({
    where: { domainId: domain.id },
    orderBy: { checkedAt: 'desc' },
    skip: HISTORY_KEEP,
    select: { id: true },
  })
  if (stale.length)
    await prisma.domainCheck.deleteMany({ where: { id: { in: stale.map(s => s.id) } } })

  if (domain.status !== nextStatus) invalidateTenantHostCache()

  if (domain.status === 'verified' && nextStatus === 'failing') {
    alertWebhook({
      event: 'domain_failing',
      tenant: domain.tenant.slug,
      host: domain.host,
      message: result.message,
    })
  } else if (domain.status === 'failing' && result.ok) {
    alertWebhook({
      event: 'domain_recovered',
      tenant: domain.tenant.slug,
      host: domain.host,
      message: result.message,
    })
  } else if (!wasLive && result.httpsOk) {
    alertWebhook({
      event: 'domain_live',
      tenant: domain.tenant.slug,
      host: domain.host,
      message: result.message,
    })
  }

  return { ok: result.ok, status: nextStatus, message: result.message }
}

function alertWebhook(payload: Record<string, unknown>): void {
  const url = process.env.DOMAIN_ALERT_WEBHOOK
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, at: new Date().toISOString() }),
  }).catch(err => logger.warn({ err }, 'domain alert webhook delivery failed'))
}

export async function checkAllManagedDomains(): Promise<number> {
  // pending domains auto-advance as soon as the customer finishes their side;
  // verified/failing domains are watched for breakage/recovery.
  const due = await prisma.tenantDomain.findMany({
    where: {
      type: 'custom',
      status: { in: ['pending_dns', 'pending_verification', 'pending', 'verified', 'failing'] },
    },
    select: { id: true },
    take: 200,
  })
  let n = 0
  for (const d of due) {
    try {
      await runDomainCheck(d.id)
      n++
    } catch (err) {
      logger.warn({ err, domainId: d.id }, 'domain monitor check failed')
    }
  }
  return n
}

const g = globalThis as unknown as { __starpathDomainMonitor?: boolean }

export function startDomainMonitor(): void {
  if (process.env.DOMAIN_MONITOR !== '1') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (g.__starpathDomainMonitor) return
  g.__starpathDomainMonitor = true
  const tick = () => {
    checkAllManagedDomains()
      .then(n => {
        if (n) logger.info({ checked: n }, 'domain monitor pass complete')
      })
      .catch(err => logger.error({ err }, 'domain monitor pass failed'))
  }
  setTimeout(tick, 15_000) // let the server come up first
  setInterval(tick, 5 * 60_000).unref?.()
  logger.info('domain monitor scheduled (every 5m)')
}
