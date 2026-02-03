/**
 * E2E Test: Agent Session (Core Chat Feature)
 *
 * Tests Koda's core functionality - the Claude chat loop.
 * This is the most critical test: proves the product works.
 *
 * Test flow:
 * 1. Create a worktree (workspace context for the agent)
 * 2. Start a Claude session with a simple prompt
 * 3. Poll for agent response
 * 4. Verify assistant message is received
 * 5. Optionally: test multi-turn conversation
 *
 * Uses real RPC calls to the sidecar - no mocks.
 *
 * REQUIREMENTS:
 * - Running sidecar with HTTP RPC on port 3848
 * - ANTHROPIC_API_KEY environment variable set
 * - These tests make REAL API calls (slow, costs money)
 *
 * Run manually with: ANTHROPIC_API_KEY=sk-... npx playwright test tests/agent-session.spec.ts
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

// Check if we can run Claude API tests
const HAS_ANTHROPIC_KEY = !!process.env.ANTHROPIC_API_KEY
const SKIP_CLAUDE_TESTS = !HAS_ANTHROPIC_KEY || process.env.SKIP_CLAUDE_TESTS === 'true'

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
        timeout: 30000, // Longer timeout for AI responses
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

  /**
   * Check if sidecar is healthy
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.call<string>('ping')
      return result === 'pong'
    } catch {
      return false
    }
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

interface ClaudeStartResult {
  sessionId: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled'
}

interface ClaudeSessionInfo {
  id: string
  workspaceId: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled'
  contextTokenCount: number
  inputTokens: number
  outputTokens: number
  createdAt: string
  updatedAt: string
}

interface StoredMessage {
  index: number
  timestamp: number
  event: ClaudeStreamEvent
}

type ClaudeStreamEvent =
  | { type: 'system'; message: string; subtype?: string }
  | { type: 'assistant'; message: { type: string; text?: string; name?: string; input?: unknown; content?: Array<{ type: string; text?: string }> } }
  | { type: 'user'; message: { type: string; content: unknown } }
  | { type: 'text_delta'; text: string }
  | { type: 'result'; result: string; cost_usd?: number; session_id?: string }
  | { type: string; [key: string]: unknown }

interface Session {
  id: string
  worktreeId: string
  status: string
  model?: string
  agentType?: string
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a temporary git repository for testing
 */
function createTestRepo(): string {
  const repoPath = path.join(os.tmpdir(), `koda-e2e-session-${Date.now()}-${randomUUID().slice(0, 8)}`)
  fs.mkdirSync(repoPath, { recursive: true })

  execSync('git init', { cwd: repoPath, stdio: 'pipe' })
  execSync('git config user.email "e2e-test@koda.app"', { cwd: repoPath, stdio: 'pipe' })
  execSync('git config user.name "E2E Test"', { cwd: repoPath, stdio: 'pipe' })

  // Create initial commit with a simple file
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# Agent Session Test Repo\n\nTesting the Claude chat loop.\n')
  execSync('git add .', { cwd: repoPath, stdio: 'pipe' })
  execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'pipe' })

  return repoPath
}

/**
 * Clean up a test repository
 */
function cleanupTestRepo(repoPath: string): void {
  try {
    fs.rmSync(repoPath, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Wait for a condition with timeout
 */
async function waitFor<T>(
  fn: () => Promise<T | null>,
  options: { timeout?: number; interval?: number; description?: string } = {}
): Promise<T> {
  const { timeout = 60000, interval = 500, description = 'condition' } = options
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const result = await fn()
    if (result !== null) {
      return result
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Timeout waiting for ${description} after ${timeout}ms`)
}

/**
 * Extract text content from assistant messages
 */
function extractAssistantText(messages: StoredMessage[]): string {
  let text = ''

  for (const msg of messages) {
    if (msg.event.type === 'text_delta') {
      text += (msg.event as { text: string }).text || ''
    } else if (msg.event.type === 'assistant') {
      const assistantEvent = msg.event as { message?: { content?: Array<{ type: string; text?: string }> } }
      const content = assistantEvent.message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            text += block.text
          }
        }
      }
    }
  }

  return text
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Agent Session (Core Chat)', () => {
  let rpc: RpcClient
  let testRepoPath: string
  let registeredRepoId: string | null = null
  let createdWorktreeId: string | null = null
  let sidecarAvailable = false

  test.beforeAll(async () => {
    rpc = new RpcClient(TEST_HTTP_RPC_PORT)

    // Check if sidecar is ready (don't fail, just track availability)
    try {
      const healthy = await rpc.ping()
      sidecarAvailable = healthy
      if (!healthy) {
        console.log(`[Agent Session] Sidecar not responding on port ${TEST_HTTP_RPC_PORT}`)
      }
    } catch (e) {
      console.log(`[Agent Session] Sidecar not available: ${e}`)
      sidecarAvailable = false
    }
  })

  test.beforeEach(async () => {
    // Create fresh test repo for each test
    testRepoPath = createTestRepo()
    console.log(`[Agent Session Test] Created test repo at: ${testRepoPath}`)
  })

  test.afterEach(async () => {
    // Clean up worktree if created
    if (createdWorktreeId) {
      try {
        await rpc.call('worktree.delete', { worktreeId: createdWorktreeId })
      } catch {
        // Ignore cleanup errors
      }
      createdWorktreeId = null
    }

    // Clean up registered repo
    if (registeredRepoId) {
      try {
        await rpc.call('repo.delete', { id: registeredRepoId })
      } catch {
        // Ignore cleanup errors
      }
      registeredRepoId = null
    }

    // Clean up test repo
    if (testRepoPath) {
      cleanupTestRepo(testRepoPath)
    }
  })

  test('can start a Claude session and receive a response', async () => {
    test.skip(!sidecarAvailable, `Sidecar not available on port ${TEST_HTTP_RPC_PORT}`)
    test.skip(SKIP_CLAUDE_TESTS, 'Requires ANTHROPIC_API_KEY - makes real API calls')

    // =========================================================================
    // STEP 1: Register the test repo
    // =========================================================================
    console.log('[Step 1] Registering test repo...')
    const repo = await rpc.call<Repo>('repo.create', {
      rootPath: testRepoPath,
      name: 'agent-session-test-repo',
    })
    expect(repo.id).toBeTruthy()
    registeredRepoId = repo.id
    console.log(`[Step 1] Registered repo: ${repo.id}`)

    // =========================================================================
    // STEP 2: Create a worktree (provides workspace context)
    // =========================================================================
    console.log('[Step 2] Creating worktree...')
    const worktree = await rpc.call<Worktree>('worktree.create', {
      repoId: repo.id,
      branch: `e2e-agent-test-${Date.now()}`,
      fromBranch: 'main',
    })
    expect(worktree.id).toBeTruthy()
    expect(worktree.worktreePath).toBeTruthy()
    createdWorktreeId = worktree.id
    console.log(`[Step 2] Created worktree: ${worktree.id} at ${worktree.worktreePath}`)

    // =========================================================================
    // STEP 3: Start a Claude session with a simple prompt
    // =========================================================================
    console.log('[Step 3] Starting Claude session...')
    const startResult = await rpc.call<ClaudeStartResult>('claude.start', {
      workspaceId: worktree.id,
      prompt: 'Say exactly "Hello from Koda!" and nothing else.',
      options: {
        workingDirectory: worktree.worktreePath,
        // Use a fast model for testing
        model: 'claude-sonnet-4-20250514',
      },
    })

    expect(startResult.sessionId).toBeTruthy()
    expect(startResult.status).toBe('running')
    console.log(`[Step 3] Session started: ${startResult.sessionId}`)

    // =========================================================================
    // STEP 4: Poll for response messages
    // =========================================================================
    console.log('[Step 4] Polling for assistant response...')

    const assistantResponse = await waitFor(
      async () => {
        const messages = await rpc.call<StoredMessage[]>('claude.getMessages', {
          sessionId: startResult.sessionId,
          fromIndex: 0,
        })

        // Look for text content in messages
        const text = extractAssistantText(messages)
        if (text.length > 0) {
          console.log(`[Polling] Got response text (${text.length} chars): ${text.substring(0, 100)}...`)
          return text
        }

        // Also check session status
        const session = await rpc.call<ClaudeSessionInfo | null>('claude.getSession', {
          sessionId: startResult.sessionId,
        })
        console.log(`[Polling] Session status: ${session?.status}, messages: ${messages.length}`)

        return null
      },
      { timeout: 90000, interval: 1000, description: 'assistant response' }
    )

    // =========================================================================
    // STEP 5: Verify the response
    // =========================================================================
    console.log('[Step 5] Verifying response...')
    expect(assistantResponse).toBeTruthy()
    expect(assistantResponse.length).toBeGreaterThan(0)

    // The agent should have responded with something containing "Hello"
    const lowerResponse = assistantResponse.toLowerCase()
    expect(lowerResponse).toContain('hello')

    console.log(`[Step 5] ✅ Agent responded: "${assistantResponse.substring(0, 200)}..."`)

    // =========================================================================
    // STEP 6: Verify session completed
    // =========================================================================
    console.log('[Step 6] Checking final session status...')

    const finalSession = await waitFor(
      async () => {
        const session = await rpc.call<ClaudeSessionInfo | null>('claude.getSession', {
          sessionId: startResult.sessionId,
        })
        if (session && session.status !== 'running') {
          return session
        }
        return null
      },
      { timeout: 30000, interval: 500, description: 'session completion' }
    )

    expect(finalSession).toBeTruthy()
    expect(['completed', 'idle', 'paused']).toContain(finalSession!.status)
    console.log(`[Step 6] ✅ Session final status: ${finalSession!.status}`)
  })

  test.skip('session creation via session.create RPC', async () => {
    // SKIPPED: session.create RPC doesn't exist yet (only kimi.session.create)
    test.skip(!sidecarAvailable, `Sidecar not available on port ${TEST_HTTP_RPC_PORT}`)
    // =========================================================================
    // Test the session.create endpoint (creates session record in DB)
    // =========================================================================
    console.log('[Test] Testing session.create RPC...')

    // Register repo first
    const repo = await rpc.call<Repo>('repo.create', {
      rootPath: testRepoPath,
      name: 'session-create-test-repo',
    })
    registeredRepoId = repo.id

    // Create worktree
    const worktree = await rpc.call<Worktree>('worktree.create', {
      repoId: repo.id,
      branch: `e2e-session-create-${Date.now()}`,
      fromBranch: 'main',
    })
    createdWorktreeId = worktree.id

    // Create a session record
    const session = await rpc.call<Session>('session.create', {
      worktreeId: worktree.id,
      model: 'claude-sonnet-4-20250514',
      agentType: 'claude',
    })

    expect(session.id).toBeTruthy()
    expect(session.worktreeId).toBe(worktree.id)
    console.log(`[Test] ✅ Created session record: ${session.id}`)

    // List sessions for the worktree
    const sessions = await rpc.call<Session[]>('session.list', {
      worktreeId: worktree.id,
    })

    expect(sessions.length).toBeGreaterThanOrEqual(1)
    const foundSession = sessions.find((s) => s.id === session.id)
    expect(foundSession).toBeTruthy()
    console.log(`[Test] ✅ Session appears in list (${sessions.length} total)`)
  })

  test('can continue a conversation (multi-turn)', async () => {
    test.skip(!sidecarAvailable, `Sidecar not available on port ${TEST_HTTP_RPC_PORT}`)
    test.skip(SKIP_CLAUDE_TESTS, 'Requires ANTHROPIC_API_KEY - makes real API calls')
    // =========================================================================
    // Test multi-turn conversation capability
    // =========================================================================
    console.log('[Test] Testing multi-turn conversation...')

    // Setup: create repo and worktree
    const repo = await rpc.call<Repo>('repo.create', {
      rootPath: testRepoPath,
      name: 'multi-turn-test-repo',
    })
    registeredRepoId = repo.id

    const worktree = await rpc.call<Worktree>('worktree.create', {
      repoId: repo.id,
      branch: `e2e-multi-turn-${Date.now()}`,
      fromBranch: 'main',
    })
    createdWorktreeId = worktree.id

    // Start first turn
    console.log('[Turn 1] Starting session...')
    const startResult = await rpc.call<ClaudeStartResult>('claude.start', {
      workspaceId: worktree.id,
      prompt: 'Remember this number: 42. Just say "Got it." and nothing else.',
      options: {
        workingDirectory: worktree.worktreePath,
        model: 'claude-sonnet-4-20250514',
      },
    })

    // Wait for first response
    const firstResponse = await waitFor(
      async () => {
        const messages = await rpc.call<StoredMessage[]>('claude.getMessages', {
          sessionId: startResult.sessionId,
          fromIndex: 0,
        })
        const text = extractAssistantText(messages)
        return text.length > 0 ? text : null
      },
      { timeout: 60000, interval: 1000, description: 'first turn response' }
    )

    expect(firstResponse).toBeTruthy()
    console.log(`[Turn 1] ✅ Got first response: "${firstResponse.substring(0, 100)}..."`)

    // Wait for session to be ready for next turn
    await waitFor(
      async () => {
        const session = await rpc.call<ClaudeSessionInfo | null>('claude.getSession', {
          sessionId: startResult.sessionId,
        })
        return session && session.status !== 'running' ? session : null
      },
      { timeout: 30000, description: 'session ready for turn 2' }
    )

    // Second turn - test continuation
    console.log('[Turn 2] Continuing conversation...')
    const messageCountBefore = (await rpc.call<StoredMessage[]>('claude.getMessages', {
      sessionId: startResult.sessionId,
      fromIndex: 0,
    })).length

    // Use claude.continue for multi-turn
    await rpc.call<ClaudeStartResult>('claude.continue', {
      sessionId: startResult.sessionId,
      prompt: 'What number did I ask you to remember? Reply with just the number.',
    })

    // Wait for second response
    const secondResponse = await waitFor(
      async () => {
        const messages = await rpc.call<StoredMessage[]>('claude.getMessages', {
          sessionId: startResult.sessionId,
          fromIndex: messageCountBefore,
        })
        const text = extractAssistantText(messages)
        return text.length > 0 ? text : null
      },
      { timeout: 60000, interval: 1000, description: 'second turn response' }
    )

    expect(secondResponse).toBeTruthy()
    // Should remember 42
    expect(secondResponse).toContain('42')
    console.log(`[Turn 2] ✅ Got second response with remembered number: "${secondResponse}"`)
  })

  test('handles session cancellation', async () => {
    test.skip(!sidecarAvailable, `Sidecar not available on port ${TEST_HTTP_RPC_PORT}`)
    test.skip(SKIP_CLAUDE_TESTS, 'Requires ANTHROPIC_API_KEY - makes real API calls')
    // =========================================================================
    // Test that we can cancel a running session
    // =========================================================================
    console.log('[Test] Testing session cancellation...')

    // Setup
    const repo = await rpc.call<Repo>('repo.create', {
      rootPath: testRepoPath,
      name: 'cancel-test-repo',
    })
    registeredRepoId = repo.id

    const worktree = await rpc.call<Worktree>('worktree.create', {
      repoId: repo.id,
      branch: `e2e-cancel-${Date.now()}`,
      fromBranch: 'main',
    })
    createdWorktreeId = worktree.id

    // Start a session with a long-running prompt
    const startResult = await rpc.call<ClaudeStartResult>('claude.start', {
      workspaceId: worktree.id,
      prompt: 'Write a very long essay about the history of computing, starting from the abacus.',
      options: {
        workingDirectory: worktree.worktreePath,
        model: 'claude-sonnet-4-20250514',
      },
    })

    expect(startResult.sessionId).toBeTruthy()
    expect(startResult.status).toBe('running')

    // Wait a moment for the session to start processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Cancel the session
    console.log('[Test] Cancelling session...')
    const cancelResult = await rpc.call<{ success: boolean; sessionId: string }>('claude.cancel', {
      sessionId: startResult.sessionId,
    })

    expect(cancelResult.success).toBe(true)
    expect(cancelResult.sessionId).toBe(startResult.sessionId)

    // Verify session is cancelled
    const session = await rpc.call<ClaudeSessionInfo | null>('claude.getSession', {
      sessionId: startResult.sessionId,
    })

    expect(session).toBeTruthy()
    expect(session!.status).toBe('cancelled')
    console.log(`[Test] ✅ Session successfully cancelled`)
  })
})
