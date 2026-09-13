/**
 * Multi-tenant seed script
 * Run: npx prisma db seed   (or: npx tsx prisma/seed.ts)
 *
 * Creates tenants (default StarPath + LunaAstro demo), tenant domains,
 * per-tenant admin users (proving per-tenant email uniqueness), settings,
 * AI plan configs and subscription plans.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { ensureDefaultCatalog } from '../src/lib/ai/catalog'
import { initializeDefaultAIPlanConfigs } from '../src/lib/ai/plan-config'
import { initializeDefaultPlans } from '../src/lib/plans'

const prisma = new PrismaClient()

const LUNA_BRANDING = {
  name: 'LunaAstro',
  shortName: 'Luna',
  tagline: 'Illuminating Your Path',
  logoUrl: null,
  faviconUrl: null,
  colors: {
    background: '#03151E',
    foreground: '#F8FAFC',
    primary: '#14B8A6',
    primaryDark: '#0F766E',
    primaryLight: '#5EEAD4',
    primaryGlow: '#99F6E4',
    secondary: '#E2E8F0',
    secondaryDark: '#64748B',
    secondaryLight: '#F1F5F9',
    silver: '#CBD5E1',
    silverLight: '#E2E8F0',
    silverDark: '#94A3B8',
    accentPink: '#FB7185',
    accentCyan: '#38BDF8',
    accentAmber: '#FBBF24',
    accentEmerald: '#34D399',
    muted: '#0A2230',
    card: '#0A2230',
    border: '#14B8A6',
  },
  seo: {
    title: 'LunaAstro - Illuminating Your Path',
    description:
      'Personalized astrology readings, birth charts and cosmic guidance, beautifully simple. Powered by LunaAstro.',
    siteName: 'LunaAstro',
  },
}

interface TenantSeed {
  id: string
  slug: string
  name: string
  isDefault: boolean
  branding: object | null
  domains: string[]
  adminName: string
  locales: { supportedLanguages: string[]; defaultLanguage: string; currencyRegion: string }
  parentId?: string
  master?: Record<string, unknown>
}

const TENANTS: TenantSeed[] = [
  {
    id: 'tenant_starpath_default',
    slug: 'starpath',
    name: 'StarPath Astrology',
    isDefault: true,
    branding: null,
    domains: ['localhost', '127.0.0.1', 'starpath.localhost'],
    adminName: 'Admin User',
    locales: {
      supportedLanguages: ['en', 'es', 'fr', 'de', 'hi'],
      defaultLanguage: 'en',
      currencyRegion: 'us',
    },
  },
  {
    id: 'tenant_luna_demo',
    slug: 'luna',
    name: 'LunaAstro',
    isDefault: false,
    branding: LUNA_BRANDING,
    domains: ['luna.localhost'],
    adminName: 'Luna Admin',
    locales: { supportedLanguages: ['en', 'hi'], defaultLanguage: 'en', currencyRegion: 'in' },
    parentId: 'tenant_starpath_default',
    master: {
      allowedLanguages: ['en', 'hi'],
      allowedRegions: ['us', 'in'],
      allowedGateways: ['razorpay'],
      allowedAiProviders: ['openrouter', 'ollama', 'gemini'],
      canCreateChildren: true,
      maxChildren: 5,
      childDefaults: { language: 'en', region: 'in', aiProvider: 'openrouter' },
    },
  },
]

async function seedTenant(t: TenantSeed, passwordHash: string) {
  await prisma.tenant.upsert({
    where: { id: t.id },
    update: {
      name: t.name,
      slug: t.slug,
      branding: t.branding ?? undefined,
      isDefault: t.isDefault,
      parentId: t.parentId ?? null,
      settings: { locales: t.locales, master: t.master ?? null } as never,
    },
    create: {
      id: t.id,
      slug: t.slug,
      name: t.name,
      isDefault: t.isDefault,
      parentId: t.parentId ?? null,
      branding: t.branding ?? undefined,
      settings: { locales: t.locales, master: t.master ?? null } as never,
    },
  })

  for (const [i, host] of t.domains.entries()) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: t.id },
      create: { id: `domain_${t.slug}_${i}`, host, tenantId: t.id, isPrimary: i === 0 },
    })
  }

  // Same email across tenants on purpose: demonstrates per-tenant uniqueness
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: t.id, email: 'admin@localhost' } },
    update: { passwordHash, name: t.adminName, emailVerified: new Date(), role: 'admin' },
    create: {
      tenantId: t.id,
      email: 'admin@localhost',
      passwordHash,
      name: t.adminName,
      emailVerified: new Date(),
      role: 'admin',
    },
  })

  // Platform superadmin (lives in the default tenant)
  if (t.isDefault) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: t.id, email: 'super@localhost' } },
      update: {
        passwordHash,
        name: 'Platform Owner',
        emailVerified: new Date(),
        role: 'superadmin',
      },
      create: {
        tenantId: t.id,
        email: 'super@localhost',
        passwordHash,
        name: 'Platform Owner',
        emailVerified: new Date(),
        role: 'superadmin',
      },
    })
  }

  const defaultSettings = [
    {
      key: 'AI_PROVIDER',
      value: 'ollama',
      description: 'AI provider: anthropic, ollama, or gemini',
    },
    { key: 'OLLAMA_URL', value: 'http://localhost:5566', description: 'Ollama server URL' },
    { key: 'AI_MODEL', value: 'llama3.2', description: 'Model name to use' },
    {
      key: 'ANTHROPIC_API_KEY',
      value: '',
      description: 'Anthropic API key (required if using Anthropic)',
    },
    {
      key: 'GEMINI_API_KEY',
      value: '',
      description: 'Google Gemini API key (required if using Gemini)',
    },
  ]

  for (const setting of defaultSettings) {
    await prisma.appSettings.upsert({
      where: { tenantId_key: { tenantId: t.id, key: setting.key } },
      update: { value: setting.value },
      create: { tenantId: t.id, ...setting },
    })
  }

  await initializeDefaultAIPlanConfigs(t.id)
  await initializeDefaultPlans(t.id)
  await ensureDefaultCatalog(t.id, t.name)

  console.log(`Seeded tenant: ${t.name} (${t.slug})`)
}

function resolveAdminPassword(): string {
  const isProd = process.env.NODE_ENV === 'production'
  const explicit = process.env.SEED_ADMIN_PASSWORD
  if (isProd) {
    if (!explicit || explicit.length < 12) {
      console.error(
        'Production seeding requires SEED_ADMIN_PASSWORD (>= 12 chars). Refusing to seed shared dev credentials.'
      )
      process.exit(1)
    }
    return explicit
  }
  return explicit || 'admin123'
}

async function main() {
  const password = resolveAdminPassword()
  const generated = password === 'admin123'
  const passwordHash = await bcrypt.hash(password, 12)

  for (const t of TENANTS) {
    await seedTenant(t, passwordHash)
  }

  if (generated && !process.env.CI) {
    console.log(
      '\n⚠️  DEV-ONLY credentials (admin123). Set SEED_ADMIN_PASSWORD before seeding any real deployment.'
    )
  }
  console.log(
    `\nDone. Logins (password: ${generated ? 'admin123 (dev-only)' : 'SEED_ADMIN_PASSWORD'}):`
  )
  console.log('  starpath : http://localhost:3001  -> admin@localhost (admin)')
  console.log(
    '  luna     : http://luna.localhost:3001 -> admin@localhost (admin, same email, different tenant)'
  )
  console.log('  platform : super@localhost (superadmin - tenant management)')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
