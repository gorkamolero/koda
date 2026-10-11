/** Host-authoritative Liveblocks synchronization and signed workspace invitations. */
import { Liveblocks } from '@liveblocks/node'
import { createClient, LiveList, LiveMap, LiveObject, type JsonObject, type Room } from '@liveblocks/client'
import WebSocket from 'ws'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { repos, sessions, worktrees } from '../db/schema.js'
import { router } from '../rpc/router.js'
import { getNotificationEmitter } from '../rpc/notifications.js'
import { config } from '../config.js'
import { getPty } from '../handlers/pty.js'
import { authorizeRelay, signCapability, verifyCapability, parseCapability, signRelay, verifyRelay, type RelayCommand, type Capability, type RemoteRequest, type RemoteResponse, type RemoteNotification } from './capabilities.js'
import { CollaborationService, createDeviceIdentity, serviceOrigin, type DeviceIdentity } from './serviceClient.js'
import { executeRemoteRequest } from './remoteAccess.js'

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
export type RelayResult = { type: 'relay-result'; requestId: string; error: string | null }
export type SyncEvent = RelayEvent | RelayResult | RemoteRequest | RemoteResponse | RemoteNotification

// Choose the runtime from the host's persisted session, never guest input.
function sendMethod(agentType: string | null) {
  if (agentType === 'codex') return 'codex.send'
  if (agentType === 'claude') return 'claude.send'
  return undefined
}

const RESPONSE_CHUNK = 256_000
/** Splits a response below the Liveblocks message limit. */
export function responseChunks(requestId: string, outcome: { result?: unknown; error?: string }): RemoteResponse[] {
  const data = JSON.stringify(outcome)
  const total = Math.max(1, Math.ceil(data.length / RESPONSE_CHUNK))
  return Array.from({ length: total }, (_, index) => ({ type: 'rpc-response', requestId, index, total, data: data.slice(index * RESPONSE_CHUNK, (index + 1) * RESPONSE_CHUNK) }))
}

type StoredState = { device?: DeviceIdentity; signingKey?: string; settings?: { displayName: string; serviceUrl: string }; machineId: string; invitations: Record<string, string>; grants: Record<string, string>; receipts: Record<string, { error: string | null }> }
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
export function getMachineName(): string { return process.env.KODA_USER_NAME || getState().settings?.displayName || os.hostname() || getMachineId().slice(0, 6) }
function secret(): string {
  const key = process.env.LIVEBLOCKS_SECRET_KEY
  if (!key) throw new Error('Development collaboration requires LIVEBLOCKS_SECRET_KEY with KODA_COLLAB_MODE=development')
  return key
}
let api: Liveblocks | undefined
function getApi() { return api ??= new Liveblocks({ secret: secret() }) }
const DEFAULT_COLLAB_URL = 'https://koda-collaboration.gorka-molero.workers.dev'
export function getServiceUrl() { const value = process.env.KODA_COLLAB_URL || getState().settings?.serviceUrl || DEFAULT_COLLAB_URL; return value ? serviceOrigin(value) : '' }
function developmentMode() { return process.env.KODA_COLLAB_MODE === 'development' }
export function isCollaborationEnabled() { return developmentMode() ? Boolean(process.env.LIVEBLOCKS_SECRET_KEY) : Boolean(getServiceUrl()) }
function signingKey() {
  if (developmentMode()) return secret()
  const value = getState()
  if (!value.signingKey) { value.signingKey = randomBytes(32).toString('base64url'); saveState() }
  return value.signingKey
}
let service: CollaborationService | undefined
function getService() {
  const origin = getServiceUrl()
  if (!origin) throw new Error('Configure collaboration in Settings before sharing or joining')
  const value = getState()
  if (!value.device) { value.device = createDeviceIdentity(); saveState() }
  if (!service || service.origin !== origin) service = new CollaborationService(origin, value.device, getMachineName, getMachineId())
  return service
}
function guestCapability(invitation: string) {
  const capability = parseCapability(invitation)
  if (capability.serviceUrl) {
    if (developmentMode()) throw new Error('This invitation requires service mode; unset KODA_COLLAB_MODE=development and use its service URL')
    if (serviceOrigin(capability.serviceUrl) !== getServiceUrl()) throw new Error('This invitation uses a different collaboration service. Set its URL in Settings first.')
  } else if (!developmentMode()) throw new Error('This invitation requires development-key mode; ask the host for a service invitation')
  return capability
}
export function collaborationSettings() { return { displayName: getState().settings?.displayName || '', serviceUrl: getState().settings?.serviceUrl || '' } }
export function setCollaborationSettings(settings: { displayName: string; serviceUrl: string }) {
  if (settings.serviceUrl) settings.serviceUrl = serviceOrigin(settings.serviceUrl)
  getState().settings = settings; saveState(); return collaborationSettings()
}
export async function collaborationStatus() {
  const mode = developmentMode() ? (isCollaborationEnabled() ? 'development-key' : 'not-configured') : getServiceUrl() ? 'service' : 'not-configured'
  const reachable = mode === 'service' ? await getService().reachable() : mode === 'development-key'
  return { enabled: isCollaborationEnabled(), mode, reachable, machineId: getMachineId(), name: getMachineName(), serviceUrl: getServiceUrl(), settings: collaborationSettings() }
}
export async function deleteCollaborationRoom(roomId: string) {
  if (developmentMode()) await getApi().deleteRoom(roomId)
  else await getService().delete(roomId)
}

/** The host service writes storage; the UI and a guest's service only read it and broadcast. */
export async function token(roomId: string, role: 'host' | 'ui' | 'guest' = 'ui', name = getMachineName()) {
  if (!developmentMode()) return getService().token(roomId, role)
  const session = getApi().prepareSession(`${getMachineId()}:${role}`, {
    userInfo: { name, machineId: getMachineId(), color: '#22c55e' },
  })
  session.allow(roomId, role === 'host' ? session.FULL_ACCESS : session.READ_ACCESS)
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
    if (!invitation || guestCapability(invitation).roomId !== roomId) throw new Error('Join this shared workspace first')
  }
  // UI clients, including the owner's, never mutate the authoritative transcript.
  return token(roomId, 'ui', name)
}

export async function shareWorkspace(worktreeId: string, permission: 'view' | 'control') {
  if (!isCollaborationEnabled()) throw new Error('Configure collaboration in Settings before sharing')
  const db = getDb()
  const worktree = db.select().from(worktrees).where(eq(worktrees.id, worktreeId)).get()
  if (!worktree) throw new Error('Workspace not found')
  db.update(worktrees).set({ collaborative: true }).where(eq(worktrees.id, worktreeId)).run()
  try { await getSyncManager(worktreeId).connect() } catch (error) {
    if (!worktree.collaborative) db.update(worktrees).set({ collaborative: false }).where(eq(worktrees.id, worktreeId)).run()
    throw error
  }
  const repo = worktree.repoId ? db.select().from(repos).where(eq(repos.id, worktree.repoId)).get() : undefined
  const workspaceName = [repo?.name, worktree.branch].filter(Boolean).join(' / ') || 'Shared workspace'
  const capability: Capability = { version: 1, roomId: `workspace:${worktreeId}`, worktreeId, hostMachineId: getMachineId(), permission, nonce: randomUUID(), workspaceName: workspaceName.slice(0, 200), hostName: getMachineName().slice(0, 100) }
  if (!developmentMode()) {
    capability.serviceUrl = getServiceUrl()
    capability.joinCode = (await getService().code(capability.roomId)).code
  }
  const invitation = signCapability(capability, signingKey())
  // Sharing has one current invitation per workspace. Replacing it revokes old
  // control grants at the host, including requests saved before a downgrade.
  for (const [nonce, previous] of Object.entries(getState().grants)) {
    // These are locally stored grants; old modes may use a different signing key.
    // Incoming relay requests still require signature verification.
    if (parseCapability(previous).worktreeId === worktreeId) delete getState().grants[nonce]
  }
  getState().grants[capability.nonce] = invitation
  saveState()
  return { invitation, ...capability }
}

export async function joinWorkspace(invitation: string) {
  const capability = guestCapability(invitation.trim())
  if (capability.joinCode) {
    const redeemed = await getService().redeem(capability.joinCode)
    if (redeemed.roomId !== capability.roomId) throw new Error('Invitation workspace mismatch')
  }
  getState().invitations[capability.roomId] = invitation.trim()
  saveState()
  return capability
}
export function listSharedWorkspaces() {
  return Object.values(getState().invitations).map((invitation) => ({ ...guestCapability(invitation), invitation }))
}
export function getInvitation(roomId: string) {
  const invitation = getState().invitations[roomId]
  if (!invitation) throw new Error('Join this shared workspace first')
  return { invitation, ...guestCapability(invitation) }
}

/** The current invitation for a grant, or undefined once replaced. */
export function grantInvitation(grantId: string): string | undefined { return getState().grants[grantId] }

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
  private root: string | null | undefined
  /** Whether a terminal's directory belongs to this shared worktree. */
  contains(directory: string) {
    if (!this.room) return false
    if (this.root === undefined) {
      const worktreePath = getDb().select().from(worktrees).where(eq(worktrees.id, this.workspaceId)).get()?.worktreePath
      try { this.root = worktreePath ? fs.realpathSync(worktreePath) : null } catch { this.root = null }
    }
    if (!this.root) return false
    try {
      const target = fs.realpathSync(directory)
      return target === this.root || target.startsWith(this.root + path.sep)
    } catch { return false }
  }
  isEnabled() { return isCollaborationEnabled() }
  connect(): Promise<void> {
    if (!this.connecting) this.connecting = this.open().catch((error) => { this.connecting = undefined; throw error })
    return this.connecting
  }
  private async open() {
    const worktree = getDb().select().from(worktrees).where(eq(worktrees.id, this.workspaceId)).get()
    if (!worktree?.collaborative) throw new Error('Workspace sharing is disabled')
    if (developmentMode()) await getApi().getOrCreateRoom(this.roomId, { defaultAccesses: [] })
    else await getService().claim(this.roomId)
    const client = createClient({
      authEndpoint: () => token(this.roomId, 'host'),
      polyfills: { WebSocket: WebSocket as never, fetch },
      throttle: 50,
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
      else if (event.type === 'rpc-request' && event.roomId === this.roomId) void this.answer(event)
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
      const all = db.select().from(sessions).where(eq(sessions.worktreeId, this.workspaceId)).all()
      const sessionIds = new Set(all.map((session) => session.id))
      for (const id of root.get('sessions').keys()) {
        if (!sessionIds.has(id)) {
          root.get('sessions').delete(id)
          this.cache.delete(id)
        }
      }
      // Guests read transcripts from the host on demand; earlier versions copied them here.
      const transcripts = root.get('transcripts')
      if (transcripts) for (const id of [...transcripts.keys()]) transcripts.delete(id)
      for (const session of all) {
        const data: SessionData = { id: session.id, worktreeId: session.worktreeId, agentType: session.agentType, model: session.model, status: session.status, title: session.title, createdAt: session.createdAt, updatedAt: session.updatedAt, hostMachineId: getMachineId(), hostMachineName: getMachineName(), createdByUserId: null }
        const encoded = JSON.stringify(data)
        if (this.cache.get(session.id) !== encoded) {
          root.get('sessions').set(session.id, new LiveObject(data)); this.cache.set(session.id, encoded)
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
      const capability = verifyCapability(invitation, signingKey())
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
        const method = sendMethod(session.agentType)
        const send = method && router.getLocal(method)
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
  /** Answers a guest's read with the host's own handler, after the scope checks. */
  async answer(request: RemoteRequest) {
    const outcome = await executeRemoteRequest(request, {
      roomId: this.roomId, worktreeId: this.workspaceId, hostMachineId: getMachineId(), secret: signingKey(), grant: grantInvitation,
      claim: (id) => {
        const key = `${this.roomId}:control:${id}`
        if (getState().receipts[key]) return false
        getState().receipts[key] = { error: null }
        saveState()
        return true
      },
    })
    for (const chunk of responseChunks(request.requestId, outcome)) this.room?.broadcastEvent(chunk)
    return outcome
  }
  private pendingMessages = new Map<string, { params: JsonObject; timer: NodeJS.Timeout }>()
  private pendingOutput = new Map<string, { data: string; timer: NodeJS.Timeout }>()
  /** Live events for guests. Streaming deltas are coalesced; guests refetch the transcript anyway. */
  forward(method: string, params: JsonObject & { sessionId: string; data?: string }) {
    if (!this.room) return
    if (method === 'message') {
      const pending = this.pendingMessages.get(params.sessionId)
      if (pending) { pending.params = params; return }
      this.pendingMessages.set(params.sessionId, { params, timer: setTimeout(() => {
        const latest = this.pendingMessages.get(params.sessionId)
        this.pendingMessages.delete(params.sessionId)
        if (latest) this.room?.broadcastEvent({ type: 'notify', method, params: latest.params })
      }, 200) })
      return
    }
    if (method === 'pty.data') {
      const pending = this.pendingOutput.get(params.sessionId)
      if (pending) { pending.data += params.data ?? ''; return }
      this.pendingOutput.set(params.sessionId, { data: params.data ?? '', timer: setTimeout(() => {
        const latest = this.pendingOutput.get(params.sessionId)
        this.pendingOutput.delete(params.sessionId)
        if (latest) this.room?.broadcastEvent({ type: 'notify', method, params: { sessionId: params.sessionId, data: latest.data } })
      }, 50) })
      return
    }
    this.room.broadcastEvent({ type: 'notify', method, params })
  }
  close() {
    this.generation++; clearInterval(this.syncTimer); this.leave?.(); this.room = undefined; this.connecting = undefined; this.cache.clear()
    for (const pending of [...this.pendingMessages.values(), ...this.pendingOutput.values()]) clearTimeout(pending.timer)
    this.pendingMessages.clear(); this.pendingOutput.clear()
  }
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
  if (isCollaborationEnabled()) for (const worktree of getDb().select().from(worktrees).where(eq(worktrees.collaborative, true)).all()) {
    void getSyncManager(worktree.id).connect().catch((error) => console.error('[Sync]', error.message))
  }
  const sessionWorktrees = new Map<string, string | null>()
  getNotificationEmitter().subscribe((method, params) => {
    const payload = params as JsonObject & { sessionId?: string; data?: string }
    const sessionId = payload?.sessionId
    if (!sessionId) return
    if (method === 'message' || method === 'sessionStatus' || method === 'approvalChanged' || method === 'questionChanged') {
      if (!sessionWorktrees.has(sessionId) || method === 'sessionStatus') {
        sessionWorktrees.set(sessionId, getDb().select().from(sessions).where(eq(sessions.id, sessionId)).get()?.worktreeId ?? null)
      }
      const manager = managers.get(sessionWorktrees.get(sessionId) ?? '')
      if (!manager) return
      manager.forward(method, { ...payload, sessionId })
      if (method === 'sessionStatus') void manager.sync().catch((error) => console.error('[Sync]', error.message))
      return
    }
    if (method !== 'pty.data' && method !== 'pty.exit') return
    const pty = getPty({ sessionId })
    if (!pty) return
    for (const manager of managers.values()) {
      if (manager.contains(pty.workingDirectory)) manager.forward(method, { ...payload, sessionId })
    }
  })
}
