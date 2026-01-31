import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Test database path (same as in playwright.config.ts)
const TEST_DB_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.db')

/**
 * Global setup for E2E tests
 *
 * This runs ONCE before all tests to:
 * 1. Delete the test database (fresh start)
 * 2. The sidecar will auto-create it with migrations
 * 3. We seed test data via RPC after sidecar starts
 */
export default async function globalSetup() {
  // Set the env var for this process and child processes
  process.env.KODA_TEST_DB = TEST_DB_PATH

  console.log(`E2E Test Setup: Using test database at ${TEST_DB_PATH}`)

  // Delete the test database if it exists (fresh start)
  if (fs.existsSync(TEST_DB_PATH)) {
    console.log('Deleting existing test database...')
    fs.unlinkSync(TEST_DB_PATH)

    // Also delete WAL and SHM files if they exist
    const walPath = TEST_DB_PATH + '-wal'
    const shmPath = TEST_DB_PATH + '-shm'
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
  }

  // Ensure the directory exists
  const dbDir = path.dirname(TEST_DB_PATH)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  console.log('Test database will be created fresh by sidecar')
}

/**
 * Seed test data after the sidecar has started
 * Called from a test fixture or beforeAll hook
 */
export async function seedTestData(): Promise<void> {
  const RPC_URL = 'http://localhost:3939/rpc'

  // Wait for sidecar to be ready
  let retries = 10
  while (retries > 0) {
    try {
      const healthRes = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'health.ping', id: 1 }),
      })
      if (healthRes.ok) break
    } catch {
      // Sidecar not ready yet
    }
    retries--
    await new Promise((r) => setTimeout(r, 1000))
  }

  if (retries === 0) {
    console.log('Warning: Could not connect to sidecar for seeding')
    return
  }

  // Create a test workspace
  const createRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'workspace.create',
      params: {
        directoryName: 'e2e-test-workspace',
        workspaceType: 'standard',
      },
      id: 2,
    }),
  })

  if (createRes.ok) {
    console.log('Created test workspace: e2e-test-workspace')
  }
}
