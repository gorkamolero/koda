import { defineConfig, devices } from '@playwright/test'
import * as path from 'node:path'
import * as os from 'node:os'

// Test database path - separate from user's real database
const TEST_DB_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.db')

// Test socket path - separate from user's real socket
const TEST_SOCKET_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.sock')

/**
 * E2E Test Configuration
 *
 * These tests run against the REAL app - no mocks.
 * Uses a SEPARATE test database and socket that gets wiped before/after test runs.
 * The user's real database is never touched.
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

  // Start desktop dev server before running tests
  // The test environment variables are passed to ensure isolation
  // Set SKIP_WEBSERVER=1 to skip starting servers (when testing against existing app)
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm --filter desktop tauri dev',
        url: 'http://localhost:1420',
        reuseExistingServer: false, // Always start fresh for test isolation
        timeout: 120000, // 2 minutes for Tauri to build and start
        stdout: 'pipe',
        stderr: 'pipe',
        // Pass test environment variables to the sidecar
        env: {
          ...process.env,
          KODA_TEST_DB: TEST_DB_PATH,
          KODA_SOCKET: TEST_SOCKET_PATH,
          KODA_HTTP_PORT: '3847', // HTTP RPC port for browser-based E2E tests
          NODE_ENV: 'test',
        },
      },
})
