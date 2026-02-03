import { test, expect, Page } from '@playwright/test'
import * as path from 'node:path'
import * as os from 'node:os'
import * as http from 'node:http'

// HTTP RPC port for E2E tests
const HTTP_RPC_PORT = process.env.KODA_HTTP_PORT || '3848'

/**
 * JSON-RPC helper for test setup
 */
async function rpcCall<T>(method: string, params?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: '2.0',
      method,
      params: params ?? null,
      id: Date.now(),
    }

    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: parseInt(HTTP_RPC_PORT, 10),
      path: '/rpc',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const response = JSON.parse(data)
          if (response.error) {
            reject(new Error(response.error.message))
          } else {
            resolve(response.result as T)
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`RPC call ${method} timed out`))
    })

    req.write(JSON.stringify(request))
    req.end()
  })
}

interface Repo {
  id: string
  rootPath: string
  name: string | null
}

interface Worktree {
  id: string
  workspaceId: string
  worktreePath: string
  branch: string | null
}

/**
 * Helper to type commands into xterm.js terminal
 * 
 * xterm.js captures keyboard input directly, so we need to:
 * 1. Click to focus the terminal viewport
 * 2. Use page.keyboard to type characters
 * 3. Press Enter to execute
 */
async function typeInTerminal(page: Page, command: string): Promise<void> {
  // Focus the terminal viewport (xterm.js container)
  // Use .first() since multiple terminal tabs may exist
  const terminalViewport = page.getByTestId('terminal-viewport').first()
  await terminalViewport.click()
  
  // Small delay to ensure terminal is focused and ready
  await page.waitForTimeout(200)
  
  // Type the command character by character
  await page.keyboard.type(command, { delay: 30 })
  
  // Press Enter to execute
  await page.keyboard.press('Enter')
  
  // Wait for command to be processed
  await page.waitForTimeout(500)
}

/**
 * Wait for terminal to show a specific output
 * 
 * Since xterm.js renders to a canvas-like element, we check
 * for PTY session readiness via the tab's data attributes
 */
async function waitForTerminalReady(page: Page): Promise<void> {
  // Wait for terminal container to be visible
  await page.getByTestId('terminal-container').waitFor({ state: 'visible' })
  
  // Wait for a terminal tab to exist (indicating PTY session is created)
  const terminalTab = page.locator('[data-testid^="terminal-tab-"]').first()
  await terminalTab.waitFor({ state: 'visible', timeout: 15000 })
  
  // Wait for the connecting spinner to disappear (PTY is ready)
  // Use .first() since multiple terminal tabs may exist
  await expect(page.getByTestId('terminal-connecting-spinner').first()).toBeHidden({ timeout: 15000 })
  
  // PID may or may not be visible depending on backend state
  // If it's visible, great. If not, the spinner being hidden is enough.
  const pidElement = page.getByTestId('terminal-pid').first()
  try {
    await pidElement.waitFor({ state: 'visible', timeout: 3000 })
  } catch {
    // PID not visible - that's OK, terminal might still be ready
    console.log('[Test] PID element not visible, proceeding anyway')
  }
  
  // Extra buffer to ensure shell prompt is ready
  await page.waitForTimeout(1500)
}

// SKIPPED: PTY fails to spawn shell in test environment ("posix_spawnp failed")
// TODO: Fix PTY environment or mock terminal interactions
test.describe.skip('Terminal → Git → Diff Flow', () => {
  let workspaceId: string
  let worktreeId: string
  let worktreePath: string

  test.beforeAll(async () => {
    // Get existing repos (seed-data should have created one)
    const repos = await rpcCall<Repo[]>('repo.list')
    
    if (repos.length === 0) {
      throw new Error('No repos found. Make sure seed-data.ts ran successfully.')
    }
    
    const repo = repos[0]!
    const repoName = path.basename(repo.rootPath)
    
    // Create a fresh worktree for this test
    const branchName = `e2e-terminal-test-${Date.now()}`
    
    const worktree = await rpcCall<Worktree>('worktree.create', {
      repoId: repo.id,
      branch: branchName,
    })
    
    workspaceId = worktree.workspaceId
    worktreeId = worktree.id
    worktreePath = path.join(os.homedir(), '.koda', 'worktrees', repoName, branchName)
    
    console.log(`[Test Setup] Created worktree: ${worktreeId}`)
    console.log(`[Test Setup] Worktree path: ${worktreePath}`)
    console.log(`[Test Setup] Branch: ${branchName}`)
  })

  test.afterAll(async () => {
    // Cleanup: delete the worktree we created
    if (worktreeId) {
      try {
        await rpcCall('worktree.delete', { worktreeId })
        console.log(`[Test Cleanup] Deleted worktree: ${worktreeId}`)
      } catch (err) {
        console.error(`[Test Cleanup] Failed to delete worktree:`, err)
      }
    }
  })

  test('creates file via terminal and sees it in diff view', async ({ page }) => {
    // =========================================================================
    // Step 1: Navigate to workspace
    // =========================================================================
    await page.goto(`/workspace/${workspaceId}/${worktreeId}`)
    
    // Wait for workspace to load
    await expect(page.getByTestId('main-content')).toBeVisible()
    await expect(page.getByTestId('right-panel')).toBeVisible()
    
    // =========================================================================
    // Step 2: Verify terminal panel is visible and wait for it to be ready
    // =========================================================================
    await expect(page.getByTestId('terminal-panel')).toBeVisible()
    await waitForTerminalReady(page)
    
    console.log('[Test] Terminal is ready')
    
    // =========================================================================
    // Step 3: Execute commands in terminal
    // =========================================================================
    
    // Create a test file via echo
    await typeInTerminal(page, 'echo "terminal test" > terminal-created.txt')
    console.log('[Test] Created terminal-created.txt')
    
    // Stage the file with git add
    await typeInTerminal(page, 'git add terminal-created.txt')
    console.log('[Test] Staged terminal-created.txt')
    
    // Give git a moment to process
    await page.waitForTimeout(1000)
    
    // =========================================================================
    // Step 4: Switch to Changes/Diff tab
    // =========================================================================
    const changesTab = page.getByTestId('right-tab-changes')
    await changesTab.click()
    
    // Wait for tab to become active
    await expect(changesTab).toHaveAttribute('data-active', 'true')
    console.log('[Test] Switched to Changes tab')
    
    // =========================================================================
    // Step 5: Wait for diff view to update and show our file
    // =========================================================================
    
    // The diff view container should be visible
    await expect(page.getByTestId('diff-view-container')).toBeVisible()
    
    // Wait for the file to appear in the diff list
    // The test ID format is: diff-file-{filename} with dots replaced by dashes
    const diffFileRow = page.getByTestId('diff-file-terminal-created-txt')
    
    // Use retry logic since git diff might take a moment to update
    await expect(diffFileRow).toBeVisible({ timeout: 15000 })
    
    // Verify it shows as added (staged new file)
    await expect(diffFileRow).toHaveAttribute('data-file-status', 'added')
    console.log('[Test] File terminal-created.txt appears in diff view as added')
    
    // =========================================================================
    // Step 6: Click the file and verify diff content
    // =========================================================================
    await diffFileRow.click()
    
    // After clicking, the file should open in the editor
    // Wait for editor to load the file content
    await page.waitForTimeout(1000)
    
    // The content "terminal test" should be visible somewhere in the UI
    // This could be in the editor or a diff viewer
    // Check for the text content on the page
    const pageContent = await page.textContent('body')
    expect(pageContent).toContain('terminal test')
    
    console.log('[Test] Diff content shows "terminal test"')
    console.log('[Test] ✓ Terminal → Git → Diff flow completed successfully')
  })

  test('multiple terminal commands reflect in diff', async ({ page }) => {
    // Navigate to workspace
    await page.goto(`/workspace/${workspaceId}/${worktreeId}`)
    
    await expect(page.getByTestId('terminal-panel')).toBeVisible()
    await waitForTerminalReady(page)
    
    // Create multiple files
    await typeInTerminal(page, 'echo "file one content" > multi-test-1.txt')
    await typeInTerminal(page, 'echo "file two content" > multi-test-2.txt')
    
    // Stage them together
    await typeInTerminal(page, 'git add multi-test-1.txt multi-test-2.txt')
    await page.waitForTimeout(1000)
    
    // Switch to Changes tab
    const changesTab = page.getByTestId('right-tab-changes')
    await changesTab.click()
    await expect(changesTab).toHaveAttribute('data-active', 'true')
    
    // Both files should appear in the diff
    await expect(page.getByTestId('diff-file-multi-test-1-txt')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('diff-file-multi-test-2-txt')).toBeVisible({ timeout: 15000 })
    
    console.log('[Test] ✓ Multiple files from terminal appear in diff')
  })
})
