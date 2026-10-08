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
import { ApprovalBroker } from '../agents/approvalBroker.js'
import { QuestionBroker } from '../agents/questionBroker.js'

let sync: typeof import('./LiveblocksClient.js')
let directory: string
let worktreeId: string
let sessionId: string
const dispatch = vi.fn(async () => ({ status: 'running' }))
const claudeDispatch = vi.fn(async () => ({ status: 'running' }))
const respond = vi.fn(), settings = vi.fn()
const questionList = vi.fn(), questionRespond = vi.fn()
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'koda-collab-receiver-'))
  vi.stubEnv('KODA_DATA_DIR', directory)
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', 'unit-test-only')
  sync = await import('./LiveblocksClient.js')
  router.register('codex.send', dispatch)
  router.register('claude.send', claudeDispatch)
  router.register('approval.respond', respond)
  router.register('claude.updateSettings', settings)
  router.register('codex.updateSettings', settings)
  router.register('question.list', questionList)
  router.register('question.respond', questionRespond)
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
  claudeDispatch.mockClear()
  respond.mockClear(); settings.mockClear()
  questionList.mockClear(); questionRespond.mockClear()
})
afterEach(() => { resetDb(); vi.restoreAllMocks() })
afterAll(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })

async function command(permission: 'control' | 'view') {
  const share = await sync.shareWorkspace(worktreeId, permission)
  return signRelay({ type: 'relay', roomId: share.roomId, grantId: share.nonce, requestId: randomUUID(), sessionId, content: 'Make the requested change' }, share.invitation)
}

describe('host relay receiver', () => {
  it.each(['claude', 'codex'])('does not let a %s collaborator read or answer host question forms', async agentType => {
    getDb().update(sessions).set({ agentType }).where(eq(sessions.id, sessionId)).run()
    const broker = new QuestionBroker({ notify: () => {} })
    const pending = broker.request({ sessionId, agentType: agentType as 'claude' | 'codex', questions: [{
      id: 'q1', header: 'Choice', question: 'Host-only question', options: [{ label: 'First' }, { label: 'Second' }],
      multiSelect: false, allowOther: true,
    }] })
    const [question] = broker.list()
    try {
      for (const method of ['question.list', 'question.respond']) {
        const request = await command('control')
        const malicious = { ...request, method, decision: 'submit', answers: { q1: { selected: ['First'] } },
          params: { sessionId, requestId: question.id, decision: 'submit', answers: { q1: { selected: ['First'] } } } }
        const response = await new sync.SyncManager(worktreeId).receive(malicious)
        expect(response.error).toBeNull()
        expect(JSON.stringify(response)).not.toContain('Host-only question')
        expect(agentType === 'claude' ? claudeDispatch : dispatch).toHaveBeenLastCalledWith({ sessionId, message: request.content, stream: true })
        expect(questionList).not.toHaveBeenCalled(); expect(questionRespond).not.toHaveBeenCalled()
        expect(broker.list()).toEqual([question])
      }
    } finally { broker.dispose(); await pending }
  })
  it.each(['claude', 'codex'])('does not let a %s collaborator change permission modes or answer host approvals', async agentType => {
    getDb().update(sessions).set({ agentType, permissionMode: 'default' }).where(eq(sessions.id, sessionId)).run()
    const broker = new ApprovalBroker({ notify: () => {} })
    const pending = broker.request({ sessionId, agentType: agentType as 'claude' | 'codex', toolName: 'Write', input: { file_path: '/outside/file.txt' } })
    const approval = broker.list()[0]
    try {
      const request = await command('control')
      // A holder of a real control grant can attach arbitrary fields to a broadcast.
      // The receiver must build the send arguments from its own narrow allowlist.
      const malicious = { ...request, method: 'approval.respond', permissionMode: 'bypassPermissions',
        approvalId: approval.id, decision: 'allow', params: { sessionId, permissionMode: 'bypassPermissions' } }
      expect((await new sync.SyncManager(worktreeId).receive(malicious)).error).toBeNull()
      expect(agentType === 'claude' ? claudeDispatch : dispatch).toHaveBeenCalledWith({ sessionId, message: request.content, stream: true })
      expect(respond).not.toHaveBeenCalled()
      expect(settings).not.toHaveBeenCalled()
      expect(getDb().select().from(sessions).where(eq(sessions.id, sessionId)).get()?.permissionMode).toBe('default')
      expect(broker.list()).toEqual([approval])
    } finally { broker.dispose(); await pending }
  })
  it('routes Claude control to the stored session runtime once and preserves the signed author', async () => {
    getDb().update(sessions).set({ agentType: 'claude' }).where(eq(sessions.id, sessionId)).run()
    const share = await sync.shareWorkspace(worktreeId, 'control')
    const request = signRelay({ type: 'relay', roomId: share.roomId, grantId: share.nonce, requestId: randomUUID(), sessionId, content: 'Continue with Claude', authorName: 'User B', authorMachineId: 'machine-b' }, share.invitation)
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBeNull()
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBeNull()
    expect(claudeDispatch).toHaveBeenCalledTimes(1)
    expect(claudeDispatch).toHaveBeenCalledWith({ sessionId, message: request.content, stream: true, authorName: 'User B', authorMachineId: 'machine-b' })
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('enforces view permission and revoked control on Claude sessions before either runtime can execute', async () => {
    getDb().update(sessions).set({ agentType: 'claude' }).where(eq(sessions.id, sessionId)).run()
    const controlRequest = await command('control')
    const viewRequest = await command('view')
    expect((await new sync.SyncManager(worktreeId).receive(viewRequest)).error).toBe('View permission cannot send messages')
    expect((await new sync.SyncManager(worktreeId).receive(controlRequest)).error).toBe('Unknown or revoked invitation')
    expect(claudeDispatch).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('does not fall back to Claude for an unsupported stored session type', async () => {
    getDb().update(sessions).set({ agentType: 'unsupported' }).where(eq(sessions.id, sessionId)).run()
    const request = await command('control')
    expect((await new sync.SyncManager(worktreeId).receive(request)).error).toBe('Remote control is unavailable for this session type')
    expect(claudeDispatch).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })
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
