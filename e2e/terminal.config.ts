import { defineConfig, devices } from '@playwright/test'

// Browser-only dependency regressions: no server, database, or provider account.
export default defineConfig({
  testDir: './terminal',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'] },
})
