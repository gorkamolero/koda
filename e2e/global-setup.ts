import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { execSync } from 'node:child_process'

// Test database path (same as in playwright.config.ts)
const TEST_DB_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.db')
const TEST_SOCKET_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.sock')

/**
 * Kill any lingering test processes to ensure clean state
 */
function killLingeringProcesses() {
  try {
    // Kill any processes using the test config
    execSync('pkill -9 -f "tauri.test.conf" 2>/dev/null || true', { stdio: 'ignore' })
    // Kill any sidecar processes using the test socket
    execSync('pkill -9 -f "koda-e2e-test" 2>/dev/null || true', { stdio: 'ignore' })
    // Small delay to let processes terminate
    execSync('sleep 1', { stdio: 'ignore' })
  } catch {
    // Ignore errors - processes might not exist
  }
}

/**
 * Global setup for E2E tests
 *
 * Tests ALWAYS use an isolated test database.
 * The user's real database is NEVER touched.
 *
 * This setup:
 * 1. Kills any lingering test processes
 * 2. Creates a fresh test directory
 * 3. Cleans up any existing test database files
 * 4. Sets environment variables for the test app
 */
export default async function globalSetup() {
  console.log('\n' + '='.repeat(60))
  console.log('E2E Test Setup')
  console.log('='.repeat(60))
  
  // Kill any lingering processes from previous test runs
  killLingeringProcesses()
  
  console.log('Mode: ISOLATED test database')
  console.log(`Test database: ${TEST_DB_PATH}`)
  console.log(`Test socket:   ${TEST_SOCKET_PATH}`)

  // Set the env vars for child processes (the app we'll start)
  process.env.KODA_TEST_DB = TEST_DB_PATH
  process.env.KODA_SOCKET = TEST_SOCKET_PATH
  process.env.NODE_ENV = 'test'

  // Ensure the test directory exists
  const testDir = path.dirname(TEST_DB_PATH)
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
    console.log(`Created test directory: ${testDir}`)
  }

  // NOTE: We do NOT delete the database here anymore.
  // The webServer (Tauri + sidecar) starts BEFORE globalSetup runs,
  // so the sidecar has already created and migrated the database.
  // Deleting it here would break everything.
  //
  // The sidecar creates a fresh test database on startup when
  // KODA_TEST_DB is set, so we get isolation without manual cleanup.
  
  console.log('Test database managed by sidecar (fresh on each run)')
  console.log('='.repeat(60) + '\n')
}
