import { test, expect, type Page } from '@playwright/test'

const ROOT = () => process.env.E2E_BASE_URL || 'http://localhost:3000'
const hostUrl = (host: string) => {
  const base = new URL(ROOT())
  base.hostname = host
  return base.toString().replace(/\/$/, '')
}
const LUNA = () => hostUrl('luna.localhost')

async function login(page: Page, base: string, email: string, password: string) {
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 30000 })
}

async function api(page: Page, path: string, init?: { method?: string; body?: unknown }) {
  return page.evaluate(
    async ([p, i]) => {
      const res = await fetch(p, {
        method: i?.method ?? 'GET',
        headers: i?.body ? { 'Content-Type': 'application/json' } : undefined,
        body: i?.body ? JSON.stringify(i.body) : undefined,
      })
      return { status: res.status, data: await res.json().catch(() => null) }
    },
    [path, init] as const
  )
}

test.describe('Multi-tenancy', () => {
  test('hosts render distinct tenant brands', async ({ page }) => {
    await page.goto(ROOT() + '/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/StarPath Astrology/, { timeout: 30000 })
    await page.goto(LUNA() + '/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/LunaAstro/, { timeout: 30000 })
    const theme = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    )
    expect(theme.toLowerCase()).toBe('#14b8a6')
  })

  test('same email can exist on two platforms (per-tenant uniqueness)', async ({ page }) => {
    const email = `dup-${Date.now()}@example.com`
    await page.goto(ROOT() + '/', { waitUntil: 'domcontentloaded' })
    const a = await api(page, '/api/auth/signup', {
      method: 'POST',
      body: { name: 'Dup A', email, password: 'Password123!' },
    })
    await page.goto(LUNA() + '/', { waitUntil: 'domcontentloaded' })
    const b = await api(page, '/api/auth/signup', {
      method: 'POST',
      body: { name: 'Dup B', email, password: 'Password123!' },
    })
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(a.data.id).not.toBe(b.data.id)
  })

  test('tenant scoping of platform APIs', async ({ page }) => {
    // superadmin on root host sees the whole fleet
    await login(page, ROOT(), 'super@localhost', 'admin123')
    const all = await api(page, '/api/admin/tenants')
    expect(all.status).toBe(200)
    const slugs = all.data.tenants.map((t: { slug: string }) => t.slug)
    expect(slugs).toContain('luna')

    // a delegated admin only ever sees their own subtree - never the parent
    await login(page, LUNA(), 'admin@localhost', 'admin123')
    const mine = await api(page, '/api/admin/tenants')
    expect(mine.status).toBe(200)
    const mySlugs = mine.data.tenants.map((t: { slug: string }) => t.slug)
    expect(mySlugs).toContain('luna')
    expect(mySlugs).not.toContain('starpath')
  })

  test('localization honors parent grants', async ({ page }) => {
    await login(page, LUNA(), 'admin@localhost', 'admin123')
    const overreach = await api(page, '/api/admin/localization', {
      method: 'PATCH',
      body: { supportedLanguages: ['en', 'de'], defaultLanguage: 'en' },
    })
    expect(overreach.status).toBe(403)

    const ok = await api(page, '/api/admin/localization', {
      method: 'PATCH',
      body: { supportedLanguages: ['en', 'hi'], defaultLanguage: 'hi' },
    })
    expect(ok.status).toBe(200)
    const back = await api(page, '/api/admin/localization')
    expect(back.data.locale.defaultLanguage).toBe('hi')

    // restore
    await api(page, '/api/admin/localization', {
      method: 'PATCH',
      body: { supportedLanguages: ['en', 'hi'], defaultLanguage: 'en', defaultRegionKey: 'in' },
    })
  })

  test('sub-platform provisioning end-to-end with grant enforcement', async ({ page }) => {
    const slug = `e2ekid${Date.now()}`.slice(0, 30).replace(/[^a-z0-9]/g, '')
    await login(page, LUNA(), 'admin@localhost', 'admin123')

    // outside grants -> rejected
    const bad = await api(page, '/api/admin/tenants', {
      method: 'POST',
      body: {
        name: 'Bad Kid',
        slug: `${slug}x`,
        locales: { supportedLanguages: ['en', 'de'], defaultLanguage: 'en' },
      },
    })
    expect(bad.status).toBe(400)
    expect(String(bad.data?.error)).toMatch(/not in this platform/i)

    // within grants -> created and served on its own host
    const good = await api(page, '/api/admin/tenants', {
      method: 'POST',
      body: {
        name: 'E2E Child',
        slug,
        branding: { name: 'E2E Child', shortName: 'Kid', colors: { primary: '#F59E0B' } },
        locales: { supportedLanguages: ['en', 'hi'], defaultLanguage: 'en', currencyRegion: 'us' },
        regions: [
          {
            key: 'us',
            name: 'United States',
            code: 'US',
            currency: 'usd',
            currencies: [{ code: 'usd', symbol: '$', name: 'US Dollar' }],
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            priceMultiplier: 1,
          },
        ],
        gateways: [{ key: 'razorpay' }],
        aiDefault: 'openrouter',
      },
    })
    expect(good.status).toBe(200)
    const created = await api(page, `/api/admin/tenants`) // luna admin sees own subtree
    expect(created.status).toBe(200)
    expect(created.data.tenants.map((t: { slug: string }) => t.slug)).toContain(slug)

    await page.goto(hostUrl(`${slug}.localhost`) + '/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/E2E Child/, { timeout: 30000 })

    // cleanup by superadmin (child has no users yet -> deletable)
    const tab = await page.context().newPage()
    await login(tab, ROOT(), 'super@localhost', 'admin123')
    const del = await tab.evaluate(async id => {
      const r = await fetch(`/api/admin/tenants/${id}`, { method: 'DELETE' })
      return r.status
    }, good.data.provision.tenantId)
    expect(del).toBe(200)
    await tab.close()
  })
})
