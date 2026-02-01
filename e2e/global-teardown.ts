import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Test database path (same as in playwright.config.ts and global-setup.ts)
const TEST_DB_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.db')
const TEST_SOCKET_PATH = path.join(os.tmpdir(), 'koda-e2e-test', 'koda-test.sock')

/**
 * Global teardown for E2E tests
 *
 * This runs ONCE after all tests to clean up the test database.
 * This ensures a fresh state for the next test run and prevents
 * test data from accumulating.
 */
export default async function globalTeardown() {
  console.log('\nE2E Test Teardown: Cleaning up test database...')

  try {
    // Delete the test database, socket, and associated files
    const filesToDelete = [
      TEST_DB_PATH,
      TEST_DB_PATH + '-wal',
      TEST_DB_PATH + '-shm',
      TEST_SOCKET_PATH,
    ]

    for (const file of filesToDelete) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
        console.log(`  Deleted: ${file}`)
      }
    }

    // Optionally remove the test directory if empty
    const testDir = path.dirname(TEST_DB_PATH)
    if (fs.existsSync(testDir)) {
      const remaining = fs.readdirSync(testDir)
      if (remaining.length === 0) {
        fs.rmdirSync(testDir)
        console.log(`  Removed empty directory: ${testDir}`)
      }
    }

    console.log('Test database cleanup complete.')
  } catch (error) {
    // Don't fail tests if cleanup fails - just log the error
    console.error('Warning: Failed to clean up test database:', error)
  }
}
