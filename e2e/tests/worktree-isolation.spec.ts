import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as http from 'node:http'
import { execSync } from 'node:child_process'

const HTTP_PORT = process.env.KODA_HTTP_PORT || '3848'

/**
 * Simple HTTP RPC client for test setup
 */
async function rpc<T>(method: string, params?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: '2.0',
      method,
      params: params ?? null,
      id: Date.now(),
    }

    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: HTTP_PORT,
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
            reject(new Error(`RPC ${method}: ${response.error.message}`))
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
      reject(new Error(`RPC ${method} timed out`))
    })

    req.write(JSON.stringify(request))
    req.end()
  })
}

interface Workspace {
  id: string
  name: string
}

interface Repo {
  id: string
  rootPath: string
  name?: string
  defaultBranch?: string
}

interface Worktree {
  id: string
  repoId: string
  branch?: string | null
  worktreePath?: string | null
}

interface WorkspaceRepo {
  id: string
  workspaceId: string
  repoId: string
}

/**
 * Worktree Isolation E2E Test
 *
 * Verifies that files in worktree A don't appear in worktree B's diff view
 * and vice versa. This tests true git worktree isolation.
 */
test.describe('Worktree Isolation', () => {
  let workspaceA: Workspace
  let workspaceB: Workspace
  let worktreeA: Worktree
  let worktreeB: Worktree
  let repo: Repo

  const BRANCH_A = `test-branch-a-${Date.now()}`
  const BRANCH_B = `test-branch-b-${Date.now()}`
  const FILE_A = 'only-in-a.txt'
  const FILE_B = 'only-in-b.txt'

  test.beforeAll(async () => {
    // Get or create a repo (use the koda project itself)
    const repos = await rpc<Repo[]>('repo.list')

    if (repos.length === 0) {
      // Register the koda project as a repo
      const projectRoot = path.resolve(__dirname, '..', '..')
      repo = await rpc<Repo>('repo.create', { rootPath: projectRoot })
    } else {
      repo = repos[0]!
    }

    console.log(`Using repo: ${repo.name ?? repo.rootPath} (${repo.id})`)

    // Create workspace A (standalone container)
    workspaceA = await rpc<Workspace>('workspace.createStandalone', {
      name: `Isolation Test A - ${Date.now()}`,
    })
    console.log(`Created workspace A: ${workspaceA.name} (${workspaceA.id})`)

    // Attach repo to workspace A
    await rpc<WorkspaceRepo>('workspaceRepo.attach', {
      workspaceId: workspaceA.id,
      repoId: repo.id,
    })

    // Create worktree A with unique branch
    worktreeA = await rpc<Worktree>('worktree.create', {
      repoId: repo.id,
      branch: BRANCH_A,
      workspaceId: workspaceA.id,
    })
    console.log(`Created worktree A: ${worktreeA.branch} at ${worktreeA.worktreePath}`)

    // Create workspace B (standalone container)
    workspaceB = await rpc<Workspace>('workspace.createStandalone', {
      name: `Isolation Test B - ${Date.now()}`,
    })
    console.log(`Created workspace B: ${workspaceB.name} (${workspaceB.id})`)

    // Attach repo to workspace B
    await rpc<WorkspaceRepo>('workspaceRepo.attach', {
      workspaceId: workspaceB.id,
      repoId: repo.id,
    })

    // Create worktree B with different branch
    worktreeB = await rpc<Worktree>('worktree.create', {
      repoId: repo.id,
      branch: BRANCH_B,
      workspaceId: workspaceB.id,
    })
    console.log(`Created worktree B: ${worktreeB.branch} at ${worktreeB.worktreePath}`)

    // Write unique file to worktree A
    if (worktreeA.worktreePath) {
      const filePathA = path.join(worktreeA.worktreePath, FILE_A)
      fs.writeFileSync(filePathA, `This file exists only in worktree A\nBranch: ${BRANCH_A}\nTimestamp: ${Date.now()}\n`)
      console.log(`Created file in worktree A: ${filePathA}`)

      // Stage the file so it shows in diff
      try {
        execSync(`git add ${FILE_A}`, { cwd: worktreeA.worktreePath, stdio: 'pipe' })
        console.log(`Staged ${FILE_A} in worktree A`)
      } catch (e) {
        console.log(`Could not stage file in A: ${e}`)
      }
    }

    // Write unique file to worktree B
    if (worktreeB.worktreePath) {
      const filePathB = path.join(worktreeB.worktreePath, FILE_B)
      fs.writeFileSync(filePathB, `This file exists only in worktree B\nBranch: ${BRANCH_B}\nTimestamp: ${Date.now()}\n`)
      console.log(`Created file in worktree B: ${filePathB}`)

      // Stage the file so it shows in diff
      try {
        execSync(`git add ${FILE_B}`, { cwd: worktreeB.worktreePath, stdio: 'pipe' })
        console.log(`Staged ${FILE_B} in worktree B`)
      } catch (e) {
        console.log(`Could not stage file in B: ${e}`)
      }
    }
  })

  test.afterAll(async () => {
    // Cleanup: delete worktrees and workspaces
    try {
      if (worktreeA?.id) {
        await rpc('worktree.delete', { worktreeId: worktreeA.id, deleteBranch: true })
        console.log(`Deleted worktree A: ${worktreeA.id}`)
      }
    } catch (e) {
      console.log(`Failed to delete worktree A: ${e}`)
    }

    try {
      if (worktreeB?.id) {
        await rpc('worktree.delete', { worktreeId: worktreeB.id, deleteBranch: true })
        console.log(`Deleted worktree B: ${worktreeB.id}`)
      }
    } catch (e) {
      console.log(`Failed to delete worktree B: ${e}`)
    }

    try {
      if (workspaceA?.id) {
        await rpc('workspace.delete', { id: workspaceA.id })
        console.log(`Deleted workspace A: ${workspaceA.id}`)
      }
    } catch (e) {
      console.log(`Failed to delete workspace A: ${e}`)
    }

    try {
      if (workspaceB?.id) {
        await rpc('workspace.delete', { id: workspaceB.id })
        console.log(`Deleted workspace B: ${workspaceB.id}`)
      }
    } catch (e) {
      console.log(`Failed to delete workspace B: ${e}`)
    }
  })

  test('workspace A diff shows only-in-a.txt and NOT only-in-b.txt', async ({ page }) => {
    // Navigate to workspace A's worktree
    await page.goto(`/workspace/${workspaceA.id}/${worktreeA.id}`)

    // Wait for the page to load
    await expect(page.getByTestId('right-sidebar')).toBeVisible({ timeout: 15000 })

    // Click the CHANGES tab to show diff view
    const changesTab = page.getByTestId('right-tab-changes')
    await changesTab.click()
    await expect(changesTab).toHaveAttribute('data-active', 'true')

    // Wait for diff view container
    const diffContainer = page.getByTestId('diff-view-container')
    await expect(diffContainer).toBeVisible({ timeout: 10000 })

    // Verify only-in-a.txt IS present in workspace A's diff
    const fileA = page.getByTestId('diff-file-only-in-a-txt')
    await expect(fileA).toBeVisible({ timeout: 5000 })
    await expect(fileA).toHaveAttribute('data-file-status', 'added')

    // Verify only-in-b.txt is NOT present in workspace A's diff
    const fileB = page.getByTestId('diff-file-only-in-b-txt')
    await expect(fileB).not.toBeVisible()
  })

  test('workspace B diff shows only-in-b.txt and NOT only-in-a.txt', async ({ page }) => {
    // Navigate to workspace B's worktree
    await page.goto(`/workspace/${workspaceB.id}/${worktreeB.id}`)

    // Wait for the page to load
    await expect(page.getByTestId('right-sidebar')).toBeVisible({ timeout: 15000 })

    // Click the CHANGES tab to show diff view
    const changesTab = page.getByTestId('right-tab-changes')
    await changesTab.click()
    await expect(changesTab).toHaveAttribute('data-active', 'true')

    // Wait for diff view container
    const diffContainer = page.getByTestId('diff-view-container')
    await expect(diffContainer).toBeVisible({ timeout: 10000 })

    // Verify only-in-b.txt IS present in workspace B's diff
    const fileB = page.getByTestId('diff-file-only-in-b-txt')
    await expect(fileB).toBeVisible({ timeout: 5000 })
    await expect(fileB).toHaveAttribute('data-file-status', 'added')

    // Verify only-in-a.txt is NOT present in workspace B's diff
    const fileA = page.getByTestId('diff-file-only-in-a-txt')
    await expect(fileA).not.toBeVisible()
  })

  test('switching between workspaces shows correct isolated files', async ({ page }) => {
    // Start at workspace A
    await page.goto(`/workspace/${workspaceA.id}/${worktreeA.id}`)
    await expect(page.getByTestId('right-sidebar')).toBeVisible({ timeout: 15000 })

    // Switch to CHANGES tab
    await page.getByTestId('right-tab-changes').click()
    await expect(page.getByTestId('diff-view-container')).toBeVisible({ timeout: 10000 })

    // Verify A's file is visible
    await expect(page.getByTestId('diff-file-only-in-a-txt')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('diff-file-only-in-b-txt')).not.toBeVisible()

    // Navigate to workspace B
    await page.goto(`/workspace/${workspaceB.id}/${worktreeB.id}`)
    await expect(page.getByTestId('right-sidebar')).toBeVisible({ timeout: 15000 })

    // Switch to CHANGES tab
    await page.getByTestId('right-tab-changes').click()
    await expect(page.getByTestId('diff-view-container')).toBeVisible({ timeout: 10000 })

    // Verify B's file is now visible, A's file is not
    await expect(page.getByTestId('diff-file-only-in-b-txt')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('diff-file-only-in-a-txt')).not.toBeVisible()

    // Navigate back to workspace A and verify isolation is maintained
    await page.goto(`/workspace/${workspaceA.id}/${worktreeA.id}`)
    await expect(page.getByTestId('right-sidebar')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('right-tab-changes').click()
    await expect(page.getByTestId('diff-view-container')).toBeVisible({ timeout: 10000 })

    // A's file should still be the only one visible
    await expect(page.getByTestId('diff-file-only-in-a-txt')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('diff-file-only-in-b-txt')).not.toBeVisible()
  })

  test('worktree paths are different', async () => {
    // Direct assertion that the worktrees have different filesystem paths
    expect(worktreeA.worktreePath).toBeTruthy()
    expect(worktreeB.worktreePath).toBeTruthy()
    expect(worktreeA.worktreePath).not.toEqual(worktreeB.worktreePath)

    // Verify the files exist in their respective worktrees
    const fileAPath = path.join(worktreeA.worktreePath!, FILE_A)
    const fileBPath = path.join(worktreeB.worktreePath!, FILE_B)

    expect(fs.existsSync(fileAPath)).toBe(true)
    expect(fs.existsSync(fileBPath)).toBe(true)

    // Verify files do NOT exist in the wrong worktree
    const fileAInB = path.join(worktreeB.worktreePath!, FILE_A)
    const fileBInA = path.join(worktreeA.worktreePath!, FILE_B)

    expect(fs.existsSync(fileAInB)).toBe(false)
    expect(fs.existsSync(fileBInA)).toBe(false)
  })
})
