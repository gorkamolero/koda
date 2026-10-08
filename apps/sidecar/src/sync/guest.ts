/**
 * A collaborator's side of a shared workspace. The collaborator's UI makes the
 * same calls it makes for local work; calls about the shared worktree, its
 * sessions, terminals or files are answered by the host through Liveblocks.
 */
import { createClient, type Room } from '@liveblocks/client'
import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { getNotificationEmitter } from '../rpc/notifications.js'
import { signRemoteRequest } from './capabilities.js'
import { getInvitation, getMachineId, getMachineName, isCollaborationEnabled, listSharedWorkspaces, prepareRelay, token, type SyncEvent } from './LiveblocksClient.js'
import { REMOTE_CONTROL_METHODS, REMOTE_METHODS } from './remoteAccess.js'

const TIMEOUT = 20_000
const FORWARDED = new Set(['message', 'sessionStatus', 'approvalChanged', 'questionChanged', 'pty.data', 'pty.exit'])

type Outcome = { result?: unknown; error?: string }
type Waiter<T> = { resolve: (value: T) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }

class GuestRoom {
  private connecting: Promise<Room<any, any, any, SyncEvent>> | undefined
  private responses = new Map<string, Waiter<Outcome> & { chunks: string[]; received: number }>()
  private relays = new Map<string, Waiter<void>>()

  constructor(readonly roomId: string) {}

  private connect() {
    if (!this.connecting) this.connecting = this.open().catch((error) => { this.connecting = undefined; throw error })
    return this.connecting
  }

  private async open() {
    getInvitation(this.roomId)
    const client = createClient({
      authEndpoint: () => token(this.roomId, 'guest'),
      polyfills: { WebSocket: WebSocket as never, fetch },
      throttle: 50,
    })
    const { room, leave } = client.enterRoom<any, any, SyncEvent>(this.roomId, {
      initialPresence: { name: getMachineName(), machineId: getMachineId(), color: '#22c55e', service: true },
    })
    room.subscribe('event', ({ event }) => this.receive(event))
    try {
      await new Promise<void>((resolve, reject) => {
        if (room.getStatus() === 'connected') return resolve()
        let stop = () => {}
        const timer = setTimeout(() => { stop(); reject(new Error('Timed out connecting to the shared workspace')) }, TIMEOUT)
        stop = room.subscribe('status', (status) => {
          if (status === 'connected') { clearTimeout(timer); stop(); resolve() }
        })
      })
    } catch (error) { leave(); throw error }
    return room
  }

  private receive(event: SyncEvent) {
    if (event.type === 'rpc-response') {
      const waiter = this.responses.get(event.requestId)
      if (!waiter || waiter.chunks[event.index] !== undefined) return
      waiter.chunks[event.index] = event.data
      if (++waiter.received < event.total) return
      this.responses.delete(event.requestId)
      clearTimeout(waiter.timer)
      try { waiter.resolve(JSON.parse(waiter.chunks.join('')) as Outcome) } catch { waiter.reject(new Error('Malformed response from the host')) }
    } else if (event.type === 'relay-result') {
      const waiter = this.relays.get(event.requestId)
      if (!waiter) return
      this.relays.delete(event.requestId)
      clearTimeout(waiter.timer)
      if (event.error) waiter.reject(new Error(event.error))
      else waiter.resolve()
    } else if (event.type === 'notify' && FORWARDED.has(event.method)) {
      getNotificationEmitter().emit(event.method, event.params)
    }
  }

  private wait<T>(waiters: Map<string, Waiter<T>>, id: string, extra: object = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(id)
        reject(new Error('The host did not answer. Check that the host is online, then retry.'))
      }, TIMEOUT)
      waiters.set(id, { resolve, reject, timer, ...extra })
    })
  }

  async call(method: string, params: unknown): Promise<unknown> {
    const room = await this.connect()
    const { invitation, nonce } = getInvitation(this.roomId)
    const request = signRemoteRequest({ type: 'rpc-request', roomId: this.roomId, grantId: nonce, requestId: randomUUID(), method, params: JSON.stringify(params ?? null) }, invitation)
    const response = this.wait(this.responses as Map<string, Waiter<Outcome>>, request.requestId, { chunks: [], received: 0 })
    room.broadcastEvent(request)
    const outcome = await response
    if (outcome.error) throw new Error(outcome.error)
    return outcome.result
  }

  /** Messages use the signed relay, which the host executes at most once. */
  async send(sessionId: string, content: string): Promise<void> {
    const room = await this.connect()
    const command = prepareRelay(this.roomId, sessionId, content, randomUUID())
    const acknowledged = this.wait(this.relays, command.requestId)
    room.broadcastEvent(command)
    await acknowledged
  }
}

const rooms = new Map<string, GuestRoom>()
/** Agent sessions and terminals learned from the host's answers. */
const remoteIds = new Map<string, string>()
const remoteRoots = new Map<string, string>()

function roomFor(method: string, params: unknown, shares: ReturnType<typeof listSharedWorkspaces>): string | undefined {
  if (!params || typeof params !== 'object') return undefined
  const input = params as Record<string, unknown>
  const worktreeId = input.worktreeId ?? (method.startsWith('activity.') ? input.workspaceId : undefined)
  if (typeof worktreeId === 'string') {
    const share = shares.find((item) => item.worktreeId === worktreeId)
    if (share) return share.roomId
  }
  if (typeof input.sessionId === 'string' && remoteIds.has(input.sessionId)) return remoteIds.get(input.sessionId)
  for (const key of ['path', 'workingDirectory', 'repoPath']) {
    const value = input[key]
    if (typeof value !== 'string') continue
    for (const [root, roomId] of remoteRoots) {
      if (value === root || value.startsWith(root + path.sep)) return roomId
    }
  }
  return undefined
}

function learn(method: string, result: unknown, roomId: string) {
  if (method === 'worktree.get') {
    const worktreePath = (result as { worktreePath?: string | null })?.worktreePath
    if (worktreePath) remoteRoots.set(worktreePath, roomId)
  } else if ((method === 'session.list' || method === 'pty.list') && Array.isArray(result)) {
    for (const item of result as Array<{ id?: string; sessionId?: string }>) {
      const id = method === 'pty.list' ? item.sessionId : item.id
      if (id) remoteIds.set(id, roomId)
    }
  }
}

export async function routeRemoteCall(method: string, params: unknown): Promise<{ result: unknown } | undefined> {
  // Joining, signing and authorizing are this machine's own business.
  if (!isCollaborationEnabled() || method.startsWith('collaboration.')) return undefined
  const shares = listSharedWorkspaces()
  const roomId = roomFor(method, params, shares)
  const share = roomId && shares.find((item) => item.roomId === roomId)
  if (!roomId || !share) return undefined
  let room = rooms.get(roomId)
  if (!room) { room = new GuestRoom(roomId); rooms.set(roomId, room) }
  const host = share.hostName || 'the host'
  if (method === 'codex.send' || method === 'claude.send') {
    if (share.permission !== 'control') throw new Error('View permission cannot send messages')
    const { sessionId, message } = params as { sessionId: string; message: string }
    await room.send(sessionId, message)
    return { result: { status: 'running' } }
  }
  if (!REMOTE_METHODS.has(method)) throw new Error(`Only ${host} can do that in this shared workspace`)
  if (REMOTE_CONTROL_METHODS.has(method) && share.permission !== 'control') throw new Error('View permission cannot answer or stop the agent')
  const result = await room.call(method, params)
  learn(method, result, roomId)
  if (method === 'worktree.get' && result && typeof result === 'object') {
    return { result: { ...result, remote: { roomId, permission: share.permission, hostName: share.hostName ?? null, hostMachineId: share.hostMachineId } } }
  }
  return { result }
}
