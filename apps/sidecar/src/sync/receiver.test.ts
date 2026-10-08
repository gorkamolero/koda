import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { initDbWithMigrations, resetDb, getDb } from '../db/index.js'
import { repos, worktrees, sessions } from '../db/schema.js'
import { router } from '../rpc/router.js'
import { signRelay, type RelayCommand } from './capabilities.js'

let sync: typeof import('./LiveblocksClient.js')
let directory: string
let worktreeId: string
let sessionId: string
const dispatch = vi.fn(async () => ({ status: 'running' }))
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'koda-collab-receiver-'))
  vi.stubEnv('KODA_DATA_DIR', directory)
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', 'unit-test-only')
  sync = await import('./LiveblocksClient.js')
  router.register('codex.send', dispatch)
})
beforeEach(() => {
  initDbWithMigrations(':memory:')
  worktreeId = randomUUID(); sessionId = randomUUID()
  const repoId = randomUUID()
  getDb().insert(repos).values({ id: repoId, rootPath: directory }).run()
  getDb().insert(worktrees).values({ id: worktreeId, repoId, worktreePath: directory }).run()
  getDb().insert(sessions).values({ id: sessionId, worktreeId, agentType: 'codex', status: 'idle' }).run()
  vi.spyOn(sync.SyncManager.prototype, 'connect').mockResolvedValue()
  dispatch.mockClear()
})
afterEach(() => { resetDb(); vi.restoreAllMocks() })
afterAll(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })

async function command(permission: 'control' | 'view') {
  const share = await sync.shareWorkspace(worktreeId, permission)
  return signRelay({ type: 'relay', roomId: share.roomId, grantId: share.nonce, requestId: randomUUID(), sessionId, content: 'Make the requested change' }, share.invitation)
}

describe('host relay receiver', () => {
  it('dispatches control once even if the same event is replayed or the manager reconnects', async () => {
    const request = await command('control')
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBeNull()
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBeNull()
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ sessionId, message: request.content, stream: true })
  })
  it('rejects a correctly signed view request before dispatch', async () => {
    const request = await command('view')
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBe('View permission cannot send messages')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('rejects modified control traffic seen by a view-only room subscriber', async () => {
    const observed = await command('control')
    const forged: RelayCommand = { ...observed, requestId: randomUUID(), content: 'Run a different command' }
    expect((await new sync.SyncManager(worktreeId).receive(forged)).error).toBe('Invalid relay signature')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('rejects a valid invitation after the owner turns off sharing', async () => {
    const request = await command('control')
    getDb().update(worktrees).set({ collaborative: false }).where(eq(worktrees.id, worktreeId)).run()
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBe('Workspace sharing is disabled')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('rejects a session that belongs to a different local worktree', async () => {
    const share = await sync.shareWorkspace(worktreeId, 'control')
    const otherWorktree = randomUUID(); const otherSession = randomUUID()
    const repoId = getDb().select().from(repos).get()!.id
    getDb().insert(worktrees).values({ id: otherWorktree, repoId, collaborative: true }).run()
    getDb().insert(sessions).values({ id: otherSession, worktreeId: otherWorktree, agentType: 'codex' }).run()
    const request = signRelay({ type: 'relay', roomId: share.roomId, grantId: share.nonce, requestId: randomUUID(), sessionId: otherSession, content: 'Do work' }, share.invitation)
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBe('Invitation does not authorize this session')
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('invitation replacement and authors', () => {
  it('revokes earlier control grants when an owner issues a view invitation', async () => {
    const oldControl = await command('control')
    await sync.shareWorkspace(worktreeId, 'view')
    expect((await new sync.SyncManager(worktreeId).receive(oldControl)).error).toBe('Unknown or revoked invitation')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('preserves signed author identity through dispatch and rejects modified author names', async () => {
    const share = await sync.shareWorkspace(worktreeId, 'control')
    const request = signRelay({ type: 'relay', roomId: share.roomId, grantId: share.nonce, requestId: randomUUID(), sessionId, content: 'Please continue', authorName: 'User B', authorMachineId: 'machine-b' }, share.invitation)
    expect((await new sync.SyncManager(worktreeId).receive({ ...request, authorName: 'User A' })).error).toBe('Invalid relay signature')
    expect(dispatch).not.toHaveBeenCalled()
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBeNull()
    expect(dispatch).toHaveBeenCalledWith({ sessionId, message: 'Please continue', stream: true, authorName: 'User B', authorMachineId: 'machine-b' })
  })
})
