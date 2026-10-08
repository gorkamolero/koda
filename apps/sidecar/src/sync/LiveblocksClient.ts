/** Host-authoritative Liveblocks synchronization and signed workspace invitations. */
import { Liveblocks } from '@liveblocks/node'
import { createClient, LiveList, LiveMap, LiveObject, type Room } from '@liveblocks/client'
import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { sessions, worktrees } from '../db/schema.js'
import { router } from '../rpc/router.js'
import { getNotificationEmitter } from '../rpc/notifications.js'
import { config } from '../config.js'
import { authorizeRelay, signCapability, verifyCapability, signRelay, verifyRelay, type RelayCommand, type Capability } from './capabilities.js'

export type SessionData = {
  id: string; worktreeId: string | null; agentType: string | null; model: string | null;
  status: string | null; hostMachineId: string; hostMachineName: string | null;
  title: string | null; createdAt: string | null; updatedAt: string | null; createdByUserId: string | null
}
export type MessageData = {
  id: string; role: string; content: string; sourceMachineId: string;
  authorUserId: string | null; authorName: string | null; timestamp: number; toolUseJson: string | null
}
type SharedStorage = {
  workspace: LiveObject<{ id: string; name: string; createdByMachineId: string; createdByName: string }>;
  sessions: LiveMap<string, LiveObject<SessionData>>;
  messages: LiveMap<string, LiveList<LiveObject<MessageData>>>;
  transcripts: LiveMap<string, string>;
  comments: LiveList<LiveObject<{ id: string }>>;
}
type RelayEvent = RelayCommand
type RelayResult = { type: 'relay-result'; requestId: string; error: string | null }
type SyncEvent = RelayEvent | RelayResult

// Choose the runtime from the host's persisted session, never guest input.
function agentMethods(agentType: string | null) {
  if (agentType === 'codex') return { messages: 'codex.getMessages', send: 'codex.send' }
  if (agentType === 'claude') return { messages: 'claude.getMessages', send: 'claude.send' }
  return undefined
}

type StoredState = { machineId: string; invitations: Record<string, string>; grants: Record<string, string>; receipts: Record<string, { error: string | null }> }
let state: StoredState | undefined
function stateFile() { return path.join(process.env.KODA_DATA_DIR || path.dirname(config.dbPath), 'collaboration.json') }
function getState(): StoredState {
  if (!state) {
    try { state = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as StoredState; state.grants ??= {} } catch {
      state = { machineId: randomUUID(), invitations: {}, grants: {}, receipts: {} }
      saveState(state)
    }
  }
  return state
}
function saveState(value = getState()) {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true })
  const temporary = `${stateFile()}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 })
  fs.renameSync(temporary, stateFile())
}
export function getMachineId(): string { return getState().machineId }
export function getMachineName(): string { return process.env.KODA_USER_NAME || os.hostname() || getMachineId().slice(0, 6) }
function secret(): string {
  const key = process.env.LIVEBLOCKS_SECRET_KEY
  if (!key) throw new Error('Collaboration requires LIVEBLOCKS_SECRET_KEY in the local env file')
  return key
}
let api: Liveblocks | undefined
function getApi() { return api ??= new Liveblocks({ secret: secret() }) }
export function isCollaborationEnabled() { return Boolean(process.env.LIVEBLOCKS_SECRET_KEY) }

async function token(roomId: string, host = false, name = getMachineName()) {
  const session = getApi().prepareSession(`${getMachineId()}${host ? ':host' : ':ui'}`, {
    userInfo: { name, machineId: getMachineId(), color: '#22c55e' },
  })
  session.allow(roomId, host ? session.FULL_ACCESS : session.READ_ACCESS)
  const response = await session.authorize()
  if (response.status !== 200) throw new Error(`Liveblocks authorization failed (${response.status})`)
  return JSON.parse(response.body) as { token: string }
}

export async function authorizeRoom(roomId: string, name?: string) {
  const id = roomId.replace(/^workspace:/, '')
  const worktree = getDb().select().from(worktrees).where(eq(worktrees.id, id)).get()
  if (worktree?.collaborative) await getSyncManager(id).connect()
  else {
    const invitation = getState().invitations[roomId]
    if (!invitation || verifyCapability(invitation, secret()).roomId !== roomId) throw new Error('Join this shared workspace first')
  }
  // UI clients, including the owner's, never mutate the authoritative transcript.
  return token(roomId, false, name)
}

export async function shareWorkspace(worktreeId: string, permission: 'view' | 'control') {
  secret()
  const db = getDb()
  const worktree = db.select().from(worktrees).where(eq(worktrees.id, worktreeId)).get()
  if (!worktree) throw new Error('Workspace not found')
  db.update(worktrees).set({ collaborative: true }).where(eq(worktrees.id, worktreeId)).run()
  try { await getSyncManager(worktreeId).connect() } catch (error) {
    if (!worktree.collaborative) db.update(worktrees).set({ collaborative: false }).where(eq(worktrees.id, worktreeId)).run()
    throw error
  }
  const capability: Capability = { version: 1, roomId: `workspace:${worktreeId}`, worktreeId, hostMachineId: getMachineId(), permission, nonce: randomUUID() }
  const invitation = signCapability(capability, secret())
  // Sharing has one current invitation per workspace. Replacing it revokes old
  // control grants at the host, including requests saved before a downgrade.
  for (const [nonce, previous] of Object.entries(getState().grants)) {
    if (verifyCapability(previous, secret()).worktreeId === worktreeId) delete getState().grants[nonce]
  }
  getState().grants[capability.nonce] = invitation
  saveState()
  return { invitation, ...capability }
}

export function joinWorkspace(invitation: string) {
  const capability = verifyCapability(invitation.trim(), secret())
  getState().invitations[capability.roomId] = invitation.trim()
  saveState()
  return capability
}
export function listSharedWorkspaces() {
  return Object.values(getState().invitations).map((invitation) => ({ ...verifyCapability(invitation, secret()), invitation }))
}
export function getInvitation(roomId: string) {
  const invitation = getState().invitations[roomId]
  if (!invitation) throw new Error('Join this shared workspace first')
  return { invitation, ...verifyCapability(invitation, secret()) }
}

export function prepareRelay(roomId: string, sessionId: string, content: string, requestId: string) {
  const { invitation, nonce } = getInvitation(roomId)
  return signRelay({ type: 'relay', roomId, grantId: nonce, requestId, sessionId, content, authorName: getMachineName(), authorMachineId: getMachineId() }, invitation)
}

export class SyncManager {
  readonly roomId: string
  private room: Room<any, SharedStorage, any, SyncEvent> | undefined
  private leave: (() => void) | undefined
  private connecting: Promise<void> | undefined
  private syncTimer: NodeJS.Timeout | undefined
  private syncing = false
  private syncAgain = false
  private cache = new Map<string, string>()
  private generation = 0

  constructor(readonly workspaceId: string) { this.roomId = `workspace:${workspaceId}` }
  isEnabled() { return isCollaborationEnabled() }
  connect(): Promise<void> {
    if (!this.connecting) this.connecting = this.open().catch((error) => { this.connecting = undefined; throw error })
    return this.connecting
  }
  private async open() {
    const worktree = getDb().select().from(worktrees).where(eq(worktrees.id, this.workspaceId)).get()
    if (!worktree?.collaborative) throw new Error('Workspace sharing is disabled')
    await getApi().getOrCreateRoom(this.roomId, { defaultAccesses: [] })
    const client = createClient({
      authEndpoint: () => token(this.roomId, true),
      polyfills: { WebSocket: WebSocket as never, fetch },
      throttle: 100,
    })
    const { room, leave } = client.enterRoom<any, SharedStorage, SyncEvent>(this.roomId, {
      initialPresence: { name: getMachineName(), machineId: getMachineId(), color: '#22c55e', service: true },
      initialStorage: {
        workspace: new LiveObject({ id: this.workspaceId, name: worktree.branch || 'Shared workspace', createdByMachineId: getMachineId(), createdByName: getMachineName() }),
        sessions: new LiveMap(), messages: new LiveMap(), transcripts: new LiveMap(), comments: new LiveList([]),
      },
    })
    this.room = room
    this.leave = leave
    room.subscribe('event', ({ event }) => {
      if (event.type === 'relay') void this.receive(event)
    })
    room.subscribe('status', (status) => {
      if (status === 'connected') {
        this.cache.clear()
        void this.sync().catch((error) => console.error('[Sync]', error.message))
      }
    })
    room.subscribe('error', (error) => console.error('[Sync] Liveblocks connection error:', error.message))
    // Time out visibly rather than leaving Share stuck forever on an invalid key/network.
    let timeout: NodeJS.Timeout | undefined
    try {
      await Promise.race([room.getStorage(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Timed out connecting to Liveblocks')), 20000) })])
    } catch (error) { leave(); this.room = undefined; throw error } finally { clearTimeout(timeout) }
    await this.sync()
    this.syncTimer = setInterval(() => { void this.sync().catch((error) => console.error('[Sync]', error.message)) }, 750)
    this.syncTimer.unref()
  }
  async sync() {
    if (!this.room) return
    if (this.syncing) { this.syncAgain = true; return }
    this.syncing = true
    const room = this.room
    const generation = this.generation
    try {
      const db = getDb()
      const worktree = db.select().from(worktrees).where(eq(worktrees.id, this.workspaceId)).get()
      if (!worktree?.collaborative) { this.close(); return }
      const { root } = await room.getStorage()
      if (this.room !== room || this.generation !== generation) return
      // Existing rooms from earlier versions may not have transcripts yet.
      if (!root.get('transcripts')) root.set('transcripts', new LiveMap())
      const all = db.select().from(sessions).where(eq(sessions.worktreeId, this.workspaceId)).all()
      const sessionIds = new Set(all.map((session) => session.id))
      for (const id of root.get('sessions').keys()) {
        if (!sessionIds.has(id)) {
          root.get('sessions').delete(id)
          root.get('transcripts').delete(id)
          root.get('messages').delete(id)
          this.cache.delete(id)
          this.cache.delete(`messages:${id}`)
        }
      }
      for (const session of all) {
        const data: SessionData = { id: session.id, worktreeId: session.worktreeId, agentType: session.agentType, model: session.model, status: session.status, title: session.title, createdAt: session.createdAt, updatedAt: session.updatedAt, hostMachineId: getMachineId(), hostMachineName: getMachineName(), createdByUserId: null }
        const encoded = JSON.stringify(data)
        if (this.cache.get(session.id) !== encoded) {
          root.get('sessions').set(session.id, new LiveObject(data)); this.cache.set(session.id, encoded)
        }
        const methods = agentMethods(session.agentType)
        const handler = methods && router.get(methods.messages)
        if (!handler) continue
        const transcript = JSON.stringify(await handler({ sessionId: session.id }))
        if (this.room !== room || this.generation !== generation) return
        if (this.cache.get(`messages:${session.id}`) !== transcript) {
          root.get('transcripts').set(session.id, transcript); this.cache.set(`messages:${session.id}`, transcript)
        }
      }
    } finally {
      this.syncing = false
      if (this.syncAgain) { this.syncAgain = false; void this.sync().catch((error) => console.error('[Sync]', error.message)) }
    }
  }
  async receive(event: RelayEvent): Promise<RelayResult> {
    let error: string | null = null
    let claimed = false
    const receiptKey = `${this.roomId}:${event.requestId}`
    try {
      const invitation = getState().grants[event.grantId]
      if (!invitation) throw new Error('Unknown or revoked invitation')
      verifyRelay(event, invitation)
      const capability = verifyCapability(invitation, secret())
      if (event.roomId !== this.roomId) throw new Error('Relay room mismatch')
      const db = getDb()
      const session = db.select().from(sessions).where(eq(sessions.id, event.sessionId)).get()
      if (!session?.worktreeId) throw new Error('Session not found')
      const worktree = db.select().from(worktrees).where(eq(worktrees.id, session.worktreeId)).get()
      authorizeRelay(capability, { roomId: this.roomId, hostMachineId: getMachineId(), worktreeId: session.worktreeId, collaborative: Boolean(worktree?.collaborative) })
      if (!event.content?.trim() || event.content.length > 32000) throw new Error('Message must contain 1–32000 characters')
      if (!/^[\w-]{1,100}$/.test(event.requestId)) throw new Error('Invalid relay request ID')
      const receipt = getState().receipts[receiptKey]
      if (receipt) error = receipt.error
      else {
        const methods = agentMethods(session.agentType)
        const send = methods && router.get(methods.send)
        if (!send) throw new Error('Remote control is unavailable for this session type')
        // Persist before dispatch so reconnects/replayed requests cannot execute twice.
        claimed = true
        getState().receipts[receiptKey] = { error: 'Previous relay interrupted; send a new message to retry' }
        saveState()
        await send({ sessionId: session.id, message: event.content, stream: true, ...(event.authorName ? { authorName: event.authorName } : {}), ...(event.authorMachineId ? { authorMachineId: event.authorMachineId } : {}) })
        getState().receipts[receiptKey] = { error: null }
        saveState()
        await this.sync()
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught)
      if (claimed) { getState().receipts[receiptKey] = { error }; saveState() }
    }
    const result: RelayResult = { type: 'relay-result', requestId: event.requestId, error }
    this.room?.broadcastEvent(result)
    return result
  }
  close() { this.generation++; clearInterval(this.syncTimer); this.leave?.(); this.room = undefined; this.connecting = undefined; this.cache.clear() }
  async syncSession(_session?: unknown) { await this.connect(); await this.sync() }
  async addMessage(_sessionId?: string, _message?: unknown) { await this.sync() }
  async updateSessionStatus(_sessionId?: string, _status?: string) { await this.sync() }
}
const managers = new Map<string, SyncManager>()
export function getSyncManager(workspaceId: string) {
  let manager = managers.get(workspaceId)
  if (!manager) { manager = new SyncManager(workspaceId); managers.set(workspaceId, manager) }
  return manager
}
export function initializeCollaboration() {
  if (!isCollaborationEnabled()) return
  for (const worktree of getDb().select().from(worktrees).where(eq(worktrees.collaborative, true)).all()) {
    void getSyncManager(worktree.id).connect().catch((error) => console.error('[Sync]', error.message))
  }
  getNotificationEmitter().subscribe((method, params) => {
    if (!['message', 'sessionStatus'].includes(method)) return
    const sessionId = (params as { sessionId?: string })?.sessionId
    if (!sessionId) return
    const session = getDb().select().from(sessions).where(eq(sessions.id, sessionId)).get()
    if (session?.worktreeId) void managers.get(session.worktreeId)?.sync().catch((error) => console.error('[Sync]', error.message))
  })
}
