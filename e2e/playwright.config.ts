import { defineConfig, devices } from '@playwright/test'
import * as path from 'node:path'
import * as os from 'node:os'

// Test database path - separate from user's real database
const TEST_DB_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.db')

// Test socket path - separate from user's real socket
const TEST_SOCKET_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.sock')

// Test ports - different from dev server (1420/3847) so tests can run while dev app is open
const TEST_VITE_PORT = 1421
const TEST_HTTP_RPC_PORT = 3848

/**
 * E2E Test Configuration
 *
 * These tests run against the REAL app - no mocks.
 * Uses a SEPARATE test database and socket that gets wiped before/after test runs.
 * The user's real database is NEVER touched.
 *
 * IMPORTANT: Tests ALWAYS start their own isolated app instance on port 1421.
 * There is no "skip webserver" mode - this ensures database isolation is enforced.
 * Tests can run while the main dev app is open on port 1420.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  // Ignore worktrees which are copies of the repo
  testIgnore: ['**/.worktrees/**'],

  // Global setup - cleans the test database before tests run
  globalSetup: './global-setup.ts',

  // Global teardown - cleans the test database after tests finish
  globalTeardown: './global-teardown.ts',

  fullyParallel: false, // Run tests sequentially to avoid race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid race conditions with sidecar
  reporter: 'html',

  // Global timeout for each test
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  use: {
    // Base URL for the app (uses test port, not dev port)
    baseURL: `http://localhost:${TEST_VITE_PORT}`,

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',
  },

  projects: [
    // Setup project - runs first to seed test data
    // No browser needed for seeding - just runs the seed script
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

  // Start desktop dev server before running tests
  // Uses different ports (1421/3848) than dev server (1420/3847)
  // Uses tauri.test.conf.json which has devUrl set to port 1421
  // NOTE: There is no "skip webserver" mode - tests MUST use isolated database
  webServer: {
    command: 'pnpm --filter desktop tauri dev --config src-tauri/tauri.test.conf.json',
    url: `http://localhost:${TEST_VITE_PORT}`,
    reuseExistingServer: false, // Always start fresh for test isolation
    timeout: 120000, // 2 minutes for Tauri to build and start
    stdout: 'pipe',
    stderr: 'pipe',
    // Pass test environment variables to the sidecar
    env: {
      ...process.env,
      KODA_TEST_DB: TEST_DB_PATH,
      KODA_SOCKET: TEST_SOCKET_PATH,
      KODA_HTTP_PORT: String(TEST_HTTP_RPC_PORT),
      VITE_PORT: String(TEST_VITE_PORT),
      NODE_ENV: 'test',
    },
  },
})
