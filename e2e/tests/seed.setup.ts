import { test as setup } from '@playwright/test'

/**
 * Seed Setup
 *
 * This runs ONCE before all tests to create test data.
 * It's configured as a "setup" project in playwright.config.ts
 */
setup('seed test data', async () => {
  const RPC_URL = 'http://localhost:3939/rpc'

  console.log('Seeding test data...')

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
      id: 1,
    }),
  })

  const result = await createRes.json()
  if (result.error) {
    console.log('Seed error (may already exist):', result.error.message)
  } else {
    console.log('Created test workspace')
  }
})
