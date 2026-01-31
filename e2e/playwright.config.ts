import { defineConfig, devices } from '@playwright/test'
import * as path from 'node:path'
import * as os from 'node:os'

// Test database path - separate from user's real database
const TEST_DB_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.db')

/**
 * E2E Test Configuration
 *
 * These tests run against the REAL app - no mocks.
 * Uses a SEPARATE test database that gets wiped before each test run.
 * The user's real database is never touched.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  // Global setup - cleans the test database before tests run
  globalSetup: './global-setup.ts',

  fullyParallel: false,  // Run tests sequentially to avoid race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // Single worker to avoid race conditions with sidecar
  reporter: 'html',

  // Global timeout for each test
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  use: {
    // Base URL for the app
    baseURL: 'http://localhost:1420',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',
  },

  projects: [
    // Setup project - runs first to seed test data
    {
      name: 'setup',
      testMatch: /seed\.setup\.ts/,
    },
    // Main tests - depend on setup
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  // Start both sidecar and desktop dev server before running tests
  // Uses a separate test database via KODA_TEST_DB environment variable
  webServer: [
    {
      command: 'pnpm --filter @koda/sidecar dev',
      url: 'http://localhost:3939/rpc',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        KODA_TEST_DB: TEST_DB_PATH,
      },
    },
    {
      command: 'pnpm --filter desktop dev',
      url: 'http://localhost:1420',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
