export interface TenantDomainLite {
  host: string
  status: string
  verificationToken: string | null
}

export interface DomainCheckResult {
  ok: boolean
  status: string
  dnsFound: boolean
  txtFound: boolean
  httpsOk: boolean
  message: string
}
