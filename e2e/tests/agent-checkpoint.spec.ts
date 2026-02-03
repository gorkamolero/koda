/**
 * E2E Test: Agent Checkpoint System
 *
 * Tests the git checkpoint functionality that allows undoing agent changes.
 * This simulates the real workflow:
 * 1. Agent makes code changes in a worktree
 * 2. Checkpoint is created to capture state
 * 3. More changes are made
 * 4. User can restore to previous checkpoint
 *
 * Uses real RPC calls to the sidecar - no mocks.
 */

import { test, expect } from '@playwright/test'
import * as http from 'node:http'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

// Test ports - must match playwright.config.ts
const TEST_HTTP_RPC_PORT = process.env.KODA_HTTP_PORT || '3848'

// ============================================================================
// RPC Client
// ============================================================================

interface RpcResponse<T = unknown> {
  jsonrpc: '2.0'
  result?: T
  error?: { code: number; message: string }
  id: number
}

/**
 * Simple HTTP RPC client for E2E tests
 */
class RpcClient {
  private baseUrl: string
  private nextId = 1

  constructor(port: string | number) {
    this.baseUrl = `http://localhost:${port}/rpc`
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++
    const request = {
      jsonrpc: '2.0',
      method,
      params: params ?? null,
      id,
    }

    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl)
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const response: RpcResponse<T> = JSON.parse(data)
            if (response.error) {
              reject(new Error(`RPC ${method}: ${response.error.message}`))
            } else {
              resolve(response.result as T)
            }
          } catch (e) {
            reject(new Error(`Failed to parse RPC response: ${data}`))
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
}

// ============================================================================
// Test Types
// ============================================================================

interface Repo {
  id: string
  rootPath: string
  name: string | null
}

interface Worktree {
  id: string
  repoId: string
  branch: string | null
  worktreePath: string | null
}

interface GitCheckpoint {
  id: string
  worktreeId: string
  turnId: string
  headOid: string
  indexTree: string
  worktreeTree: string
  createdAt: string
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a temporary git repository for testing
 */
function createTestRepo(): string {
  const repoPath = path.join(os.tmpdir(), `koda-e2e-checkpoint-${Date.now()}-${randomUUID().slice(0, 8)}`)
  fs.mkdirSync(repoPath, { recursive: true })

  execSync('git init', { cwd: repoPath, stdio: 'pipe' })
  execSync('git config user.email "e2e-test@koda.app"', { cwd: repoPath, stdio: 'pipe' })
  execSync('git config user.name "E2E Test"', { cwd: repoPath, stdio: 'pipe' })

  // Create initial commit
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# Checkpoint Test Repo\n')
  execSync('git add .', { cwd: repoPath, stdio: 'pipe' })
  execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'pipe' })

  return repoPath
}

/**
 * Clean up a test repository
 */
function cleanupTestRepo(repoPath: string): void {
  if (repoPath && fs.existsSync(repoPath)) {
    try {
      fs.rmSync(repoPath, { recursive: true, force: true })
    } catch (e) {
      console.warn(`Failed to cleanup test repo: ${repoPath}`, e)
    }
  }
}

/**
 * Wait for RPC server to be ready
 */
async function waitForRpc(client: RpcClient, maxAttempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.call('ping')
      return
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(`RPC server not ready after ${maxAttempts} attempts`)
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Agent Checkpoint System', () => {
  let rpc: RpcClient
  let testRepoPath: string
  let repoId: string
  let worktreeId: string
  let worktreePath: string

  test.beforeAll(async () => {
    rpc = new RpcClient(TEST_HTTP_RPC_PORT)
    await waitForRpc(rpc)
  })

  test.beforeEach(async () => {
    // Create a fresh test repository
    testRepoPath = createTestRepo()

    // Register the repo via RPC
    const repo = await rpc.call<Repo>('repo.create', {
      rootPath: testRepoPath,
      name: `checkpoint-e2e-${Date.now()}`,
    })
    repoId = repo.id

    // Create a worktree for testing
    const branchName = `e2e-checkpoint-${Date.now()}`
    const worktree = await rpc.call<Worktree>('worktree.create', {
      repoId,
      branch: branchName,
    })
    worktreeId = worktree.id
    worktreePath = worktree.worktreePath!
  })

  test.afterEach(async () => {
    // Clean up worktree
    if (worktreeId) {
      try {
        await rpc.call('worktree.delete', { id: worktreeId })
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up repo
    if (repoId) {
      try {
        await rpc.call('repo.delete', { id: repoId })
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up filesystem
    cleanupTestRepo(testRepoPath)
  })

  test('should create checkpoint after agent makes code changes', async () => {
    // Simulate agent writing a file
    const agentFile = path.join(worktreePath, 'agent-feature.ts')
    const agentCode = `// Agent-generated code
export function newFeature(): string {
  return 'Hello from agent!'
}
`
    fs.writeFileSync(agentFile, agentCode)

    // Create checkpoint
    const checkpoint = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'turn-1',
      repoPath: worktreePath,
    })

    // Verify checkpoint was created with valid data
    expect(checkpoint.id).toBeDefined()
    expect(checkpoint.worktreeId).toBe(worktreeId)
    expect(checkpoint.turnId).toBe('turn-1')
    expect(checkpoint.headOid).toMatch(/^[0-9a-f]{40}$/)
    expect(checkpoint.indexTree).toMatch(/^[0-9a-f]{40}$/)
    expect(checkpoint.worktreeTree).toMatch(/^[0-9a-f]{40}$/)
  })

  test('should list checkpoints for a worktree', async () => {
    // Create multiple checkpoints with different states
    fs.writeFileSync(path.join(worktreePath, 'file1.ts'), 'const a = 1;')
    const checkpoint1 = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'turn-1',
      repoPath: worktreePath,
    })

    fs.writeFileSync(path.join(worktreePath, 'file2.ts'), 'const b = 2;')
    const checkpoint2 = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'turn-2',
      repoPath: worktreePath,
    })

    // List checkpoints
    const checkpoints = await rpc.call<GitCheckpoint[]>('checkpoint.list', {
      worktreeId,
    })

    expect(checkpoints.length).toBeGreaterThanOrEqual(2)
    expect(checkpoints.some((c) => c.id === checkpoint1.id)).toBe(true)
    expect(checkpoints.some((c) => c.id === checkpoint2.id)).toBe(true)
  })

  test('should restore checkpoint and revert file changes', async () => {
    // Initial state: create a file and checkpoint
    const testFile = path.join(worktreePath, 'feature.ts')
    fs.writeFileSync(testFile, 'const version = 1;\n')

    const checkpoint = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'before-changes',
      repoPath: worktreePath,
    })

    // Simulate agent making more changes
    fs.writeFileSync(testFile, 'const version = 2; // Agent modified\n')
    fs.writeFileSync(path.join(worktreePath, 'new-file.ts'), 'export const NEW = true;')

    // Verify changes exist
    const modifiedContent = fs.readFileSync(testFile, 'utf-8')
    expect(modifiedContent).toContain('version = 2')
    expect(fs.existsSync(path.join(worktreePath, 'new-file.ts'))).toBe(true)

    // Restore checkpoint
    await rpc.call('checkpoint.restore', {
      checkpointId: checkpoint.id,
      repoPath: worktreePath,
    })

    // Verify file is reverted
    const restoredContent = fs.readFileSync(testFile, 'utf-8')
    expect(restoredContent).toBe('const version = 1;\n')

    // New file should be gone (worktree restored to checkpoint state)
    expect(fs.existsSync(path.join(worktreePath, 'new-file.ts'))).toBe(false)
  })

  test('should capture both staged and unstaged changes in checkpoint', async () => {
    // Create staged changes
    const stagedFile = path.join(worktreePath, 'staged.ts')
    fs.writeFileSync(stagedFile, 'export const STAGED = true;')
    execSync('git add staged.ts', { cwd: worktreePath, stdio: 'pipe' })

    // Create unstaged changes
    const unstagedFile = path.join(worktreePath, 'unstaged.ts')
    fs.writeFileSync(unstagedFile, 'export const UNSTAGED = true;')

    // Create checkpoint
    const checkpoint = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'mixed-changes',
      repoPath: worktreePath,
    })

    // Verify checkpoint captured both
    expect(checkpoint.indexTree).toBeDefined()
    expect(checkpoint.worktreeTree).toBeDefined()
    // Index and worktree trees should differ (one has staged, other has all)
    expect(checkpoint.indexTree).not.toBe(checkpoint.worktreeTree)

    // Destroy both files and restore
    fs.unlinkSync(stagedFile)
    fs.unlinkSync(unstagedFile)
    execSync('git reset HEAD', { cwd: worktreePath, stdio: 'pipe' })

    await rpc.call('checkpoint.restore', {
      checkpointId: checkpoint.id,
      repoPath: worktreePath,
    })

    // Both files should be restored
    expect(fs.existsSync(stagedFile)).toBe(true)
    expect(fs.existsSync(unstagedFile)).toBe(true)
    expect(fs.readFileSync(stagedFile, 'utf-8')).toBe('export const STAGED = true;')
    expect(fs.readFileSync(unstagedFile, 'utf-8')).toBe('export const UNSTAGED = true;')
  })

  test('should diff between two checkpoints', async () => {
    // Checkpoint 1: Initial state
    const checkpoint1 = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'before',
      repoPath: worktreePath,
    })

    // Make changes
    fs.writeFileSync(path.join(worktreePath, 'added.ts'), 'export const ADDED = true;\n')
    fs.appendFileSync(path.join(worktreePath, 'FEATURES.md'), '\nModified by agent\n')
    execSync('git add .', { cwd: worktreePath, stdio: 'pipe' })
    execSync('git commit -m "Agent changes"', { cwd: worktreePath, stdio: 'pipe' })

    // Checkpoint 2: After changes
    const checkpoint2 = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'after',
      repoPath: worktreePath,
    })

    // Get diff between checkpoints
    interface CheckpointDiff {
      files: Array<{
        path: string
        status: 'added' | 'modified' | 'deleted'
        additions?: number
        deletions?: number
      }>
      summary: {
        filesChanged: number
        additions: number
        deletions: number
      }
    }

    const diff = await rpc.call<CheckpointDiff>('checkpoint.diff', {
      checkpointId1: checkpoint1.id,
      checkpointId2: checkpoint2.id,
      repoPath: worktreePath,
    })

    // Verify diff shows the changes - at minimum we should see added.ts
    expect(diff.summary.filesChanged).toBeGreaterThanOrEqual(1)
    expect(diff.files.some((f) => f.path === 'added.ts' && f.status === 'added')).toBe(true)
    // FEATURES.md change detection - allow 'added' status if file was created fresh in worktree
    const featuresFile = diff.files.find((f) => f.path === 'FEATURES.md')
    if (featuresFile) {
      expect(['added', 'modified']).toContain(featuresFile.status)
    }
  })

  test('should get individual checkpoint by ID', async () => {
    fs.writeFileSync(path.join(worktreePath, 'test.ts'), 'const x = 1;')

    const created = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'get-test',
      repoPath: worktreePath,
    })

    const retrieved = await rpc.call<GitCheckpoint | null>('checkpoint.get', {
      checkpointId: created.id,
    })

    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(created.id)
    expect(retrieved!.turnId).toBe('get-test')
    expect(retrieved!.headOid).toBe(created.headOid)
  })

  test('should return null for non-existent checkpoint', async () => {
    const result = await rpc.call<GitCheckpoint | null>('checkpoint.get', {
      checkpointId: randomUUID(),
    })

    expect(result).toBeNull()
  })

  test('should throw error when restoring non-existent checkpoint', async () => {
    await expect(
      rpc.call('checkpoint.restore', {
        checkpointId: randomUUID(),
        repoPath: worktreePath,
      })
    ).rejects.toThrow(/not found/i)
  })
})

test.describe('Checkpoint UI Integration', () => {
  let rpc: RpcClient
  let testRepoPath: string
  let repoId: string
  let worktreeId: string
  let worktreePath: string

  test.beforeAll(async () => {
    rpc = new RpcClient(TEST_HTTP_RPC_PORT)
    await waitForRpc(rpc)
  })

  test.beforeEach(async () => {
    testRepoPath = createTestRepo()

    const repo = await rpc.call<Repo>('repo.create', {
      rootPath: testRepoPath,
      name: `checkpoint-ui-e2e-${Date.now()}`,
    })
    repoId = repo.id

    const branchName = `e2e-checkpoint-ui-${Date.now()}`
    const worktree = await rpc.call<Worktree>('worktree.create', {
      repoId,
      branch: branchName,
    })
    worktreeId = worktree.id
    worktreePath = worktree.worktreePath!
  })

  test.afterEach(async () => {
    if (worktreeId) {
      try {
        await rpc.call('worktree.delete', { id: worktreeId })
      } catch {
        // Ignore
      }
    }
    if (repoId) {
      try {
        await rpc.call('repo.delete', { id: repoId })
      } catch {
        // Ignore
      }
    }
    cleanupTestRepo(testRepoPath)
  })

  test('checkpoint workflow end-to-end', async ({ page }) => {
    // Create initial checkpoint
    fs.writeFileSync(path.join(worktreePath, 'initial.ts'), 'const initial = true;')
    const checkpoint1 = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'initial-state',
      repoPath: worktreePath,
    })

    // Simulate agent changes
    fs.writeFileSync(path.join(worktreePath, 'initial.ts'), 'const initial = false; // Modified')
    fs.writeFileSync(path.join(worktreePath, 'agent-added.ts'), 'export const agentCode = true;')

    const checkpoint2 = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'agent-changes',
      repoPath: worktreePath,
    })

    // Verify we can retrieve both checkpoints
    const checkpoints = await rpc.call<GitCheckpoint[]>('checkpoint.list', {
      worktreeId,
    })
    expect(checkpoints.length).toBeGreaterThanOrEqual(2)
    expect(checkpoints.some((c) => c.id === checkpoint1.id)).toBe(true)
    expect(checkpoints.some((c) => c.id === checkpoint2.id)).toBe(true)

    // Verify current state has agent changes
    expect(fs.readFileSync(path.join(worktreePath, 'initial.ts'), 'utf-8')).toContain('Modified')
    expect(fs.existsSync(path.join(worktreePath, 'agent-added.ts'))).toBe(true)

    // Restore to initial checkpoint (undo agent changes)
    await rpc.call('checkpoint.restore', {
      checkpointId: checkpoint1.id,
      repoPath: worktreePath,
    })

    // Verify changes are undone
    expect(fs.readFileSync(path.join(worktreePath, 'initial.ts'), 'utf-8')).toBe('const initial = true;')
    expect(fs.existsSync(path.join(worktreePath, 'agent-added.ts'))).toBe(false)

    // Navigate to app and verify it loads (basic smoke test)
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle rapid checkpoint creation', async () => {
    const checkpointIds: string[] = []

    // Create multiple checkpoints in quick succession
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(worktreePath, `rapid-${i}.ts`), `const step = ${i};`)

      const checkpoint = await rpc.call<GitCheckpoint>('checkpoint.save', {
        worktreeId,
        turnId: `rapid-turn-${i}`,
        repoPath: worktreePath,
      })

      checkpointIds.push(checkpoint.id)
    }

    // All checkpoints should be unique
    const uniqueIds = new Set(checkpointIds)
    expect(uniqueIds.size).toBe(5)

    // Should be able to restore to any checkpoint
    await rpc.call('checkpoint.restore', {
      checkpointId: checkpointIds[2], // Restore to middle checkpoint
      repoPath: worktreePath,
    })

    // Files after checkpoint 2 should not exist
    expect(fs.existsSync(path.join(worktreePath, 'rapid-0.ts'))).toBe(true)
    expect(fs.existsSync(path.join(worktreePath, 'rapid-1.ts'))).toBe(true)
    expect(fs.existsSync(path.join(worktreePath, 'rapid-2.ts'))).toBe(true)
    expect(fs.existsSync(path.join(worktreePath, 'rapid-3.ts'))).toBe(false)
    expect(fs.existsSync(path.join(worktreePath, 'rapid-4.ts'))).toBe(false)
  })

  test('should preserve git history when restoring checkpoint', async () => {
    // Create committed changes
    fs.writeFileSync(path.join(worktreePath, 'committed.ts'), 'const v1 = 1;')
    execSync('git add .', { cwd: worktreePath, stdio: 'pipe' })
    execSync('git commit -m "Version 1"', { cwd: worktreePath, stdio: 'pipe' })

    const checkpoint1 = await rpc.call<GitCheckpoint>('checkpoint.save', {
      worktreeId,
      turnId: 'v1',
      repoPath: worktreePath,
    })

    // More committed changes
    fs.writeFileSync(path.join(worktreePath, 'committed.ts'), 'const v2 = 2;')
    execSync('git add .', { cwd: worktreePath, stdio: 'pipe' })
    execSync('git commit -m "Version 2"', { cwd: worktreePath, stdio: 'pipe' })

    // Get current HEAD
    const headBefore = execSync('git rev-parse HEAD', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim()

    // Restore to v1
    await rpc.call('checkpoint.restore', {
      checkpointId: checkpoint1.id,
      repoPath: worktreePath,
    })

    // HEAD should be reset to checkpoint's HEAD
    const headAfter = execSync('git rev-parse HEAD', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim()

    expect(headAfter).toBe(checkpoint1.headOid)
    expect(headAfter).not.toBe(headBefore)
    expect(fs.readFileSync(path.join(worktreePath, 'committed.ts'), 'utf-8')).toBe('const v1 = 1;')
  })
})
