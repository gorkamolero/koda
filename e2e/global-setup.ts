import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Test database path (same as in playwright.config.ts)
const TEST_DB_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.db')
const TEST_SOCKET_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.sock')

/**
 * Global setup for E2E tests
 *
 * Tests ALWAYS use an isolated test database.
 * The user's real database is NEVER touched.
 *
 * This setup:
 * 1. Creates a fresh test directory
 * 2. Cleans up any existing test database files
 * 3. Sets environment variables for the test app
 */
export default async function globalSetup() {
  console.log('\n' + '='.repeat(60))
  console.log('E2E Test Setup')
  console.log('='.repeat(60))
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

  // Delete the test database if it exists (fresh start)
  const filesToDelete = [
    TEST_DB_PATH,
    TEST_DB_PATH + '-wal',
    TEST_DB_PATH + '-shm',
    TEST_SOCKET_PATH,
  ]

  let deletedCount = 0
  for (const file of filesToDelete) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      deletedCount++
    }
  }

  if (deletedCount > 0) {
    console.log(`Cleaned up ${deletedCount} existing test file(s)`)
  }

  console.log('Test database will be created fresh by sidecar')
  console.log('='.repeat(60) + '\n')
}
