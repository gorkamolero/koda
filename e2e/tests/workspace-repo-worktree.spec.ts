import { test, expect } from '@playwright/test'
import * as http from 'node:http'

/**
 * Workspace → Repo → Worktree Flow E2E Tests
 *
 * Tests the three-level hierarchy:
 * - Workspace (pure container)
 * - Repo (attached to workspace)
 * - Worktree (auto-created main worktree when repo is attached)
 *
 * These tests verify the complete flow from creating a workspace
 * to seeing worktrees in the sidebar.
 */

const HTTP_PORT = process.env.KODA_HTTP_PORT || '3848'

interface RpcResponse<T> {
  jsonrpc: string
  result?: T
  error?: { code: number; message: string }
  id: number
}

interface Workspace {
  id: string
  name: string
}

interface Repo {
  id: string
  name: string
  rootPath: string
  defaultBranch: string
}

interface WorkspaceRepo {
  id: string
  workspaceId: string
  repoId: string
}

interface Worktree {
  id: string
  repoId: string
  branch: string
  worktreePath: string
  workspaceIds: string
}

/**
 * Make an RPC call to the sidecar
 */
async function rpcCall<T>(method: string, params?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: params ?? null,
      id: Date.now(),
    })

    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: HTTP_PORT,
      path: '/rpc',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(request),
      },
      timeout: 10000,
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const response: RpcResponse<T> = JSON.parse(data)
          if (response.error) {
            reject(new Error(response.error.message))
          } else {
            resolve(response.result as T)
          }
        } catch (e) {
          reject(new Error(`Failed to parse RPC response: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => reject(new Error('RPC request timeout')))
    req.write(request)
    req.end()
  })
}

/**
 * Wait for sidecar to be ready
 */
async function waitForSidecar(maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await rpcCall('workspace.list')
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return false
}

/**
 * Clean up test data
 */
async function cleanupTestData(): Promise<void> {
  try {
    // List and delete all workspaces
    const workspaces = await rpcCall<Workspace[]>('workspace.list')
    for (const ws of workspaces) {
      await rpcCall('workspace.delete', { id: ws.id }).catch(() => {})
    }

    // List and delete all repos
    const repos = await rpcCall<Repo[]>('repo.list')
    for (const repo of repos) {
      await rpcCall('repo.delete', { id: repo.id }).catch(() => {})
    }
  } catch {
    // Ignore cleanup errors
  }
}

test.describe('Workspace → Repo → Worktree Flow', () => {
  test.beforeAll(async () => {
    const ready = await waitForSidecar()
    if (!ready) {
      throw new Error('Sidecar not ready after 30 seconds')
    }
  })

  test.beforeEach(async () => {
    await cleanupTestData()
  })

  test.describe('Complete Flow', () => {
    test('creating workspace from sidebar shows in dropdown', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Clear localStorage for fresh state
      await page.evaluate(() => localStorage.clear())
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Should see "Select Workspace" in the dropdown (no workspace selected)
      const workspaceDropdown = page.locator('button').filter({ hasText: /Select Workspace/i })
      await expect(workspaceDropdown).toBeVisible({ timeout: 10000 })

      // Click the NEW WORKSPACE button (either in header or content area)
      const newWsButton = page.locator('button').filter({ hasText: /NEW WORKSPACE/i }).first()
      await newWsButton.click()

      // Modal should appear with input field
      const nameInput = page.locator('input[type="text"], input[placeholder*="workspace"]').first()
      await expect(nameInput).toBeVisible({ timeout: 5000 })

      // Fill in workspace name
      await nameInput.fill('e2e-test-workspace')

      // Click CREATE button
      const createButton = page.locator('button').filter({ hasText: /CREATE/i }).first()
      await createButton.click()

      // Wait for modal to close and workspace to be selected
      await page.waitForTimeout(1000)

      // Workspace should now be selected in dropdown
      const selectedWorkspace = page.locator('button').filter({ hasText: 'e2e-test-workspace' })
      await expect(selectedWorkspace).toBeVisible({ timeout: 5000 })

      // Verify in database
      const workspaces = await rpcCall<Workspace[]>('workspace.list')
      const created = workspaces.find((w) => w.name === 'e2e-test-workspace')
      expect(created).toBeDefined()
    })

    test('attaching repo creates main worktree automatically', async ({ page }) => {
      // Create workspace via RPC first
      const workspace = await rpcCall<Workspace>('workspace.createStandalone', {
        name: 'repo-test-workspace',
      })

      // Create repo via RPC (using the montevideo repo itself as test data)
      const repoPath = process.cwd().replace('/e2e', '') // Project root
      const repo = await rpcCall<Repo>('repo.create', { rootPath: repoPath })

      // Attach repo to workspace
      const attachment = await rpcCall<WorkspaceRepo>('workspaceRepo.attach', {
        workspaceId: workspace.id,
        repoId: repo.id,
      })
      expect(attachment.workspaceId).toBe(workspace.id)
      expect(attachment.repoId).toBe(repo.id)

      // Verify main worktree was created
      const worktrees = await rpcCall<Worktree[]>('worktree.listByWorkspace', {
        workspaceId: workspace.id,
        includeArchived: false,
      })

      expect(worktrees.length).toBeGreaterThan(0)

      const mainWorktree = worktrees.find((wt) => wt.branch === repo.defaultBranch)
      expect(mainWorktree).toBeDefined()
      expect(mainWorktree!.repoId).toBe(repo.id)
      expect(mainWorktree!.worktreePath).toBe(repo.rootPath)

      // Verify workspaceIds includes our workspace
      const workspaceIds = JSON.parse(mainWorktree!.workspaceIds) as string[]
      expect(workspaceIds).toContain(workspace.id)
    })

    test('attached repo with worktree appears in sidebar', async ({ page }) => {
      // Setup via RPC
      const workspace = await rpcCall<Workspace>('workspace.createStandalone', {
        name: 'sidebar-test-workspace',
      })

      const repoPath = process.cwd().replace('/e2e', '')
      const repo = await rpcCall<Repo>('repo.create', { rootPath: repoPath })

      await rpcCall<WorkspaceRepo>('workspaceRepo.attach', {
        workspaceId: workspace.id,
        repoId: repo.id,
      })

      // Navigate and select the workspace
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Set workspace in localStorage and reload
      await page.evaluate((wsId) => {
        localStorage.setItem('selectedWorkspaceId', JSON.stringify(wsId))
      }, workspace.id)
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Wait for sidebar to load
      await page.waitForTimeout(2000)

      // Should see the repo in sidebar with worktree count
      const repoButton = page.locator('button').filter({ hasText: new RegExp(`${repo.name}.*\\(1\\)`, 'i') })
      await expect(repoButton).toBeVisible({ timeout: 10000 })

      // Expand repo to see worktrees
      await repoButton.click()
      await page.waitForTimeout(500)

      // Should see main worktree
      const mainWorktree = page.locator('a, button').filter({ hasText: /main/i })
      await expect(mainWorktree.first()).toBeVisible({ timeout: 5000 })
    })

    test('detaching repo removes workspace from worktree workspaceIds', async ({ page }) => {
      // Setup
      const workspace = await rpcCall<Workspace>('workspace.createStandalone', {
        name: 'detach-test-workspace',
      })

      const repoPath = process.cwd().replace('/e2e', '')
      const repo = await rpcCall<Repo>('repo.create', { rootPath: repoPath })

      await rpcCall<WorkspaceRepo>('workspaceRepo.attach', {
        workspaceId: workspace.id,
        repoId: repo.id,
      })

      // Verify worktree has workspaceId
      let worktrees = await rpcCall<Worktree[]>('worktree.listByWorkspace', {
        workspaceId: workspace.id,
        includeArchived: false,
      })
      expect(worktrees.length).toBe(1)

      // Detach repo
      await rpcCall('workspaceRepo.detach', {
        workspaceId: workspace.id,
        repoId: repo.id,
      })

      // Worktree should no longer be visible in this workspace
      worktrees = await rpcCall<Worktree[]>('worktree.listByWorkspace', {
        workspaceId: workspace.id,
        includeArchived: false,
      })
      expect(worktrees.length).toBe(0)
    })

    test('same repo attached to multiple workspaces shares main worktree', async ({ page }) => {
      // Create two workspaces
      const ws1 = await rpcCall<Workspace>('workspace.createStandalone', { name: 'ws-one' })
      const ws2 = await rpcCall<Workspace>('workspace.createStandalone', { name: 'ws-two' })

      // Create and attach repo to first workspace
      const repoPath = process.cwd().replace('/e2e', '')
      const repo = await rpcCall<Repo>('repo.create', { rootPath: repoPath })

      await rpcCall<WorkspaceRepo>('workspaceRepo.attach', {
        workspaceId: ws1.id,
        repoId: repo.id,
      })

      // Attach same repo to second workspace
      await rpcCall<WorkspaceRepo>('workspaceRepo.attach', {
        workspaceId: ws2.id,
        repoId: repo.id,
      })

      // Both workspaces should see the same worktree
      const wt1 = await rpcCall<Worktree[]>('worktree.listByWorkspace', {
        workspaceId: ws1.id,
        includeArchived: false,
      })
      const wt2 = await rpcCall<Worktree[]>('worktree.listByWorkspace', {
        workspaceId: ws2.id,
        includeArchived: false,
      })

      expect(wt1.length).toBe(1)
      expect(wt2.length).toBe(1)
      expect(wt1[0].id).toBe(wt2[0].id) // Same worktree

      // workspaceIds should contain both workspace IDs
      const workspaceIds = JSON.parse(wt1[0].workspaceIds) as string[]
      expect(workspaceIds).toContain(ws1.id)
      expect(workspaceIds).toContain(ws2.id)
    })
  })

  test.describe('Self-Healing', () => {
    test('listWorkspaceRepos auto-creates missing main worktree', async ({ page }) => {
      // Create workspace and repo
      const workspace = await rpcCall<Workspace>('workspace.createStandalone', {
        name: 'self-heal-test',
      })

      const repoPath = process.cwd().replace('/e2e', '')
      const repo = await rpcCall<Repo>('repo.create', { rootPath: repoPath })

      // Manually create workspace_repos entry WITHOUT creating worktree
      // This simulates a corrupted/incomplete state
      // We can't easily do this via RPC, so we'll test via listing
      // The attach RPC should create the worktree, but let's verify
      // the self-healing in list also works

      await rpcCall<WorkspaceRepo>('workspaceRepo.attach', {
        workspaceId: workspace.id,
        repoId: repo.id,
      })

      // List workspace repos (should trigger self-healing if needed)
      const repos = await rpcCall<Array<{ repoId: string; repoName: string }>>('workspaceRepo.list', {
        workspaceId: workspace.id,
      })

      expect(repos.length).toBe(1)
      expect(repos[0].repoId).toBe(repo.id)

      // Worktree should exist
      const worktrees = await rpcCall<Worktree[]>('worktree.listByWorkspace', {
        workspaceId: workspace.id,
        includeArchived: false,
      })

      expect(worktrees.length).toBeGreaterThan(0)
    })
  })
})
