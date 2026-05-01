import { FullConfig } from '@playwright/test'

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('Starting global setup...')

  // Set up test environment variables if needed
  process.env.TEST_MODE = 'true'
  process.env.NEXTAUTH_SECRET = 'test-secret-for-playwright-minimum-32-chars'

  // Verify server is running or start it
  const baseURL = config.projects[0]?.use?.baseURL
  if (baseURL) {
    try {
      const response = await fetch(baseURL)
      if (response.ok) {
        console.log(`Server is running at ${baseURL}`)
      }
    } catch (_error) {
      console.log(`Server not yet available, webServer will start it`)
    }
  }

  console.log('Global setup complete')
}

export default globalSetup
