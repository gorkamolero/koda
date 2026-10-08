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

const mock = vi.hoisted(() => ({ root: null as any, listeners: new Map<string, (value: any) => void>(), transcripts: new Map<string, unknown[]>() }))
const claudeMessages = vi.fn(async () => [{ id: 'claude-delta', event: { type: 'text_delta', text: 'Claude is working' } }])
vi.mock('@liveblocks/node', () => ({ Liveblocks: class { async getOrCreateRoom() { return {} } } }))
vi.mock('@liveblocks/client', async (original) => {
  const actual = await original<typeof import('@liveblocks/client')>()
  return { ...actual, createClient: () => ({ enterRoom: (_room: string, options: any) => {
    mock.root = new actual.LiveObject(options.initialStorage)
    return { room: { subscribe: (name: string, callback: (value: any) => void) => { mock.listeners.set(name, callback) }, getStorage: async () => ({ root: mock.root }), broadcastEvent: vi.fn() }, leave: vi.fn() }
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
  it('publishes Claude transcripts from the Claude runtime alongside Codex', async () => {
    const claudeSession = randomUUID()
    getDb().insert(sessions).values({ id: claudeSession, worktreeId, agentType: 'claude', status: 'running' }).run()
    await manager.sync()
    expect(claudeMessages).toHaveBeenCalledWith({ sessionId: claudeSession })
    expect(JSON.parse(mock.root.get('transcripts').get(claudeSession))[0].event.text).toBe('Claude is working')
    expect(JSON.parse(mock.root.get('transcripts').get(sessionId))).toEqual(mock.transcripts.get(sessionId))
    expect(mock.root.get('sessions').get(claudeSession).get('agentType')).toBe('claude')
  })
  it('does not read an unsupported session through the Claude runtime', async () => {
    getDb().update(sessions).set({ agentType: 'unsupported' }).where(eq(sessions.id, sessionId)).run()
    await manager.sync()
    expect(claudeMessages).not.toHaveBeenCalled()
  })
  it('publishes multiple sessions and incremental transcript snapshots', async () => {
    expect(mock.root.get('sessions').get(sessionId).get('status')).toBe('idle')
    expect(JSON.parse(mock.root.get('transcripts').get(sessionId))).toEqual(mock.transcripts.get(sessionId))
    const second = randomUUID()
    getDb().insert(sessions).values({ id: second, worktreeId, agentType: 'codex', status: 'running' }).run()
    mock.transcripts.set(second, [{ id: 'delta', event: { type: 'text_delta', text: 'partial answer' } }])
    await manager.sync()
    expect(mock.root.get('sessions').size).toBe(2)
    expect(JSON.parse(mock.root.get('transcripts').get(second))[0].event.text).toBe('partial answer')
  })
  it('removes deleted sessions and their transcripts', async () => {
    getDb().delete(sessions).where(eq(sessions.id, sessionId)).run()
    await manager.sync()
    expect(mock.root.get('sessions').has(sessionId)).toBe(false)
    expect(mock.root.get('transcripts').has(sessionId)).toBe(false)
  })
  it('republishes the authoritative state after reconnect instead of trusting stale caches', async () => {
    mock.root.get('sessions').set(sessionId, new LiveObject({ id: sessionId, status: 'stale' }))
    mock.root.get('transcripts').set(sessionId, '[]')
    mock.listeners.get('status')?.('connected')
    await vi.waitFor(() => expect(mock.root.get('sessions').get(sessionId).get('status')).toBe('idle'))
    await vi.waitFor(() => expect(JSON.parse(mock.root.get('transcripts').get(sessionId)).length).toBe(1))
  })
})
