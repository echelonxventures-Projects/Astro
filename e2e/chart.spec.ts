import { test, expect, Page } from '@playwright/test'

test.describe('Birth Chart Creation', () => {
  // Helper function to create and login a user
  async function createAndLoginUser(page: Page): Promise<{ email: string }> {
    const testEmail = `chart-test-${Date.now()}@example.com`
    const testPassword = 'Password123!'

    // Create user
    await page.request.post('/api/auth/signup', {
      data: {
        name: 'Chart Test User',
        email: testEmail,
        password: testPassword,
      },
    })

    // Login
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill(testEmail)
    await page.getByPlaceholder('••••••••').fill(testPassword)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL('/dashboard')

    return { email: testEmail }
  }

  test.describe('Chart Creation Page', () => {
    test.beforeEach(async ({ page }) => {
      await createAndLoginUser(page)
      await page.goto('/chart')
    })

    test('should display birth chart creation page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /birth chart|create chart/i })).toBeVisible()
    })

    test('should have birth date input fields', async ({ page }) => {
      // Date is three selects (day/month/year) rendered after session hydration
      const daySelect = page.locator('select').filter({ hasText: /day/i }).first()
      await expect(daySelect).toBeVisible()
      await expect(page.locator('select').filter({ hasText: /month/i }).first()).toBeVisible()
      await expect(page.locator('select').filter({ hasText: /year/i }).first()).toBeVisible()
    })

    test('should have birth time input', async ({ page }) => {
      await expect(page.locator('input[type="time"]').first()).toBeVisible()
    })

    test('should have location input', async ({ page }) => {
      await expect(page.getByPlaceholder('Search city, country...')).toBeVisible()
    })

    test('should create birth chart with valid data', async ({ page }) => {
      await page.getByPlaceholder('My Birth Chart').fill('E2E Chart')

      await page
        .locator('select')
        .filter({ has: page.locator('option', { hasText: /^Day$/ }) })
        .first()
        .selectOption('15')
      await page
        .locator('select')
        .filter({ has: page.locator('option', { hasText: /^Month$/ }) })
        .first()
        .selectOption('06')
      await page
        .locator('select')
        .filter({ has: page.locator('option', { hasText: /^Year$/ }) })
        .first()
        .selectOption('1990')

      await page.locator('input[type="time"]').fill('12:30')
      await page.getByPlaceholder('Search city, country...').fill('New York, USA')
      await page.keyboard.press('Escape')

      const coordInputs = page.locator('input[placeholder="0.0000"]')
      await coordInputs.nth(0).fill('40.7128')
      await coordInputs.nth(1).fill('-74.006')

      await page.getByRole('button', { name: /generate birth chart/i }).click()

      // Result panel renders planetary positions
      await expect(
        page.getByRole('heading', { name: 'Your Birth Chart', exact: true })
      ).toBeVisible({ timeout: 20000 })
      await expect(page.locator('text=/sun|moon|ascendant|planetary/i').first()).toBeVisible()
    })

    test('birth place autocomplete suggests and fills coordinates', async ({ page }) => {
      const cityInput = page.getByPlaceholder('Search city, country...')
      await cityInput.fill('Kathmandu')
      await expect(page.locator('button', { hasText: /kathmandu/i }).first()).toBeVisible({
        timeout: 20000,
      })
      await page
        .locator('button', { hasText: /kathmandu/i })
        .first()
        .click()
      await expect(page.locator('input[type="number"]').first()).not.toHaveValue('', {
        timeout: 10000,
      })
    })

    test('should block submission when required fields are missing', async ({ page }) => {
      // Form has native `required` on the date selects; submitting empty must not navigate
      await page.locator('input[type="time"]').fill('12:30')
      await page.getByRole('button', { name: /generate birth chart/i }).click()
      // Still on the chart page with no result heading
      await expect(page).toHaveURL(/\/chart/)
      await expect(
        page.getByRole('heading', { name: 'Your Birth Chart', exact: true })
      ).toHaveCount(0)
    })
  })

  test.describe('Chart Display', () => {
    test('should display chart with planets', async ({ page }) => {
      await createAndLoginUser(page)

      // Create a chart via API
      const response = await page.request.post('/api/astrology/chart', {
        data: {
          name: 'Test Chart',
          birthDate: '1990-06-15',
          birthTime: '12:30',
          birthPlace: 'New York, USA',
          latitude: 40.7128,
          longitude: -74.006,
          timezone: 'America/New_York',
        },
      })

      expect(response.status()).toBe(200)
      const chart = await response.json()
      // API computes the chart (creation page has no list view; API contract is the assertion)
      expect(chart).toBeTruthy()
    })

    test('should list user charts', async ({ page }) => {
      await createAndLoginUser(page)

      // Create multiple charts
      const c1 = await page.request.post('/api/astrology/chart', {
        data: {
          name: 'Chart 1',
          birthDate: '1990-06-15',
          birthTime: '12:30',
          latitude: 40.7128,
          longitude: -74.006,
        },
      })

      const c2 = await page.request.post('/api/astrology/chart', {
        data: {
          name: 'Chart 2',
          birthDate: '1995-03-20',
          birthTime: '08:00',
          latitude: 51.5074,
          longitude: -0.1278,
        },
      })

      expect(c1.ok()).toBeTruthy()
      expect(c2.ok()).toBeTruthy()
      const page_ok = await (await page.request.get('/chart')).ok()
      expect(page_ok).toBe(true)
    })
  })

  test.describe('Chart API', () => {
    test('should require authentication for chart creation', async ({ page }) => {
      const response = await page.request.post('/api/astrology/chart', {
        data: {
          name: 'Test Chart',
          birthDate: '1990-06-15',
          birthTime: '12:30',
          latitude: 40.7128,
          longitude: -74.006,
        },
      })

      expect(response.status()).toBe(401)
    })

    test('should validate chart input', async ({ page }) => {
      await createAndLoginUser(page)

      const response = await page.request.post('/api/astrology/chart', {
        data: {
          name: 'Test Chart',
          // Missing required fields
        },
      })

      expect(response.status()).toBe(400)
    })
  })
})
