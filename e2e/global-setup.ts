import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Test database path (same as in playwright.config.ts)
const TEST_DB_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.db')
const TEST_SOCKET_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.sock')

/**
 * Global setup for E2E tests
 *
 * Two modes of operation:
 *
 * 1. SKIP_WEBSERVER=1 (testing against running app):
 *    - Don't set test env vars
 *    - Use the real app's database and socket
 *    - Seed data goes to the real database
 *
 * 2. Normal (Playwright starts the app):
 *    - Set test env vars for isolation
 *    - Create fresh test database
 *    - App starts with test socket
 */
export default async function globalSetup() {
  const skipWebServer = !!process.env.SKIP_WEBSERVER

  console.log('\n' + '='.repeat(60))
  console.log('E2E Test Setup')
  console.log('='.repeat(60))

  if (skipWebServer) {
    // Testing against already-running app - use its real database
    console.log('\x1b[33m⚠️  WARNING: SKIP_WEBSERVER mode\x1b[0m')
    console.log('\x1b[33m─────────────────────────────────────────────────\x1b[0m')
    console.log('Mode: Testing against RUNNING APP')
    console.log('This will WRITE TEST DATA to your REAL database!')
    console.log('')
    console.log('Test workspaces created will appear in your dev app.')
    console.log('To use isolated test database, run without SKIP_WEBSERVER.')
    console.log('\x1b[33m─────────────────────────────────────────────────\x1b[0m')

    // Make sure test env vars are NOT set so seed uses real socket
    delete process.env.KODA_TEST_DB
    delete process.env.KODA_SOCKET
  } else {
    // Playwright will start the app - use isolated test database
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
  }

  console.log('='.repeat(60) + '\n')
}
