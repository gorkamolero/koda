import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const timestamp = process.env.KODA_VIDEO_RECORDING_ID ?? new Date().toISOString().replaceAll(':', '-')
process.env.KODA_VIDEO_RECORDING_ID = timestamp

/** A durable recording of actual Koda browser UIs and real remote services. */
export default defineConfig({
  testDir: './demos',
  testMatch: 'collaboration-video.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  outputDir: fileURLToPath(new URL(`../proof-results/collaboration-video/${timestamp}/`, import.meta.url)),
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    // Invitation setup happens before the recorded context is created.
    trace: 'off',
    screenshot: 'only-on-failure',
  },
})
