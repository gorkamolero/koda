import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const timestamp = process.env.KODA_VIDEO_RECORDING_ID ?? new Date().toISOString().replaceAll(':', '-')
process.env.KODA_VIDEO_RECORDING_ID = timestamp

/** The two-machine collaboration recording: real services, both screens captured. */
export default defineConfig({
  testDir: './demos',
  testMatch: 'two-machine-video.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 1_200_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  outputDir: fileURLToPath(new URL(`../proof-results/two-machine-video/${timestamp}/`, import.meta.url)),
  use: { actionTimeout: 30_000, navigationTimeout: 30_000, trace: 'off' },
})
