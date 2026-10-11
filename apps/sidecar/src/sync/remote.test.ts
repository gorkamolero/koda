import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { initDbWithMigrations, resetDb, getDb } from '../db/index.js'
import { repos, worktrees, sessions } from '../db/schema.js'
import { router } from '../rpc/router.js'
import { getNotificationEmitter } from '../rpc/notifications.js'
import { readFile, readDirectory, ReadFileInputSchema, ReadDirectoryInputSchema } from '../handlers/fs.js'
import { signRemoteRequest } from './capabilities.js'
import { getQuestionBroker, questionList, questionRespond, QuestionListParamsSchema, QuestionRespondParamsSchema } from '../agents/questionBroker.js'

// One in-memory room shared by the host service and the guest service.
const bus = vi.hoisted(() => new Map<string, Set<(value: { event: any }) => void>>())
vi.mock('@liveblocks/node', () => ({ Liveblocks: class { async getOrCreateRoom() { return {} } } }))
vi.mock('@liveblocks/client', async (original) => {
  const actual = await original<typeof import('@liveblocks/client')>()
  return { ...actual, createClient: () => ({ enterRoom: (roomId: string, options: any) => {
    const root = new actual.LiveObject(options.initialStorage ?? {})
    const listeners = bus.get(roomId) ?? new Set()
    bus.set(roomId, listeners)
    let own: ((value: { event: any }) => void) | undefined
    const room = {
      subscribe: (name: string, callback: (value: any) => void) => {
        if (name === 'event') { own = callback; listeners.add(callback) }
        return () => listeners.delete(callback)
      },
      getStatus: () => 'connected',
      getStorage: async () => ({ root }),
      broadcastEvent: (event: unknown) => {
        for (const listener of [...listeners]) if (listener !== own) queueMicrotask(() => listener({ event }))
      },
    }
    return { room, leave: () => { if (own) listeners.delete(own) } }
  } }) }
})

let sync: typeof import('./LiveblocksClient.js')
let guest: typeof import('./guest.js')
let directory: string
let worktreePath: string
let worktreeId: string
let sessionId: string
const transcript = vi.fn(async (): Promise<unknown[]> => [{ id: 'user', event: { type: 'user', message: { content: 'hello' } } }])
const send = vi.fn(async () => ({ status: 'running' }))
const save = vi.fn(async () => ({ id: 'checkpoint' }))
const cancel = vi.fn(async () => ({ status: 'cancelled' }))

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'koda-collab-remote-'))
  vi.stubEnv('KODA_DATA_DIR', directory)
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', 'unit-test-only')
  vi.stubEnv('KODA_COLLAB_MODE', 'development')
  sync = await import('./LiveblocksClient.js')
  guest = await import('./guest.js')
  router.register('worktree.get', async ({ worktreeId }: { worktreeId: string }) => getDb().select().from(worktrees).where(eq(worktrees.id, worktreeId)).get())
  router.register('session.list', async ({ worktreeId }: { worktreeId: string }) => getDb().select().from(sessions).where(eq(sessions.worktreeId, worktreeId)).all())
  router.register('codex.getMessages', transcript)
  router.register('codex.send', send)
  router.register('checkpoint.save', save)
  router.register('fs.readFile', readFile, ReadFileInputSchema)
  router.register('fs.readDirectory', readDirectory, ReadDirectoryInputSchema)
  router.register('question.list', questionList, QuestionListParamsSchema)
  router.register('question.respond', questionRespond, QuestionRespondParamsSchema)
  router.register('codex.cancel', cancel)
  router.setInterceptor(guest.routeRemoteCall)
})
beforeEach(() => {
  initDbWithMigrations(':memory:')
  worktreeId = randomUUID(); sessionId = randomUUID()
  worktreePath = join(directory, `worktree-${worktreeId}`)
  mkdirSync(worktreePath)
  writeFileSync(join(worktreePath, 'notes.md'), 'shared notes')
  const repoId = randomUUID()
  getDb().insert(repos).values({ id: repoId, rootPath: directory, name: 'launch-site' }).run()
  getDb().insert(worktrees).values({ id: worktreeId, repoId, branch: 'launch-plan', worktreePath }).run()
  getDb().insert(sessions).values({ id: sessionId, worktreeId, agentType: 'codex', status: 'idle' }).run()
  transcript.mockClear(); send.mockClear(); save.mockClear(); cancel.mockClear()
})
afterEach(() => { resetDb() })
afterAll(() => { router.setInterceptor(undefined); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })

async function joinAs(permission: 'view' | 'control') {
  const share = await sync.shareWorkspace(worktreeId, permission)
  sync.joinWorkspace(share.invitation)
  return share
}
const call = (method: string, params: unknown) => router.get(method)!(params)

describe('guest reads answered by the host', () => {
  it('lists the invitation with its workspace and host labels', async () => {
    await joinAs('view')
    expect(sync.listSharedWorkspaces().find((share) => share.worktreeId === worktreeId)).toMatchObject({ workspaceName: 'launch-site / launch-plan', permission: 'view' })
  })
  it('renders the host worktree, sessions, transcript and files for a view guest', async () => {
    const share = await joinAs('view')
    const worktree = await call('worktree.get', { worktreeId }) as { worktreePath: string; remote: { permission: string; roomId: string } }
    expect(worktree.worktreePath).toBe(worktreePath)
    expect(worktree.remote).toMatchObject({ permission: 'view', roomId: share.roomId })
    expect(await call('session.list', { worktreeId })).toHaveLength(1)
    expect(await call('codex.getMessages', { sessionId })).toEqual(await transcript())
    expect(await call('fs.readFile', { path: join(worktreePath, 'notes.md') })).toBe('shared notes')
    expect(await call('fs.readDirectory', { path: worktreePath })).toEqual([{ name: 'notes.md', path: join(worktreePath, 'notes.md'), type: 'file' }])
  })
  it('reassembles a response larger than one Liveblocks message', async () => {
    await joinAs('view')
    const long = [{ id: 'output', event: { type: 'text', text: 'x'.repeat(900_000) } }]
    transcript.mockResolvedValueOnce(long)
    await call('session.list', { worktreeId })
    expect(await call('codex.getMessages', { sessionId })).toEqual(long)
  })
  it('lets only control guests send, through the relay, under their own name', async () => {
    await joinAs('view')
    await call('session.list', { worktreeId })
    await expect(call('codex.send', { sessionId, message: 'Ship it', stream: true })).rejects.toThrow('View permission cannot send messages')
    await joinAs('control')
    await call('codex.send', { sessionId, message: 'Ship it', stream: true })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ sessionId, message: 'Ship it', authorName: sync.getMachineName() }))
  })
  it('signs relays locally even for a session learned from the host', async () => {
    await joinAs('control')
    await call('session.list', { worktreeId })
    const roomId = `workspace:${worktreeId}`
    router.register('collaboration.prepareRelay', async ({ sessionId, content }: { sessionId: string; content: string }) => sync.prepareRelay(roomId, sessionId, content, randomUUID()))
    const relay = await call('collaboration.prepareRelay', { roomId, sessionId, content: 'Signed here' }) as { sessionId: string; signature: string }
    expect(relay).toMatchObject({ sessionId, content: 'Signed here' })
    expect(relay.signature).toBeTruthy()
  })
  it('keeps every other action with the host', async () => {
    await joinAs('control')
    await call('worktree.get', { worktreeId })
    await expect(call('checkpoint.save', { worktreeId, repoPath: worktreePath, turnId: 'manual' })).rejects.toThrow('can do that in this shared workspace')
    expect(save).not.toHaveBeenCalled()
  })
  it('replays host events on the guest so its UI refreshes live', async () => {
    await joinAs('view')
    await call('worktree.get', { worktreeId })
    const received = new Promise((resolve) => {
      const stop = getNotificationEmitter().subscribe((method, params) => { if (method === 'sessionStatus') { stop(); resolve(params) } })
    })
    sync.getSyncManager(worktreeId).forward('sessionStatus', { sessionId, status: 'running' })
    expect(await received).toEqual({ sessionId, status: 'running' })
  })
})

describe("the host's agent controls for collaborators", () => {
  const ask = (isSecret = false) => getQuestionBroker().request({ sessionId, agentType: 'codex', questions: [
    { id: 'tone', header: 'Tone', question: 'Which tone?', options: [{ label: 'Friendly' }, { label: 'Formal' }], multiSelect: false, allowOther: false, isSecret },
  ] })
  const pendingId = () => getQuestionBroker().list(sessionId)[0]!.id

  it("lets a control guest answer the agent's question through the host", async () => {
    await joinAs('control')
    await call('session.list', { worktreeId })
    const decision = ask()
    expect(await call('question.list', { sessionId })).toHaveLength(1)
    await call('question.respond', { sessionId, requestId: pendingId(), decision: 'submit', answers: { tone: { selected: ['Friendly'] } } })
    expect(await decision).toEqual({ decision: 'submit', answers: { tone: { selected: ['Friendly'] } } })
  })
  it('shows a view guest the question but keeps answering and stopping to control', async () => {
    await joinAs('view')
    await call('session.list', { worktreeId })
    const decision = ask()
    expect(await call('question.list', { sessionId })).toHaveLength(1)
    await expect(call('question.respond', { sessionId, requestId: pendingId(), decision: 'cancel' })).rejects.toThrow('View permission cannot answer or stop the agent')
    await expect(call('codex.cancel', { sessionId })).rejects.toThrow('View permission cannot answer or stop the agent')
    expect(cancel).not.toHaveBeenCalled()
    getQuestionBroker().cancelSession(sessionId)
    expect((await decision).decision).toBe('cancel')
  })
  it('lets a control guest stop the turn', async () => {
    await joinAs('control')
    await call('session.list', { worktreeId })
    await call('codex.cancel', { sessionId })
    expect(cancel).toHaveBeenCalledWith({ sessionId })
  })
  it('keeps secret answers on the host', async () => {
    await joinAs('control')
    await call('session.list', { worktreeId })
    const decision = ask(true)
    await expect(call('question.respond', { sessionId, requestId: pendingId(), decision: 'submit', answers: { tone: { selected: ['Formal'] } } })).rejects.toThrow('Answer secret questions on the host')
    getQuestionBroker().cancelSession(sessionId)
    await decision
  })
})

describe('host scope checks', () => {
  async function request(method: string, params: unknown, permission: 'view' | 'control' = 'view') {
    const share = await sync.shareWorkspace(worktreeId, permission)
    const signed = signRemoteRequest({ type: 'rpc-request', roomId: share.roomId, grantId: share.nonce, requestId: randomUUID(), method, params: JSON.stringify(params) }, share.invitation)
    return { share, signed }
  }
  const answer = (signed: Parameters<InstanceType<typeof sync.SyncManager>['answer']>[0]) => sync.getSyncManager(worktreeId).answer(signed)

  it('rejects sessions of other worktrees and paths outside the shared worktree', async () => {
    const other = randomUUID(); const otherSession = randomUUID()
    getDb().insert(worktrees).values({ id: other, repoId: getDb().select().from(repos).get()!.id, worktreePath: directory }).run()
    getDb().insert(sessions).values({ id: otherSession, worktreeId: other, agentType: 'codex' }).run()
    expect((await answer((await request('codex.getMessages', { sessionId: otherSession })).signed)).error).toBe('Session is outside the shared workspace')
    expect((await answer((await request('worktree.get', { worktreeId: other })).signed)).error).toBe('Request is outside the shared workspace')
    expect((await answer((await request('fs.readFile', { path: join(worktreePath, '..', 'collaboration.json') })).signed)).error).toBe('Path is outside the shared workspace')
    symlinkSync(directory, join(worktreePath, 'escape'))
    expect((await answer((await request('fs.readDirectory', { path: join(worktreePath, 'escape') })).signed)).error).toBe('Path is outside the shared workspace')
    expect(transcript).not.toHaveBeenCalled()
  })
  it('never executes writes, even for a control invitation', async () => {
    for (const method of ['codex.send', 'checkpoint.save', 'pty.create', 'pty.write', 'worktree.delete', 'codex.updateSettings']) {
      expect((await answer((await request(method, { worktreeId, sessionId }, 'control')).signed)).error).toBe(`Only the host can run ${method} in a shared workspace`)
    }
    expect(send).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
  it('refuses a view invitation and a replayed control request at the host', async () => {
    expect((await answer((await request('codex.cancel', { sessionId }, 'view')).signed)).error).toBe('View permission cannot answer or stop the agent')
    const { signed } = await request('codex.cancel', { sessionId }, 'control')
    expect((await answer(signed)).error).toBeUndefined()
    expect((await answer(signed)).error).toBe('Request was already handled')
    expect(cancel).toHaveBeenCalledTimes(1)
  })
  it('rejects forged, replaced and disabled-sharing requests', async () => {
    const { signed } = await request('codex.getMessages', { sessionId })
    expect((await answer({ ...signed, method: 'codex.get' })).error).toBe('Invalid request signature')
    expect((await answer({ ...signed, params: JSON.stringify({ sessionId: randomUUID() }) })).error).toBe('Invalid request signature')
    await sync.shareWorkspace(worktreeId, 'view')
    expect((await answer(signed)).error).toBe('Unknown or revoked invitation')
    const current = (await request('codex.getMessages', { sessionId })).signed
    getDb().update(worktrees).set({ collaborative: false }).where(eq(worktrees.id, worktreeId)).run()
    expect((await answer(current)).error).toBe('Workspace sharing is disabled')
    expect(transcript).not.toHaveBeenCalled()
  })
})
