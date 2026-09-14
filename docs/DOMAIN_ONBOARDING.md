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

## 4. TLS — automatic via Caddy (recommended)

A Caddy edge with **on-demand ACME** issues certificates for every tenant domain
the moment a visitor first reaches it — including future customer domains, no
redeploy:

```bash
export CADDY_ASK_SECRET="$(openssl rand -hex 24)"   # also put in app .env
export CADDY_ACME_EMAIL="ops@example.com"
docker compose -f docker-compose.caddy.yml up -d
```

Flow: unknown SNI → Caddy asks the app (`GET /api/domains/challenge?key=…&domain=…`)
→ the app answers `200` only for hosts that resolve to a tenant **and** passed DNS
verification (or are in-house). A 404 makes Caddy refuse issuance (squatting +
ACME-abuse protection). Ask answers are LRU-cached (10–60 s); in-app verification
clears the cache instantly.

Point the app's `NEXTAUTH_URL` at **https://<root tenant domain>** so auth cookies
carry `Secure` behind Caddy. The legacy nginx option (`nginx.conf.example`) or a
Cloudflare-fronted setup still works — forward `X-Forwarded-Proto`.

| Piece                                                                          | File                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------- |
| Caddyfile (global `on_demand_tls` ask + `https://` catch-all proxy)            | `caddy/Caddyfile`                        |
| Edge compose (ports 80/443, `caddy_data`/`caddy_config` volumes, host-gateway) | `docker-compose.caddy.yml`               |
| ask endpoint (key-gated, `timingSafeEqual`)                                    | `src/app/api/domains/challenge/route.ts` |

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
