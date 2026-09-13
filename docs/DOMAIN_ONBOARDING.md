# Domain Onboarding (custom domains per platform)

Checklist to point a customer's own domain at the multi-tenant deployment.

## 1. Provision the platform first

`/admin/tenants/new` wizard (superadmin or delegated parent admin) — creates
tenant, markets, plans, gateways, AI catalog and admin account. The wizard
auto-registers `<slug>.<TENANT_ROOT_DOMAIN>` or `<slug>.localhost` (dev).

## 2. DNS at the customer's registrar

| Record       | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| `A` / `AAAA` | the deployment's edge IP (or `CNAME` to the load balancer) |
| `www` CNAME  | same target                                                |

Propagation check: `dig +short api.example.com` before the next steps.

## 3. Attach the domain to the tenant (with verification)

Tenant admin (or delegated parent / superadmin): `POST /api/admin/tenants/<id>/domains`
with `{"host":"astro.example.com"}` — creates a `custom/pending` row and returns the
TXT challenge. Publish it at the customer's DNS provider:

```
_starpath-verify.astro.example.com.  TXT  "vp_xxxxxxxx…"
```

then `POST /api/admin/tenants/<id>/domains/<domainId>` (no body) to run the DNS check.
Until verified the host is **not served** (domain-squatting protection). In-house
subdomains (`<slug>.<TENANT_ROOT_DOMAIN>` / `<slug>.localhost` in dev) are automatic.
Force-verify (`{"force":true}`) is superadmin-only, for controlled migrations.

## 4. TLS termination

Terminate HTTPS at your edge (nginx `nginx.conf.example`, Cloudflare, ALB…). The
app should receive `X-Forwarded-Proto: https`; then set the tenant-facing
`NEXTAUTH_URL` to **https** so NextAuth cookies carry `Secure` (cookie security
follows the `NEXTAUTH_URL` protocol by design).

## 5. Third-party callbacks to update

- **OAuth** (if the tenant enables Google/GitHub/etc.): add
  `https://<domain>/api/auth/callback/<provider>` at the provider console, then
  put the tenant's own client id/secret into
  `Tenant.settings.oauth.<provider>` (Config modal) — providers are listed
  per host automatically.
- **Payment webhooks**: re-register with the new domain, e.g.
  `https://<domain>/api/payment/webhook/stripe?t=<slug>` (see docs/PAYMENT_TESTING.md).
- **Cloudinary/media**: no change; **Resend**: verify the domain's sending
  domain (SPFM/DKIM) if transactional email is enabled.

## 6. Verification

1. `curl -sI https://<domain>/ready` → `{"ready":true}` and JSON
   `checks.database/migrations/seeding`.
2. Open `https://<domain>/` — tenant title, favicon, brand colors, default
   language in `<html lang>`, pricing shows the tenant's plans/currency.
3. Sign up + login on the new domain; the session cookie's tenant matches.
4. Unknown Host still yields the isolation page (guards DNS mistakes).

## Troubleshooting

| Symptom                         | Likely cause                                                             |
| ------------------------------- | ------------------------------------------------------------------------ |
| "Unknown platform" page         | `TenantDomain.host` missing/mismatched (case, port stripped?)            |
| Sign-in redirects to wrong host | `NEXTAUTH_TRUST_HOST` not true, or proxy drops `Host`/`X-Forwarded-Host` |
| Session lost instantly          | `Secure` cookie vs plain http (protocol mismatch with `NEXTAUTH_URL`)    |
| Wrong brand after domain attach | host cache TTL (60s) — or the browser cached the old 301                 |
