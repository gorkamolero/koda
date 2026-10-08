import { defineConfig, devices } from '@playwright/test'

/** Real services only: no seed data, mocked agent, or skipped credentials. */
export default defineConfig({
  testDir: './proofs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { outputFolder: 'proof-report', open: 'never' }]],
  outputDir: 'proof-results',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    // Traces can contain bearer invitations. Keep proof output local and ignored.
    trace: 'retain-on-failure',
  },
})
