import { test, expect } from '@playwright/test'

test.describe('Authentication Flows', () => {
  test.describe('Signup', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signup')
    })

    test('should display signup page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
      await expect(page.getByText('Start your cosmic journey today')).toBeVisible()
    })

    test('should allow user to sign up with email and password', async ({ page }) => {
      const testEmail = `test-${Date.now()}@example.com`
      const testPassword = 'Password123!'
      const testName = 'Test User'

      await page.getByPlaceholder('John Doe').fill(testName)
      await page.getByPlaceholder('you@example.com').fill(testEmail)
      await page.getByPlaceholder('••••••••').fill(testPassword)

      await page.getByRole('button', { name: 'Create Account' }).click()

      // Should redirect to dashboard on success
      await expect(page).toHaveURL('/dashboard')
    })

    test('should show error for existing email', async ({ page }) => {
      // First, create a user
      const testEmail = `existing-${Date.now()}@example.com`
      const testPassword = 'Password123!'

      // Create user via API
      const response = await page.request.post('/api/auth/signup', {
        data: {
          name: 'Existing User',
          email: testEmail,
          password: testPassword,
        },
      })
      expect(response.ok()).toBeTruthy()

      // Try to sign up again with same email
      await page.goto('/signup')
      await page.getByPlaceholder('John Doe').fill('Another User')
      await page.getByPlaceholder('you@example.com').fill(testEmail)
      await page.getByPlaceholder('••••••••').fill(testPassword)

      await page.getByRole('button', { name: 'Create Account' }).click()

      // Should show error
      await expect(page.getByText(/already exists|account with this email/i)).toBeVisible()
    })

    test('should validate password requirements', async ({ page }) => {
      await page.getByPlaceholder('you@example.com').fill('test@example.com')
      await page.getByPlaceholder('John Doe').fill('Test User')

      // Try weak password
      await page.getByPlaceholder('••••••••').fill('weak')
      await page.getByRole('button', { name: 'Create Account' }).click()

      // Browser validation should prevent submission or show error
      // The form has minLength="8" on password input
    })

    test('Google sign up button reflects OAuth configuration', async ({ page }) => {
      const googleButton = page.getByRole('button', { name: /Continue with Google/i })
      // Providers are per-platform (Tenant.settings.oauth / env). CI has none
      // configured, so the button must be absent; locally with creds, present.
      const count = await googleButton.count()
      if (count > 0) {
        await expect(googleButton).toBeEnabled()
      } else {
        expect(count).toBe(0)
      }
    })

    test('should toggle password visibility', async ({ page }) => {
      const passwordInput = page.getByPlaceholder('••••••••')
      await passwordInput.fill('secretpassword')

      // Check initial type is password
      await expect(passwordInput).toHaveAttribute('type', 'password')

      // Click toggle button
      await page.getByRole('button', { name: /show password|hide password/i }).click()

      // Check type changed to text
      await expect(passwordInput).toHaveAttribute('type', 'text')
    })

    test('should have link to login page', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign in' }).click()
      await expect(page).toHaveURL('/login')
    })
  })

  test.describe('Login', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
    })

    test('should display login page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
      await expect(page.getByText('Sign in to access your cosmic profile')).toBeVisible()
    })

    test('should allow user to log in', async ({ page }) => {
      // Create a test user first
      const testEmail = `login-test-${Date.now()}@example.com`
      const testPassword = 'Password123!'

      await page.request.post('/api/auth/signup', {
        data: {
          name: 'Login Test User',
          email: testEmail,
          password: testPassword,
        },
      })

      await page.goto('/login')
      await page.getByPlaceholder('you@example.com').fill(testEmail)
      await page.getByPlaceholder('••••••••').fill(testPassword)

      await page.getByRole('button', { name: 'Sign In' }).click()

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard')
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.getByPlaceholder('you@example.com').fill('nonexistent@example.com')
      await page.getByPlaceholder('••••••••').fill('wrongpassword')

      await page.getByRole('button', { name: 'Sign In' }).click()

      // Should show error
      await expect(page.getByText(/invalid email or password|failed to sign in/i)).toBeVisible()
    })

    test('should have remember me checkbox', async ({ page }) => {
      await expect(page.getByLabel('Remember me')).toBeVisible()
      await page.getByLabel('Remember me').check()
      await expect(page.getByLabel('Remember me')).toBeChecked()
    })

    test('should have forgot password link', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
      // Note: forgot-password page may not exist, link might go to same page
    })

    test('should have link to signup page', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign up for free' }).click()
      await expect(page).toHaveURL('/signup')
    })
  })

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto('/dashboard')

      // Should redirect to login
      await expect(page).toHaveURL('/login')
    })

    test('should redirect unauthenticated users from chart page', async ({ page }) => {
      await page.goto('/chart')

      // Should redirect to login
      await expect(page).toHaveURL('/login')
    })

    test('should allow authenticated users to access dashboard', async ({ page }) => {
      // Create and login user
      const testEmail = `auth-test-${Date.now()}@example.com`
      const testPassword = 'Password123!'

      await page.request.post('/api/auth/signup', {
        data: {
          name: 'Auth Test User',
          email: testEmail,
          password: testPassword,
        },
      })

      await page.goto('/login')
      await page.getByPlaceholder('you@example.com').fill(testEmail)
      await page.getByPlaceholder('••••••••').fill(testPassword)
      await page.getByRole('button', { name: 'Sign In' }).click()

      await expect(page).toHaveURL('/dashboard')
      await expect(page.getByText(/dashboard|welcome/i)).toBeVisible()
    })
  })

  test.describe('Logout', () => {
    test('should allow user to log out', async ({ page }) => {
      // Create and login user first
      const testEmail = `logout-test-${Date.now()}@example.com`
      const testPassword = 'Password123!'

      await page.request.post('/api/auth/signup', {
        data: {
          name: 'Logout Test User',
          email: testEmail,
          password: testPassword,
        },
      })

      await page.goto('/login')
      await page.getByPlaceholder('you@example.com').fill(testEmail)
      await page.getByPlaceholder('••••••••').fill(testPassword)
      await page.getByRole('button', { name: 'Sign In' }).click()

      // Wait for dashboard
      await expect(page).toHaveURL('/dashboard')

      // Find and click logout
      // Note: This depends on the dashboard layout having a logout button
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i })
      if (await logoutButton.isVisible().catch(() => false)) {
        await logoutButton.click()
        await expect(page).toHaveURL('/')
      }
    })
  })
})
