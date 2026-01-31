import { test as setup } from '@playwright/test'
import { execSync } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Seed Setup
 *
 * This runs ONCE before all tests to create test data.
 * It connects to the sidecar's Unix socket and creates:
 * 1. A repository (this project)
 * 2. A workspace for testing
 */
setup('seed test data', async () => {
  console.log('\n=== Seeding Test Data ===')

  try {
    // Run the seed script from workspace root (where tsx is available)
    const workspaceRoot = path.join(__dirname, '..', '..')
    const output = execSync(`pnpm exec tsx e2e/seed-data.ts`, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      timeout: 60000, // 60 seconds - seed may need to wait for sidecar
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    console.log(output)
    console.log('=== Seed Complete ===\n')
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string; message: string }
    console.error('Seed failed!')
    console.error('stdout:', err.stdout)
    console.error('stderr:', err.stderr)
    console.error('error:', err.message)

    // Don't fail the entire test suite - some tests can still run
    // but log clearly that seeding failed
    console.log('\nWARNING: Seed failed. Some tests may skip.')
  }
})
