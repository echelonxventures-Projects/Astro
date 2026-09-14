/**
 * Tenant domain lifecycle checker.
 *
 * Customer journey we support: the customer buys a domain at their registrar,
 * then points it at our edge from their side. We stage their progress so the
 * platform can tell them exactly what is still missing (masked behind their
 * own brand, never our infrastructure identity):
 *
 *   pending_dns            -> no A/AAAA/CNAME for the host yet
 *   pending_verification   -> DNS resolves, ownership TXT not published/matched
 *   verified               -> DNS + TXT good; cert auto-issued on first visit
 *   failing                -> was verified, now DNS/echo broken (monitored)
 *   disabled               -> operator switch, never served / no cert
 */

import type { DomainCheckResult, TenantDomainLite } from './types'

// node:dns only ever imported lazily so edge bundles stay clean.
async function importDns(): Promise<typeof import('dns')> {
  return import('dns')
}

const TXT_PREFIX = '_starpath-verify.'
const HTTPS_TIMEOUT_MS = 8000

function isPending(status: string): boolean {
  return status === 'pending_dns' || status === 'pending_verification' || status === 'pending'
}

/** True when the host should serve traffic (and get a cert). */
export function domainServes(status: string): boolean {
  return status === 'verified' || status === 'failing'
}

export async function checkDomain(
  domain: TenantDomainLite,
  tenantSlug: string
): Promise<DomainCheckResult> {
  const result: DomainCheckResult = {
    ok: false,
    status: domain.status,
    dnsFound: false,
    txtFound: false,
    httpsOk: false,
    message: '',
  }
  const { host, verificationToken } = domain

  // 1) Does the host resolve at all? (customer added DNS?)
  try {
    const { promises: dnsPromise } = await importDns()
    try {
      const addrs = await dnsPromise.resolve4(host)
      result.dnsFound = addrs.length > 0
    } catch {
      try {
        const six = await dnsPromise.resolve6(host)
        result.dnsFound = six.length > 0
      } catch {
        try {
          const cname = await dnsPromise.resolveCname(host)
          result.dnsFound = cname.length > 0
        } catch {
          // fall through: no A/AAAA/CNAME
          try {
            const any = await dnsPromise.resolve(host)
            result.dnsFound = Array.isArray(any) ? any.length > 0 : Boolean(any)
          } catch {
            result.dnsFound = false
          }
        }
      }
    }
    if (result.dnsFound) {
      const edgeTarget = process.env.EDGE_CNAME_TARGET
      if (edgeTarget) {
        try {
          const chain = await dnsPromise.resolveCname(host).catch(() => [])
          const aRecords = await dnsPromise.resolve4(host).catch(() => [])
          const edgeIps = (process.env.EDGE_APEX_IPS ?? '')
            .split(',')
            .map(x => x.trim())
            .filter(Boolean)
          const pointsToUs =
            chain.some(c => c.toLowerCase().endsWith(edgeTarget.toLowerCase())) ||
            (edgeIps.length > 0 && aRecords.some(a => edgeIps.includes(a)))
          if (!pointsToUs && chain.length + aRecords.length > 0) {
            result.message = `DNS resolves, but not to this platform's edge. Point ${host} at ${edgeTarget} (CNAME) or ${edgeIps.join(' / ') || 'our edge'} (A record).`
            result.status = isPending(domain.status) ? 'pending_dns' : 'failing'
            return result
          }
        } catch {
          /* non-fatal */
        }
      }
    }
  } catch (error) {
    result.message = 'DNS lookup unavailable in this environment'
    void (error instanceof Error ? error.message : error)
  }

  if (!result.dnsFound) {
    result.status = 'disabled' === domain.status ? 'disabled' : 'pending_dns'
    result.message =
      result.status === 'disabled'
        ? 'Domain disabled'
        : `No DNS record yet for ${host}. At your domain registrar, add an A record (or CNAME to ${process.env.EDGE_CNAME_TARGET ?? 'our edge address'}) pointing ${host} to this platform.`
    return result
  }

  // 2) Ownership: TXT token at _starpath-verify.<host>
  try {
    const { promises: dnsPromise } = await importDns()
    const answers = await dnsPromise.resolveTxt(`${TXT_PREFIX}${host}`)
    const found = answers.map(parts => parts.join(''))
    result.txtFound = verificationToken ? found.includes(verificationToken) : found.length > 0
  } catch {
    result.txtFound = false
  }

  if (!result.txtFound) {
    result.status = 'pending_verification'
    result.message = `DNS looks good. Now prove ownership: add a TXT record named ${TXT_PREFIX}${host} with value ${verificationToken ?? '(contact support)'} and run “Check again”.`
    return result
  }

  // 3) Liveness: does the platform actually serve THIS tenant on this host? (masked echo)
  try {
    const proto = (process.env.NEXTAUTH_URL ?? '').startsWith('https') ? 'https' : 'http'
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), HTTPS_TIMEOUT_MS)
    const res = await fetch(`${proto}://${host}/api/domains/echo`, { signal: ctrl.signal })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json().catch(() => null)
      result.httpsOk = data?.platform === tenantSlug
    }
  } catch {
    result.httpsOk = false
  }

  result.status = 'verified'
  result.ok = true
  result.message = result.httpsOk
    ? 'Active — verified and serving this platform.'
    : 'Verified. The platform is not answering on this host yet (certificate is issued automatically on first visit; allow a few minutes after DNS changes).'
  return result
}

export function dnsInstructions(domain: { host: string; verificationToken: string | null }) {
  const edge = process.env.EDGE_CNAME_TARGET
  const ips = (process.env.EDGE_APEX_IPS ?? '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
  return {
    connect: edge || ips[0] || '(ask your platform provider)',
    records: [
      {
        type: 'A/AAAA or CNAME',
        name: domain.host,
        value: edge ?? (ips.join(' or ') || '(platform edge address)'),
        note: 'CNAME is not allowed at a zone apex — use an A record there (or CNAME flattening).',
      },
      {
        type: 'TXT',
        name: `${TXT_PREFIX}${domain.host}`,
        value: domain.verificationToken ?? '',
        note: 'Proves you control the domain. Remove it after verification if you like.',
      },
    ],
  }
}
