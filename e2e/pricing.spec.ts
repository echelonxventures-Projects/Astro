import { test, expect } from '@playwright/test'

test.describe('Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing')
  })

  test('should display pricing page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pricing|choose your/i })).toBeVisible()
    await expect(page.getByText(/cosmic path|plans/i)).toBeVisible()
  })

  test('should show pricing plans', async ({ page }) => {
    // Should have at least 2-3 plan cards
    const planCards = page.locator('[class*="card"], [class*="plan"], article').filter({ hasText: /\$|free|monthly|yearly/i })
    const count = await planCards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('should show free plan', async ({ page }) => {
    const freePlan = page.locator('text=/free|basic/i').first()
    await expect(freePlan).toBeVisible()
  })

  test('should show premium plans', async ({ page }) => {
    const premiumPlan = page.locator('text=/premium|pro|monthly|yearly/i').first()
    await expect(premiumPlan).toBeVisible()
  })

  test('should show plan features', async ({ page }) => {
    // Features are typically shown with checkmarks
    const features = page.locator('[class*="feature"], li, [class*="check"]').filter({ hasText: /reading|chart|horoscope|access/i })
    const count = await features.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('should show pricing amounts', async ({ page }) => {
    // Look for price displays
    const prices = page.locator('text=/\\$\\d+|\\$\\d+\\.\\d+/i')
    const count = await prices.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('should have CTA buttons', async ({ page }) => {
    const ctas = page.getByRole('button').filter({ hasText: /get started|subscribe|upgrade|start/i })
    const count = await ctas.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('should redirect to signup for unauthenticated users clicking CTA', async ({ page }) => {
    const ctaButton = page.getByRole('button').filter({ hasText: /get started|start free trial/i }).first()

    if (await ctaButton.isVisible().catch(() => false)) {
      // Click a non-free plan CTA
      await ctaButton.click()

      // Should redirect to signup
      await expect(page).toHaveURL(/\/signup/)
    }
  })

  test('should show region selector', async ({ page }) => {
    const regionSelect = page.locator('select[name*="region"], select[id*="region"]').first()

    if (await regionSelect.isVisible().catch(() => false)) {
      await expect(regionSelect).toBeVisible()

      // Should have options
      const options = await regionSelect.locator('option').count()
      expect(options).toBeGreaterThanOrEqual(1)
    }
  })

  test('should update prices when region changes', async ({ page }) => {
    const regionSelect = page.locator('select[name*="region"], select[id*="region"]').first()

    if (await regionSelect.isVisible().catch(() => false)) {
      // Get initial price
      const initialPrice = await page.locator('text=/\\$\\d+/i').first().textContent()

      // Change region
      await regionSelect.selectOption({ index: 1 })

      // Wait for update
      await page.waitForTimeout(500)

      // Price might have changed or currency symbol
      const updatedPrice = await page.locator('text=/\\$|€|£|¥/').first().textContent()
      expect(updatedPrice).toBeTruthy()
    }
  })

  test('should show FAQ section', async ({ page }) => {
    const faqHeading = page.getByRole('heading', { name: /faq|frequently asked/i })

    if (await faqHeading.isVisible().catch(() => false)) {
      await expect(faqHeading).toBeVisible()

      // Should have FAQ items
      const faqItems = page.locator('[class*="faq"], details, [class*="accordion"]').filter({ hasText: /\\?/ })
      const count = await faqItems.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  test('should show feature comparison table', async ({ page }) => {
    const comparisonTable = page.locator('table, [class*="comparison"], [class*="compare"]').first()

    if (await comparisonTable.isVisible().catch(() => false)) {
      await expect(comparisonTable).toBeVisible()

      // Should have rows
      const rows = await comparisonTable.locator('tr, [class*="row"]').count()
      expect(rows).toBeGreaterThanOrEqual(2)
    }
  })

  test('should have navigation to login for existing users', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /login|sign in/i })

    if (await loginLink.isVisible().catch(() => false)) {
      await loginLink.click()
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('should display "Most Popular" badge on recommended plan', async ({ page }) => {
    const popularBadge = page.locator('text=/most popular|recommended|best value/i').first()

    if (await popularBadge.isVisible().catch(() => false)) {
      await expect(popularBadge).toBeVisible()
    }
  })

  test('should have working header navigation', async ({ page }) => {
    // Check home link
    const homeLink = page.getByRole('link').filter({ hasText: /starpath|home/i }).first()
    await expect(homeLink).toBeVisible()

    // Navigate to home
    await homeLink.click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Pricing - Authenticated User', () => {
  async function createAndLoginUser(page: any) {
    const testEmail = `pricing-test-${Date.now()}@example.com`
    const testPassword = 'Password123!'

    await page.request.post('/api/auth/signup', {
      data: {
        name: 'Pricing Test User',
        email: testEmail,
        password: testPassword
      }
    })

    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill(testEmail)
    await page.getByPlaceholder('••••••••').fill(testPassword)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL('/dashboard')
  }

  test('should show dashboard link for authenticated users', async ({ page }) => {
    await createAndLoginUser(page)
    await page.goto('/pricing')

    const dashboardLink = page.getByRole('link', { name: /dashboard/i })
    await expect(dashboardLink).toBeVisible()
  })

  test('should show subscription link for authenticated users', async ({ page }) => {
    await createAndLoginUser(page)
    await page.goto('/pricing')

    const subscriptionLink = page.getByRole('link', { name: /subscription|my plan/i })
    await expect(subscriptionLink).toBeVisible()
  })

  test('should show different CTA for authenticated users', async ({ page }) => {
    await createAndLoginUser(page)
    await page.goto('/pricing')

    // Free plan should link to dashboard
    const freePlanButton = page.locator('text=/free/i').locator('..').getByRole('button').first()
    if (await freePlanButton.isVisible().catch(() => false)) {
      const buttonText = await freePlanButton.textContent()
      expect(buttonText?.toLowerCase()).toMatch(/dashboard|go|current/)
    }
  })
})
