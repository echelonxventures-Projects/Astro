import { test, expect, type Page } from '@playwright/test'

const ROOT = () => process.env.E2E_BASE_URL || 'http://localhost:3000'
const LUNA_HOST = 'luna.localhost'
const hostUrl = (host: string) => {
  const base = new URL(ROOT())
  base.hostname = host
  return base.toString().replace(/\/$/, '')
}

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

test.describe('Domain ownership & verification', () => {
  const host = `e2e-domain-${Date.now()}.example.com`

  test('custom domain flows pending -> blocked -> verified -> served, then detachable', async ({
    page,
    browser,
  }) => {
    // 1. tenant admin attaches their own vanity domain -> pending with TXT challenge
    await login(page, hostUrl(LUNA_HOST), 'admin@localhost', 'admin123')
    const attach = await api(page, '/api/admin/tenants/tenant_luna_demo/domains', {
      method: 'POST',
      body: { host },
    })
    expect(attach.status).toBe(200)
    expect(['pending_dns', 'pending_verification', 'verified']).toContain(attach.data.domain.status)
    expect(attach.data.domain.type).toBe('custom')
    const txt = (attach.data.dns?.records ?? []).find((r: { type: string }) => r.type === 'TXT')
    expect(String(txt?.value)).toMatch(/^vp_/)
    const domainId = attach.data.domain.id

    // 2. unverified custom host must NOT serve the tenant
    const blocked = await page.request.get(ROOT() + '/', { headers: { host } })
    expect(await blocked.text()).toContain('Unknown platform')

    // 3. non-super cannot force-verify
    const badForce = await api(page, `/api/admin/tenants/tenant_luna_demo/domains/${domainId}`, {
      method: 'POST',
      body: { force: true },
    })
    expect(badForce.status).toBe(403)

    // 4. a real DNS challenge (no record exists) fails gracefully and keeps pending
    const realCheck = await api(page, `/api/admin/tenants/tenant_luna_demo/domains/${domainId}`, {
      method: 'POST',
      body: {},
    })
    expect(realCheck.status).toBe(200)
    expect(realCheck.data.verified).toBe(false)
    expect(String(realCheck.data.message)).toMatch(/registrar|_starpath-verify|record/i)

    // 5. superadmin force-verifies -> host now serves LunaAstro
    const tab = await browser.newPage()
    await login(tab, ROOT(), 'super@localhost', 'admin123')
    const force = await api(tab, `/api/admin/tenants/tenant_luna_demo/domains/${domainId}`, {
      method: 'POST',
      body: { force: true },
    })
    expect(force.data.ok).toBe(true)
    const served = await page.request.get(ROOT() + '/', { headers: { host } })
    expect(await served.text()).toContain('LunaAstro')

    // 6. detach custom domain
    const del = await api(page, `/api/admin/tenants/tenant_luna_demo/domains/${domainId}`, {
      method: 'DELETE',
    })
    expect(del.status).toBe(200)
    const blockedAgain = await page.request.get(ROOT() + '/', { headers: { host } })
    expect(await blockedAgain.text()).toContain('Unknown platform')

    await tab.close()
  })

  test('reserved slugs are rejected at provisioning', async ({ browser }) => {
    const tab = await browser.newPage()
    await login(tab, ROOT(), 'super@localhost', 'admin123')
    for (const slug of ['www', 'admin', 'api']) {
      const res = await api(tab, '/api/admin/tenants', {
        method: 'POST',
        body: { name: 'Reserved Probe', slug },
      })
      expect(res.status).toBe(400)
      expect(String(res.data?.error)).toMatch(/reserved/i)
    }
    await tab.close()
  })
})
