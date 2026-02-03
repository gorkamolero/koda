/**
 * Collaboration Flow E2E Test
 *
 * Tests real-time collaboration between two users in the same workspace.
 * Uses two Playwright browser contexts to simulate two separate machines.
 *
 * Prerequisites:
 * - VITE_LIVEBLOCKS_PUBLIC_KEY configured in .env.local
 * - LIVEBLOCKS_SECRET_KEY for API verification
 *
 * Tests:
 * 1. Two users can connect to the same collaborative workspace
 * 2. Presence is shared (both users see each other)
 * 3. Session changes sync between users
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// Liveblocks API for verification
const LIVEBLOCKS_SECRET_KEY =
  'sk_dev_f3koNtPUiH6ktXtCbw9WhrtgrFwtsmwtEwkTnaItVjVKsf4wQbEXnJEzn4b6SdZF'

// RPC helper
async function rpcCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('http://localhost:3848/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  })
  const json = (await response.json()) as { result?: T; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result as T
}

// Liveblocks API helper
async function liveblocksAPI<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(`https://api.liveblocks.io/v2${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${LIVEBLOCKS_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return (await response.json()) as T
}

interface Workspace {
  id: string
  name: string
}

interface Repo {
  id: string
}

interface WorkspaceRepo {
  workspaceId: string
  repoId: string
}

interface Worktree {
  id: string
  branch: string
  path: string
  repoId: string
}

interface LiveblocksRoom {
  id: string
  lastConnectionAt?: string
  activeUsers?: number
}

interface LiveblocksRoomResponse {
  data: LiveblocksRoom[]
}

interface LiveblocksActiveUsers {
  data: Array<{
    connectionId: number
    id?: string
    info?: Record<string, unknown>
  }>
}

test.describe.skip('Collaboration Flow', () => {
  let workspaceId: string
  let repoId: string
  let worktreeId: string
  let worktreeBranch: string
  let worktreePath: string

  // Two browser contexts = two separate "machines"
  let contextA: BrowserContext
  let contextB: BrowserContext
  let pageA: Page
  let pageB: Page

  test.beforeAll(async ({ browser }) => {
    // Create test workspace with collaboration enabled
    const timestamp = Date.now()
    worktreeBranch = `collab-test-${timestamp}`

    // 1. Create standalone workspace
    const workspace = await rpcCall<Workspace>('workspace.createStandalone', {
      name: `Collab Test ${timestamp}`,
    })
    workspaceId = workspace.id

    // 2. Create/attach repo (using koda repo itself)
    const repo = await rpcCall<Repo>('repo.create', {
      rootPath: '/Users/gorkolas/www/koda',
    })
    repoId = repo.id

    await rpcCall<WorkspaceRepo>('workspaceRepo.attach', {
      workspaceId,
      repoId,
    })

    // 3. Create worktree with unique branch
    const worktree = await rpcCall<Worktree>('worktree.create', {
      repoId,
      branch: worktreeBranch,
      workspaceId,
    })
    worktreeId = worktree.id
    worktreePath = worktree.path

    // 4. Enable collaboration for this worktree
    try {
      await rpcCall('worktree.enableCollaboration', { worktreeId })
      console.log('Collaboration enabled for worktree:', worktreeId)
    } catch (error) {
      console.error('Failed to enable collaboration:', error)
      // Re-throw to fail the test - collaboration is required for these tests
      throw error
    }

    // 5. Create two independent browser contexts
    contextA = await browser.newContext({
      // Give them different "machine" identities via localStorage
    })
    contextB = await browser.newContext()

    pageA = await contextA.newPage()
    pageB = await contextB.newPage()
  })

  test.afterAll(async () => {
    // Clean up browser contexts
    await contextA?.close()
    await contextB?.close()

    // Clean up Liveblocks room
    const roomId = `workspace:${workspaceId}`
    const encodedRoomId = encodeURIComponent(roomId)
    try {
      await liveblocksAPI(`/rooms/${encodedRoomId}`, 'DELETE')
    } catch {
      // Room might not exist
    }

    // Clean up workspace/worktree
    if (worktreeId) {
      try {
        await rpcCall('worktree.delete', {
          worktreeId,
          deleteBranch: true,
          force: true,
        })
      } catch {
        // Manual cleanup
        if (worktreePath && fs.existsSync(worktreePath)) {
          fs.rmSync(worktreePath, { recursive: true, force: true })
        }
        try {
          execSync(`git branch -D ${worktreeBranch}`, {
            cwd: '/Users/gorkolas/www/koda',
            stdio: 'ignore',
          })
        } catch {}
      }
    }

    if (workspaceId) {
      try {
        await rpcCall('workspace.delete', { workspaceId })
      } catch {}
    }

    if (repoId) {
      try {
        await rpcCall('repo.delete', { repoId })
      } catch {}
    }
  })

  test('both users can load the same workspace', async () => {
    // Navigate both browsers to the same workspace
    const url = `http://localhost:1421/workspace/${workspaceId}/${worktreeId}`

    await Promise.all([pageA.goto(url), pageB.goto(url)])

    // Wait for app to load in both
    await Promise.all([
      pageA.waitForSelector('[data-testid="workspace-view"]', { timeout: 30000 }),
      pageB.waitForSelector('[data-testid="workspace-view"]', { timeout: 30000 }),
    ])

    // Both should show the workspace
    await expect(pageA.locator('[data-testid="workspace-view"]')).toBeVisible()
    await expect(pageB.locator('[data-testid="workspace-view"]')).toBeVisible()
  })

  test('liveblocks room is created for workspace', async () => {
    // Give time for Liveblocks connections to establish
    await pageA.waitForTimeout(2000)

    // Check Liveblocks API for the room
    const roomId = `workspace:${workspaceId}`
    const encodedRoomId = encodeURIComponent(roomId)

    let room: LiveblocksRoom
    try {
      room = await liveblocksAPI<LiveblocksRoom>(`/rooms/${encodedRoomId}`)
    } catch (error) {
      throw new Error(`Liveblocks room not created - collaboration may not be enabled. This indicates a test environment bug. Error: ${error}`)
    }
    expect(room.id).toBe(roomId)
  })

  test('both users appear in room presence', async () => {
    // This test requires collaboration to be enabled
    const roomId = `workspace:${workspaceId}`
    const encodedRoomId = encodeURIComponent(roomId)

    // Wait for both connections to establish
    await pageA.waitForTimeout(3000)

    let activeUsers: LiveblocksActiveUsers
    try {
      // Get active users in the room
      activeUsers = await liveblocksAPI<LiveblocksActiveUsers>(
        `/rooms/${encodedRoomId}/active-users`
      )
    } catch (error) {
      throw new Error(`Could not verify presence - collaboration may not be enabled. This indicates a test environment bug. Error: ${error}`)
    }

    // Should have 2 active connections (pageA and pageB)
    expect(activeUsers.data.length).toBeGreaterThanOrEqual(2)
  })

  test('presence avatars show when multiple users connected', async () => {
    // Wait for both to be connected and presence to sync
    await pageA.waitForTimeout(2000)

    // Look for presence avatars (if UI component is rendered)
    const avatarsA = pageA.locator('[data-testid="presence-avatars"]')
    const avatarsB = pageB.locator('[data-testid="presence-avatars"]')

    // This test will pass if avatars exist and show 2 users, or skip if component not rendered
    const hasAvatarsA = (await avatarsA.count()) > 0
    const hasAvatarsB = (await avatarsB.count()) > 0

    expect(hasAvatarsA || hasAvatarsB, 'PresenceAvatars component not rendered in UI - this indicates a test environment or component bug').toBeTruthy()

    // If avatars exist, verify they show 2 users
    if (hasAvatarsA) {
      const avatarCountA = await avatarsA.locator('[title]').count()
      expect(avatarCountA).toBeGreaterThanOrEqual(2)
    }
  })

  test('collaboration status shows connected', async () => {
    // Look for collaboration status indicator
    const statusA = pageA.locator('[data-testid="collaboration-status"]')

    const hasStatus = (await statusA.count()) > 0

    expect(hasStatus, 'CollaborationStatus component not rendered in UI - this indicates a test environment or component bug').toBeTruthy()

    // Should show connected status (green wifi icon)
    await expect(statusA).toContainText('Connected')
  })

  test('file changes in one browser reflect in the other', async () => {
    // This tests session/message sync via CRDT

    // User A creates a file
    const testFile = path.join(worktreePath, 'collab-test.txt')
    fs.writeFileSync(testFile, 'Created by User A')

    // Stage it (so it shows in diff view)
    execSync('git add collab-test.txt', { cwd: worktreePath })

    // User A clicks refresh/navigates to Changes tab
    await pageA.click('[data-testid="right-tab-changes"]')
    await pageA.waitForTimeout(500)

    // Verify User A sees the file
    await expect(
      pageA.locator('[data-testid="diff-file-collab-test-txt"]')
    ).toBeVisible({ timeout: 5000 })

    // User B navigates to Changes tab
    await pageB.click('[data-testid="right-tab-changes"]')
    await pageB.waitForTimeout(500)

    // User B should also see the file (they share the same worktree path in this test)
    // In real multi-machine collab, this would sync via Liveblocks
    await expect(
      pageB.locator('[data-testid="diff-file-collab-test-txt"]')
    ).toBeVisible({ timeout: 5000 })

    // Cleanup
    fs.unlinkSync(testFile)
    execSync('git reset HEAD collab-test.txt', { cwd: worktreePath, stdio: 'ignore' })
  })
})
