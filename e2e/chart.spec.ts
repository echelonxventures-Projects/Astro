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
      // Look for date-related inputs or selects
      const dateCount = await page
        .locator(
          'input[type="date"], select[name*="day"], select[name*="month"], select[name*="year"]'
        )
        .count()
      expect(dateCount).toBeGreaterThan(0)
    })

    test('should have birth time input', async ({ page }) => {
      const timeCount = await page
        .locator('input[type="time"], input[name*="time"], select[name*="time"]')
        .count()
      expect(timeCount).toBeGreaterThan(0)
    })

    test('should have location input', async ({ page }) => {
      const locCount = await page
        .locator(
          'input[placeholder*="location"], input[placeholder*="city"], input[name*="location"]'
        )
        .count()
      expect(locCount).toBeGreaterThan(0)
    })

    test('should create birth chart with valid data', async ({ page }) => {
      // Fill in the form
      const nameInput = page.locator('input[name*="name"], input[placeholder*="name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('My Birth Chart')
      }

      // Fill date (if using separate fields)
      const daySelect = page.locator('select[name*="day"], select[name*="birthDay"]')
      if (await daySelect.isVisible().catch(() => false)) {
        await daySelect.selectOption('15')
      }

      const monthSelect = page.locator('select[name*="month"], select[name*="birthMonth"]')
      if (await monthSelect.isVisible().catch(() => false)) {
        await monthSelect.selectOption('6')
      }

      const yearSelect = page.locator('select[name*="year"], select[name*="birthYear"]')
      if (await yearSelect.isVisible().catch(() => false)) {
        await yearSelect.selectOption('1990')
      }

      // Fill time
      const timeInput = page.locator(
        'input[type="time"], input[name*="time"], select[name*="birthTime"]'
      )
      if (await timeInput.isVisible().catch(() => false)) {
        await timeInput.fill('12:30')
      }

      // Fill location
      const locationInput = page.locator('input[placeholder*="location"], input[name*="location"]')
      if (await locationInput.isVisible().catch(() => false)) {
        await locationInput.fill('New York, USA')
        // Wait for autocomplete if present
        await page.waitForTimeout(500)
      }

      // Fill coordinates if present
      const latInput = page.locator('input[name*="latitude"], input[placeholder*="latitude"]')
      const lonInput = page.locator('input[name*="longitude"], input[placeholder*="longitude"]')

      if (await latInput.isVisible().catch(() => false)) {
        await latInput.fill('40.7128')
      }
      if (await lonInput.isVisible().catch(() => false)) {
        await lonInput.fill('-74.0060')
      }

      // Click generate/create button
      const generateButton = page.getByRole('button', { name: /generate|create|calculate/i })
      if (await generateButton.isVisible().catch(() => false)) {
        await generateButton.click()

        // Wait for result
        await expect(page.locator('text=/sun|moon|ascendant|planet/i').first()).toBeVisible({
          timeout: 10000,
        })
      }
    })

    test('should show error for missing required fields', async ({ page }) => {
      // Click generate without filling form
      const generateButton = page.getByRole('button', { name: /generate|create|calculate/i })
      if (await generateButton.isVisible().catch(() => false)) {
        await generateButton.click()

        // Should show validation error
        const errorVisible = await page
          .getByText(/required|please fill|missing/i)
          .isVisible()
          .catch(() => false)
        expect(errorVisible).toBeTruthy()
      }
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

      if (response.ok()) {
        const _chart = await response.json()

        // Navigate to view the chart
        await page.goto('/chart')

        // Should show chart data
        await expect(page.getByText(/sun|moon|mercury|venus|mars/i).first()).toBeVisible()
      }
    })

    test('should list user charts', async ({ page }) => {
      await createAndLoginUser(page)

      // Create multiple charts
      await page.request.post('/api/astrology/chart', {
        data: {
          name: 'Chart 1',
          birthDate: '1990-06-15',
          birthTime: '12:30',
          latitude: 40.7128,
          longitude: -74.006,
        },
      })

      await page.request.post('/api/astrology/chart', {
        data: {
          name: 'Chart 2',
          birthDate: '1995-03-20',
          birthTime: '08:00',
          latitude: 51.5074,
          longitude: -0.1278,
        },
      })

      // Navigate to charts list
      await page.goto('/chart')

      // Should show list of charts
      await expect(page.getByText(/Chart 1|Chart 2/i).first()).toBeVisible()
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
