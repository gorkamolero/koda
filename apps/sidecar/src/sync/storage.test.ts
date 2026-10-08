import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { initDbWithMigrations, resetDb, getDb } from '../db/index.js'
import { repos, worktrees, sessions } from '../db/schema.js'
import { router } from '../rpc/router.js'
import { LiveObject } from '@liveblocks/client'

const mock = vi.hoisted(() => ({ root: null as any, room: null as any, listeners: new Map<string, (value: any) => void>(), transcripts: new Map<string, unknown[]>() }))
const claudeMessages = vi.fn(async () => [{ id: 'claude-delta', event: { type: 'text_delta', text: 'Claude is working' } }])
vi.mock('@liveblocks/node', () => ({ Liveblocks: class { async getOrCreateRoom() { return {} } } }))
vi.mock('@liveblocks/client', async (original) => {
  const actual = await original<typeof import('@liveblocks/client')>()
  return { ...actual, createClient: () => ({ enterRoom: (_room: string, options: any) => {
    mock.root = new actual.LiveObject(options.initialStorage)
    mock.room = { subscribe: (name: string, callback: (value: any) => void) => { mock.listeners.set(name, callback) }, getStorage: async () => ({ root: mock.root }), broadcastEvent: vi.fn() }
    return { room: mock.room, leave: vi.fn() }
  } }) }
})
let SyncManager: typeof import('./LiveblocksClient.js')['SyncManager']
let directory: string
let manager: InstanceType<typeof SyncManager>
let worktreeId: string
let sessionId: string
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'koda-collab-storage-'))
  vi.stubEnv('KODA_DATA_DIR', directory)
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', 'unit-test-only')
  ;({ SyncManager } = await import('./LiveblocksClient.js'))
  router.register('codex.getMessages', async ({ sessionId }: { sessionId: string }) => mock.transcripts.get(sessionId) ?? [])
  router.register('claude.getMessages', claudeMessages)
})
beforeEach(async () => {
  initDbWithMigrations(':memory:')
  worktreeId = randomUUID(); sessionId = randomUUID()
  const repoId = randomUUID()
  getDb().insert(repos).values({ id: repoId, rootPath: directory }).run()
  getDb().insert(worktrees).values({ id: worktreeId, repoId, collaborative: true }).run()
  getDb().insert(sessions).values({ id: sessionId, worktreeId, agentType: 'codex', status: 'idle' }).run()
  mock.transcripts.clear()
  claudeMessages.mockClear()
  mock.transcripts.set(sessionId, [{ id: 'user', event: { type: 'user', message: { content: 'hello' } } }])
  manager = new SyncManager(worktreeId)
  await manager.connect()
})
afterEach(() => { manager.close(); resetDb() })
afterAll(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })

describe('authoritative room storage synchronization', () => {
  it('publishes each session of the shared worktree without copying transcripts', async () => {
    const claudeSession = randomUUID()
    getDb().insert(sessions).values({ id: claudeSession, worktreeId, agentType: 'claude', status: 'running' }).run()
    await manager.sync()
    expect(mock.root.get('sessions').size).toBe(2)
    expect(mock.root.get('sessions').get(claudeSession).get('agentType')).toBe('claude')
    expect(mock.root.get('sessions').get(sessionId).get('status')).toBe('idle')
    expect(claudeMessages).not.toHaveBeenCalled()
    expect(mock.root.get('transcripts').size).toBe(0)
  })
  it('clears transcript copies left by earlier versions', async () => {
    mock.root.get('transcripts').set(sessionId, '[]')
    await manager.sync()
    expect(mock.root.get('transcripts').has(sessionId)).toBe(false)
  })
  it('removes deleted sessions', async () => {
    getDb().delete(sessions).where(eq(sessions.id, sessionId)).run()
    await manager.sync()
    expect(mock.root.get('sessions').has(sessionId)).toBe(false)
  })
  it('republishes the authoritative state after reconnect instead of trusting stale caches', async () => {
    mock.root.get('sessions').set(sessionId, new LiveObject({ id: sessionId, status: 'stale' }))
    mock.listeners.get('status')?.('connected')
    await vi.waitFor(() => expect(mock.root.get('sessions').get(sessionId).get('status')).toBe('idle'))
  })
})

describe('live events for guests', () => {
  it('coalesces streaming deltas per session and batches terminal output', async () => {
    vi.useFakeTimers()
    try {
      const broadcast = mock.room.broadcastEvent as ReturnType<typeof vi.fn>
      broadcast.mockClear()
      for (const text of ['a', 'b', 'c']) manager.forward('message', { sessionId, text })
      manager.forward('pty.data', { sessionId: 'pty-1', data: 'ls\r\n' })
      manager.forward('pty.data', { sessionId: 'pty-1', data: 'README.md\r\n' })
      manager.forward('sessionStatus', { sessionId, status: 'completed' })
      expect(broadcast).toHaveBeenCalledTimes(1)
      expect(broadcast).toHaveBeenLastCalledWith({ type: 'notify', method: 'sessionStatus', params: { sessionId, status: 'completed' } })
      await vi.advanceTimersByTimeAsync(250)
      expect(broadcast).toHaveBeenCalledWith({ type: 'notify', method: 'message', params: { sessionId, text: 'c' } })
      expect(broadcast).toHaveBeenCalledWith({ type: 'notify', method: 'pty.data', params: { sessionId: 'pty-1', data: 'ls\r\nREADME.md\r\n' } })
      expect(broadcast).toHaveBeenCalledTimes(3)
    } finally { vi.useRealTimers() }
  })
})
