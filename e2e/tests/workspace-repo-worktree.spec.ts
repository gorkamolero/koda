import { test, expect } from '@playwright/test'
import * as http from 'node:http'

/**
 * Workspace → Repo → Worktree UI Tests
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

async function cleanupTestData(): Promise<void> {
  try {
    const workspaces = await rpcCall<Workspace[]>('workspace.list')
    for (const ws of workspaces) {
      await rpcCall('workspace.delete', { id: ws.id }).catch(() => {})
    }
    const repos = await rpcCall<Repo[]>('repo.list')
    for (const repo of repos) {
      await rpcCall('repo.delete', { id: repo.id }).catch(() => {})
    }
  } catch {
    // Ignore cleanup errors
  }
}

test.describe('Workspace UI Flow', () => {
  test.beforeAll(async () => {
    const ready = await waitForSidecar()
    if (!ready) throw new Error('Sidecar not ready')
  })

  test.beforeEach(async () => {
    await cleanupTestData()
  })

  test('create workspace and see it in list', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Click NEW WORKSPACE
    const newWsButton = page.locator('button').filter({ hasText: /NEW WORKSPACE/i }).first()
    await newWsButton.click()

    // Fill name and create
    const nameInput = page.locator('input[type="text"]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill('test-workspace')

    const createButton = page.locator('button').filter({ hasText: /CREATE/i }).first()
    await createButton.click()

    // Should see WORKSPACES heading
    await expect(page.getByRole('heading', { name: 'WORKSPACES' })).toBeVisible({ timeout: 5000 })

    // Should see workspace card with repo/worktree counts
    await expect(page.getByText(/test-workspace.*repos/i)).toBeVisible({ timeout: 5000 })
  })

  test('workspace with repo shows hierarchy', async ({ page }) => {
    // Setup via RPC
    const workspace = await rpcCall<Workspace>('workspace.createStandalone', {
      name: 'hierarchy-test',
    })
    const repoPath = process.cwd().replace('/e2e', '')
    const repo = await rpcCall<Repo>('repo.create', { rootPath: repoPath })
    await rpcCall<WorkspaceRepo>('workspaceRepo.attach', {
      workspaceId: workspace.id,
      repoId: repo.id,
    })

    // Load page with workspace selected
    await page.goto('/')
    await page.evaluate((wsId) => {
      localStorage.setItem('selectedWorkspaceId', JSON.stringify(wsId))
    }, workspace.id)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Should see WORKSPACES heading (use role to be specific)
    await expect(page.getByRole('heading', { name: 'WORKSPACES' })).toBeVisible({ timeout: 10000 })

    // Should see the workspace card with "1 repos"
    await expect(page.getByText(/hierarchy-test.*1 repo/i)).toBeVisible({ timeout: 5000 })

    // Should see repo name somewhere in the page
    await expect(page.getByText(repo.name).first()).toBeVisible({ timeout: 5000 })
  })
})
