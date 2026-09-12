# Multi-Tenancy & White-Label Platform

This deployment serves **many customer platforms ("tenants") from a single codebase**.
Each tenant is fully white-labeled: branding, colors, SEO, domains, users, plans,
AI configuration and payment gateways are isolated per tenant.

## Core concepts

| Concept          | Model                                     | Notes                                                                                                                                   |
| ---------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant           | `Tenant`                                  | One white-label platform. `branding` (JSON `BrandConfig`) + `settings` (JSON: OAuth keys, email sender, feature flags) live on the row. |
| Domain           | `TenantDomain`                            | Any hostname owned by a tenant (vanity domains, subdomains). `isPrimary` marks the canonical one.                                       |
| Scoping          | `tenantId` on every customer-facing table | Users, charts, readings, chats, subscriptions, payments, plans, gateways, AI configs, app settings.                                     |
| Email uniqueness | `@@unique([tenantId, email])`             | The same email can exist on multiple tenants.                                                                                           |

## Host → tenant resolution

`src/lib/tenant.ts::resolveTenantByHost()` (LRU-cached, 60 s TTL):

1. Exact `TenantDomain.host` match (any custom domain).
2. If `TENANT_ROOT_DOMAIN` is set (e.g. `starpath.app`): `acme.starpath.app` → tenant slug `acme`.
3. `*.localhost` dev magic: `luna.localhost` → slug `luna`.
4. Bare `localhost` / `127.0.0.1` → the default tenant (`starpath`).
5. Anything else → isolation page ("Unknown platform"). Suspended tenants get
   "This platform is paused".

## Data access rules

- Route handlers: `getTenantContext()` (server components / handlers) or
  `getWebhookTenant(req)` (payment webhooks, uses `?t=<slug>` query param first).
- Prefer `getScopedDb(tenantId)` (`src/lib/tenant.ts`): a Prisma client extension that
  auto-injects `tenantId` into every create/read/update/delete on scoped models.
- Global (non-tenant) tables: `Region`, `PlanFeatureAccess`, `PaymentMethod` /
  `GatewayPlan` (scoped transitively via their parent gateway row).

## Authentication

- NextAuth options are built **per request** (`src/app/api/auth/[...nextauth]/route.ts`)
  with the resolved tenant, so OAuth provider availability and credentials login are
  tenant-scoped.
- `authorize()` looks up `@@unique([tenantId, email])`.
- The JWT carries `tenantId`; both the session callback and `auth()` reject sessions
  whose `tenantId` differs from the request's tenant (cross-tenant replay protection).
- Roles: `user`, `moderator`, `admin` (tenant administrator), `superadmin`
  (platform operator, manages tenants).

## Branding runtime

- `src/lib/branding.ts` defines `BrandConfig` + `mergeBranding()` (stored JSON merged
  over StarPath defaults) and `brandToCssRules()`.
- The root layout injects a `<style id="tenant-theme">` with the tenant's CSS variables
  (`--primary`, `--background`, …) which the whole Tailwind theme consumes, plus
  tenant-specific metadata (title/description/favicon).
- Client components read identity via `useBrand()` / `<BrandName />` / `<BrandLogo />`
  (`src/components/BrandProvider.tsx`).

## Admin portals

| Portal                      | Who          | What                                                                                                             |
| --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `/admin/tenants`            | superadmin   | Create tenants (name, slug, color preset, domains), suspend/activate, delete, raw branding/settings JSON config. |
| `/admin/branding`           | tenant admin | Full look & feel editor (identity, logo/favicon upload, 16 colors, SEO) with live preview.                       |
| `/admin/payments`           | tenant admin | Per-tenant gateways/keys/plans (rows now carry `tenantId`).                                                      |
| `/admin/plans`, `/settings` | tenant admin | Per-tenant plans/features and AI provider configs.                                                               |

APIs: `GET/POST /api/admin/tenants`, `PATCH/DELETE /api/admin/tenants/:id`,
`GET/PUT /api/branding`, `POST /api/admin/branding/upload` (Cloudinary, falls back to
`public/uploads/<tenantId>/` when Cloudinary keys are absent).

## Onboarding a new customer

1. Log in as superadmin → `/admin/tenants` → create (slug + brand color + domains).
2. The customer's admin signs up at their URL (`slug.localhost` / custom domain) —
   first user can be promoted by superadmin (`prisma user update`) or seeded.
3. Tenant admin sets logo/colors at `/admin/branding`, gateways at `/admin/payments`,
   AI models at `/settings`.
4. For custom domains: add DNS, insert the host via the tenant Config modal, set
   `TENANT_ROOT_DOMAIN` for production subdomains, register OAuth redirect URIs and
   payment webhooks (`/api/payment/webhook/stripe?t=<slug>`).

## Local demo tenants

| Tenant             | URL                               | Admin                          |
| ------------------ | --------------------------------- | ------------------------------ |
| StarPath (default) | `http://localhost:3001`           | `admin@localhost` / `admin123` |
| LunaAstro (demo)   | `http://luna.localhost:3001`      | `admin@localhost` / `admin123` |
| Superadmin         | any of the default tenant's hosts | `super@localhost` / `admin123` |

Note: `*.localhost` resolves automatically in Chrome/Safari; CLI `curl` over plain
http cannot carry `Secure` cookies for subdomains (browser-only behavior).
