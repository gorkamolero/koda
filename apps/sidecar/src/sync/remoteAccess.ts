/** Host-side execution of a guest's requests, confined to the one shared worktree. */
import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { sessions, worktrees } from '../db/schema.js'
import { router } from '../rpc/router.js'
import { getPty } from '../handlers/pty.js'
import { getQuestionBroker } from '../agents/questionBroker.js'
import { verifyCapability, verifyRemoteRequest, type RemoteRequest } from './capabilities.js'

const BY_WORKTREE = new Set(['worktree.get', 'worktree.getDiff', 'session.list', 'checkpoint.list', 'github.getChecks', 'pty.list'])
const BY_SESSION = new Set(['codex.get', 'codex.getMessages', 'claude.get', 'claude.getSession', 'claude.getMessages', 'approval.list', 'question.list'])
const BY_PATH = new Set(['fs.readDirectory', 'fs.readFile'])
const BY_WORKSPACE = new Set(['activity.list', 'activity.unreadCount'])
// Model catalogs describe the host's installed CLIs and carry no workspace data.
const UNSCOPED = new Set(['codex.models', 'claude.models'])

/** What a control guest can do to the agent, as the host can: answer, approve, stop. */
export const REMOTE_CONTROL_METHODS = new Set(['question.respond', 'approval.respond', 'codex.cancel', 'claude.cancel'])
/** Methods a guest may read. Everything else stays with the host. */
export const REMOTE_READ_METHODS = new Set([...BY_WORKTREE, ...BY_SESSION, ...BY_PATH, ...BY_WORKSPACE, ...UNSCOPED, 'pty.snapshot'])
export const REMOTE_METHODS = new Set([...REMOTE_READ_METHODS, ...REMOTE_CONTROL_METHODS])

function realpath(target: string): string {
  try { return fs.realpathSync(target) } catch { throw new Error('Path is not available in the shared workspace') }
}
function contains(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep)
}

type Params = Record<string, unknown>
function param(params: Params, key: string): string {
  const value = params[key]
  if (typeof value !== 'string' || !value) throw new Error(`Missing ${key}`)
  return value
}

function sessionInWorktree(params: Params, worktreeId: string) {
  const session = getDb().select().from(sessions).where(eq(sessions.id, param(params, 'sessionId'))).get()
  if (session?.worktreeId !== worktreeId) throw new Error('Session is outside the shared workspace')
}

export function authorizeRemoteRequest(method: string, params: Params, worktree: { id: string; worktreePath: string | null }, permission: 'view' | 'control'): void {
  if (REMOTE_CONTROL_METHODS.has(method)) {
    if (permission !== 'control') throw new Error('View permission cannot answer or stop the agent')
    sessionInWorktree(params, worktree.id)
    if (method === 'question.respond' && params.decision === 'submit') {
      // Room broadcasts reach every member, so secret answers are given on the host.
      const pending = getQuestionBroker().list(param(params, 'sessionId')).find((request) => request.id === params.requestId)
      if (pending?.questions.some((question) => question.isSecret)) throw new Error('Answer secret questions on the host')
    }
    return
  }
  if (!REMOTE_READ_METHODS.has(method)) throw new Error(`Only the host can run ${method} in a shared workspace`)
  if (UNSCOPED.has(method)) return
  if (BY_WORKTREE.has(method)) {
    if (param(params, 'worktreeId') !== worktree.id) throw new Error('Request is outside the shared workspace')
    return
  }
  if (BY_WORKSPACE.has(method)) {
    if (param(params, 'workspaceId') !== worktree.id) throw new Error('Request is outside the shared workspace')
    return
  }
  if (BY_SESSION.has(method)) {
    sessionInWorktree(params, worktree.id)
    return
  }
  if (!worktree.worktreePath) throw new Error('Shared workspace has no files')
  const root = realpath(worktree.worktreePath)
  if (method === 'pty.snapshot') {
    const pty = getPty({ sessionId: param(params, 'sessionId') })
    if (!pty || !contains(root, realpath(pty.workingDirectory))) throw new Error('Terminal is outside the shared workspace')
    return
  }
  if (!contains(root, realpath(param(params, 'path')))) throw new Error('Path is outside the shared workspace')
}

export type RemoteContext = {
  roomId: string
  worktreeId: string
  hostMachineId: string
  secret: string
  /** The current invitation for a grant; replaced invitations resolve to undefined. */
  grant: (grantId: string) => string | undefined
  /** Claims a control request once; a replayed request is refused. */
  claim: (requestId: string) => boolean
}

export async function executeRemoteRequest(request: RemoteRequest, context: RemoteContext): Promise<{ result?: unknown; error?: string }> {
  try {
    const invitation = context.grant(request.grantId)
    if (!invitation) throw new Error('Unknown or revoked invitation')
    verifyRemoteRequest(request, invitation)
    const capability = verifyCapability(invitation, context.secret)
    if (request.roomId !== context.roomId || capability.roomId !== context.roomId ||
        capability.worktreeId !== context.worktreeId || capability.hostMachineId !== context.hostMachineId) {
      throw new Error('Invitation does not authorize this workspace')
    }
    const worktree = getDb().select().from(worktrees).where(eq(worktrees.id, context.worktreeId)).get()
    if (!worktree?.collaborative) throw new Error('Workspace sharing is disabled')
    const params = (JSON.parse(request.params || 'null') ?? {}) as Params
    authorizeRemoteRequest(request.method, params, worktree, capability.permission)
    if (REMOTE_CONTROL_METHODS.has(request.method) && !context.claim(`${request.grantId}:${request.requestId}`)) throw new Error('Request was already handled')
    const handler = router.getLocal(request.method)
    if (!handler) throw new Error(`Method not found: ${request.method}`)
    let result = await handler(params)
    if (request.method === 'pty.list' && Array.isArray(result) && worktree.worktreePath) {
      const root = realpath(worktree.worktreePath)
      result = result.filter((pty: { workingDirectory: string }) => {
        try { return contains(root, fs.realpathSync(pty.workingDirectory)) } catch { return false }
      })
    }
    return { result }
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : String(caught) }
  }
}
