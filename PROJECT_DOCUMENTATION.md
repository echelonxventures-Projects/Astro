# StarPath Astrology — Project Documentation

> **Canonical reference** (updated with the multi-tenant white-label architecture, PostgreSQL,
> platform hierarchy and master configuration). Historical docs in this folder describe earlier
> implementation phases and carry banner notes where facts changed.

## 1. What this is

A production-grade, **multi-tenant astrology SaaS**: one Next.js 16 deployment serves unlimited
independently-branded "platforms" (tenants) resolved by request hostname. Each tenant gets its own
domain(s), branding, languages, markets/currencies, plans, AI provider catalog, payment gateways,
users and data — all stored in PostgreSQL and administered through in-app portals. Platforms form a
**hierarchy**: a root (super) platform grants options/rights to sub-platforms, which may delegate
subsets onward; every effective configuration is capped by its ancestors.

## 2. Tech stack

| Layer     | Tech                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack, `output: standalone`), React 19, TypeScript strict                                                    |
| Data      | PostgreSQL 15+ · Prisma 6 (migrations in `prisma/migrations`) · Redis (ioredis) cache + distributed rate limits                          |
| Auth      | NextAuth v4 — JWT sessions, tenant-scoped credentials + per-tenant OAuth                                                                 |
| Payments  | Stripe · Razorpay · PayPal (gateway registry, per-tenant encrypted keys, fraud checks, audit log)                                        |
| AI        | Catalog-driven providers: any OpenAI-compatible endpoint + Anthropic + Gemini + Ollama + OpenCode                                        |
| UI        | Tailwind CSS v4 with CSS-variable theming (per-tenant brand injection), Framer Motion, lucide-react                                      |
| Ops       | Docker/Compose (app+pg+redis, monitoring: Prometheus/Grafana), Sentry, Pino structured logs, Prometheus `/api/metrics`, health endpoints |
| Quality   | ESLint (custom flat config), Husky + lint-staged, Vitest (167 unit tests), Playwright e2e harness                                        |

## 3. Architecture

```
Browser ── Host: acme.customer.com
   │
   ▼
Next.js route handlers / RSC
   ├─ middleware.ts      security headers, nonce CSP, rate-limit tiers (Redis)
   ├─ tenant.ts          resolveTenantByHost(host) -> TenantContext   [LRU 60s]
   │                     exact TenantDomain | TENANT_ROOT_DOMAIN subdomain |
   │                     *.localhost dev | bare localhost -> default tenant
   ├─ master-config.ts   effectiveMaster(): intersection of ancestor grants
   ├─ layout.tsx         injects <style>:root{--brand vars}</style> + LocaleProvider
   │                     + BrandProvider + metadata/favicon/manifest per tenant
   ├─ auth.ts            per-request NextAuth options (tenant providers), cross-tenant
   │                     session guard (JWT tenantId must equal request tenant)
   └─ getScopedDb(tid)   Prisma extension: auto tenantId injection on all scoped models
          │
          ▼
   PostgreSQL (every customer row carries tenantId)      Redis (cache + limiter)
```

### Tenant resolution (`src/lib/tenant.ts`)

1. Exact `TenantDomain.host` match (custom domains)
2. First-label slug under `TENANT_ROOT_DOMAIN`
3. `*.localhost` dev magic (label = slug)
4. Bare `localhost` / `127.0.0.1` → default tenant
5. Otherwise: isolation page ("Unknown platform" / suspended → "This platform is paused")

### Hierarchy & master configuration (`src/lib/master-config.ts`)

- Host resolution gates unverified `custom` domains; in-house subdomains auto-serve.
- `Tenant.parentId` (null = root). A child can never exceed any ancestor.
- `Tenant.settings.master` (`MasterConfig`): `allowedLanguages|allowedRegions|allowedGateways|allowedAiProviders`, `canCreateChildren`, `maxChildren`, `childDefaults`.
- Effective = walk parent chain, intersect sets, AND rights, min caps (cycle-guarded, 10 levels).
- Rights flow: superadmin = global; a granted platform admin can list/create/configure its own subtree only; all grant edits are clamped server-side.

## 4. Data model (PostgreSQL)

| Group           | Tables (all with `tenantId` FK→Tenant, cascade, indexed)                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy         | `Tenant` (slug unique, status, branding JSON, settings JSON incl. locales+master, parentId), `TenantDomain` (host unique)                                                                                                                                |
| Identity        | `User` (`@@unique([tenantId,email])`, roles: user/moderator/admin/superadmin), `Account`, `Session`, `VerificationToken`, `UserDevice`                                                                                                                   |
| Core data       | `BirthChart`, `Reading`, `ChatSession`, `AstroProfile`, `Notification`, `UserMemory`                                                                                                                                                                     |
| Commerce        | `Subscription`, `Payment`, `PaymentTransaction`, `PaymentAuditLog(tenantId?)`, `PaymentGateway` (`@@unique([tenantId,key])`, encrypted secrets), `PaymentMethod`, `GatewayPlan`                                                                          |
| Platform config | `SubscriptionPlan` (`@@unique([tenantId,key])`, `tier` free/paid, regionalPricing), `PlanFeature`, `PlanFeatureAccess`, `AppSettings` (`@@unique([tenantId,key])`), `AIProviderConfig` (plan bindings), `AIProviderCatalog` (`@@unique([tenantId,key])`) |
| Global          | `Region` is **per tenant** (unique per tenant); `Region`-adjacent reference: none — everything customer-facing is tenant-scoped                                                                                                                          |

Runbooks: docs/PAYMENT_TESTING.md (test-mode payments, webhook routing) · docs/DOMAIN_ONBOARDING.md (custom domains).

Migrations: `init_postgresql` → `add_payment_audit_log` → `add_multi_tenancy` → `ai_provider_catalog` → `region_per_tenant` → `platform_hierarchy` (all applied by `npx prisma migrate deploy`).

## 5. Branding & theming

- `src/lib/branding.ts`: `BrandConfig` (name, shortName, tagline, logoUrl, faviconUrl, 19-color palette, SEO) + `mergeBranding()` + `brandToCssRules()`.
- Root layout injects tenant CSS variables (`--primary`, `--background`, …) that Tailwind classes consume app-wide → whole UI re-skins per tenant; `BrandProvider/BrandName/BrandLogo` for identity text; manifest/metadata/favicon per tenant.
- `/admin/branding` = live-preview editor (colors, identity, SEO) + `/api/admin/branding/upload` (Cloudinary, local fallback).
- **Zero hardcoded brand strings remain in `src/app`** — verified by grep.

## 6. AI provider engine

- `AIProviderCatalog` per tenant: key, label, kind, baseUrl, apiKey, models[], capabilities[] (`vision`), options (`extraHeaders`, `noAuth`, `checkUrl`, `priority`).
- Kinds (the only code-level wire protocols): `openai-compatible` (generic — covers OpenAI/OpenRouter/Groq/NVIDIA/Together/LM Studio…), `ollama`, `anthropic`, `gemini`, `opencode`. **Adding a vendor = a DB row via UI, no deploy.**
- Resolution: plan binding (`AIProviderConfig` → catalog entry) → tenant default entry → priority order; vision routes require `vision` capability; env/AppSettings legacy chain only as bootstrap fallback.
- Managed at `/settings` (tabs: Plan Binding / Providers / Default) with per-provider connectivity test.

## 7. Plans, markets, currency, languages

- `SubscriptionPlan` rows drive pricing page, dashboard chip, subscription card, checkout, and even Razorpay/PayPal `brand_name` at request time. `tier` decides upgrade semantics; `regionalPricing` + `Region.priceMultiplier/currency` handle localization of prices.
- `GET /api/plans` (public, tenant-scoped) feeds pricing; `/api/admin/plans` = tenant admin CRUD (plans/features/regions).
- Languages: `Tenant.settings.locales` {supportedLanguages, defaultLanguage, currencyRegion} → `LocaleProvider` scopes `LanguageSwitcher`, sets `<html lang>`/dir. Portal: `/admin/localization`. Dictionary coverage: en + partial es/fr/de/hi (content work).

## 8. Admin portals & roles

| Portal                | Role                          | Purpose                                                                                                                                                     |
| --------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/tenants`      | superadmin / delegated parent | Platform tree, suspend/activate/delete, lineage                                                                                                             |
| `/admin/tenants/new`  | same                          | **Setup wizard**: identity+brand → languages → markets/currency → plans → gateways+AI → admin account (one submit provisions everything, clamped to grants) |
| `/admin/master`       | superadmin / delegated parent | Master configuration: per-node grants (options + rights + child defaults)                                                                                   |
| `/admin/branding`     | tenant admin                  | White-label editor w/ live preview + asset upload                                                                                                           |
| `/admin/localization` | tenant admin                  | Languages + default market                                                                                                                                  |
| `/admin/payments`     | tenant admin                  | Per-tenant gateways/methods/gateway plans/transactions                                                                                                      |
| `/admin/plans`        | tenant admin                  | Plans, features, markets                                                                                                                                    |
| `/settings`           | tenant admin                  | AI catalog, plan bindings, default provider                                                                                                                 |

Roles: `user`, `moderator`, `admin` (per tenant), `superadmin` (platform operator). Sessions carry `tenantId`; cross-tenant cookie replay is rejected in both NextAuth session callback and `auth()`.

## 9. API surface

- **Auth**: `POST /api/auth/signup` · NextAuth `ALL /api/auth/[...nextauth]` (tenant-aware) · `GET /api/auth/providers|session|csrf`
- **Platform (public)**: `GET /api/plans[?type=features|regions]` · `GET /api/branding` · `GET /api/health` · `GET /api/ready` · `GET /api/metrics` · `GET /manifest.webmanifest`
- **Astrology (user)**: `POST /api/astrology/chart|generate|chat|palmistry|face-reading`
- **User data**: `GET/POST/DELETE /api/profiles` · `/api/memory` · `/api/devices` · `/api/gdpr/data`
- **Billing**: `GET/POST /api/payment/checkout` · `/api/payment/methods` · `/api/payment/subscription` · webhooks `stripe|razorpay|paypal` (tenant via `?t=<slug>`) · legacy `POST /api/stripe/checkout|webhook`, `POST /api/stripe/portal`
- **Tenant admin**: `GET/PUT /api/branding` · `POST /api/admin/branding/upload` · `GET/PATCH /api/admin/localization` · `GET/POST /api/admin/plans` · `GET/POST /api/settings` · `GET/POST /api/settings/plans` · `GET/POST /api/settings/providers` (CRUD+test) · `GET/PATCH /api/admin/localization`
- **Super/parent admin**: `GET/POST /api/admin/tenants` · `PATCH/DELETE /api/admin/tenants/:id` · `GET/POST /api/admin/master-config`

OpenAPI specs (docs repo, `/openapi/*.yaml`): auth, charts, readings, chat, payments, admin (incl. tenants/branding/localization/plans).

## 10. Security

CSP nonce + security headers (middleware), HSTS, clickjacking/MIME protections · tiered Redis-backed rate limits (auth 5/min, admin 30/min, api 100/min…) · bot/UA heuristics + audit trail · zod validation on all inputs · encrypted gateway secrets (AES-256-GCM, `ENCRYPTION_KEY`) · bcrypt(12) · fraud-detection hooks · payment audit log · per-tenant data isolation (DB NOT NULL + scoped client + request guards) · `NEXTAUTH_TRUST_HOST` only because host→tenant resolution is strict.

## 11. Operations

### Local self-host (what's running now)

```bash
scripts/run-local.sh          # colima -> containers -> (build if needed) -> loopback server on :3001
scripts/run-local.sh --lan    # bind 0.0.0.0 for phone/LAN testing
scripts/stop-local.sh         # stop app; add --services to stop postgres/redis
```

The standalone server binds **127.0.0.1 by default** (dev needs no LAN exposure). Manual
equivalent: `NEXTAUTH_URL=... PORT=... HOSTNAME=127.0.0.1 node .next/standalone/server.js`.
Seed credentials: dev keeps `admin123` with a printed warning; production requires
`SEED_ADMIN_PASSWORD` (>=12 chars) or seeding refuses.

DB bootstrap: `npx prisma migrate deploy && npx tsx prisma/seed.ts && npx tsx prisma/seed-payment-gateways.ts`

Docker alternatives: `docker-compose.yml` (full prod stack), `docker-compose.dev.yml` (services only), `docker-compose.monitoring.yml`, `docker-compose.caddy.yml` (edge TLS: on-demand ACME via the app's `ask` gate `/api/domains/challenge` — certs mint automatically for in-house + DNS-verified custom domains).

### Demo state (seeded)

| Platform                                             | URL                                             | Login                                    |
| ---------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| StarPath (root)                                      | http://localhost:3001 · starpath.localhost:3001 | `admin@localhost` / `admin123`           |
| — superadmin                                         | same hosts                                      | `super@localhost` / `admin123`           |
| LunaAstro (sub-platform of StarPath)                 | http://luna.localhost:3001                      | `admin@localhost` / `admin123`           |
| Stellar Paths (sub-platform of LunaAstro, 3rd level) | http://stellar.localhost:3001                   | `admin@stellar.test` / `StellarPass123!` |

### CI/CD

GitHub Actions (root repo + app repo): build/lint/test, PR checks, security scan, dependabot, cd-staging/cd-production. Husky pre-commit → lint-staged (eslint --fix + prettier).

## 12. Branch workflow

PR flow enforced locally (free-plan limitation): `.husky/pre-push` blocks direct
`main` pushes; `scripts/ship.sh` automates branch → PR → watch CI → squash-merge.
Full command to enable native protection after a Pro upgrade is in CONTRIBUTING.md.

## 13. Quality status (last full run)

- `tsc --noEmit`: 0 errors · `eslint`: 0 errors (style warnings only) · Vitest: **167/167** · Production build + standalone boot: ✓
- Live matrix verified in headless Chromium: three-level hierarchy, per-tenant brand/theme/language/currency, over-grant rejection, session guards, provider CRUD, plan rename propagation, webhook tenant param.

## 14. Known limitations / roadmap

1. **Translation content**: language _selection_ is per tenant; dictionaries beyond en (+partial es/fr/de/hi) need content work.
2. Legacy parallel payment endpoints (`/api/stripe/*`) retained for backward compat; consolidate onto `/api/payment/*` when clients migrate.
3. `Region` seeded globally-catalogued per new tenant (markets beyond the 5 templates require grants in Master Config first).
4. Logo hosting: Cloudinary (preferred) or `/public/uploads` dev fallback (wiped on redeploy).
5. Per-tenant OAuth requires registering callback URLs per domain at the provider.
6. E2E Playwright suite exists but predates tenancy — update specs to cover wizard/tenants.

## 15. Repo map

```
StarPath-Astrology/            the application (git repo, PR: feat/multi-tenancy -> main #1)
├─ prisma/  schema, migrations, seeds (multi-tenant)
├─ src/lib/ tenant.ts master-config.ts tenant-provision.ts branding.ts plans.ts
│           ai/ (catalog.ts, providers) payment/ settings.ts security.ts …
├─ src/app/ (admin)/admin/{tenants,master,branding,localization,payments,plans}
│           (auth)/ (dashboard)/ api/ layout.tsx (tenant theme+locale)
├─ docs/    MULTI_TENANCY.md PRODUCTION-DEPLOYMENT.md
└─ README.md QUICK START / portals / env
../ (astro workspace)          docs layer: openapi/*.yaml, API_DOCUMENTATION.md, scripts/ (postman/api-client gen)
```
