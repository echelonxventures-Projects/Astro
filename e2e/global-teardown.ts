import { FullConfig } from '@playwright/test'

/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */
async function globalTeardown(config: FullConfig) {
  console.log('Starting global teardown...')

  // Clean up any test data if needed
  // This could include:
  // - Deleting test users
  // - Cleaning up test charts
  // - Resetting database state

  console.log('Global teardown complete')
}

export default globalTeardown
