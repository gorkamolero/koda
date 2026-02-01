/**
 * Sidecar RPC Handler
 *
 * Handles incoming RPC requests FROM the sidecar TO the frontend.
 * This enables bidirectional communication for interactive tools like AskUserQuestion.
 *
 * Architecture:
 * 1. Sidecar sends JSON-RPC request over socket
 * 2. Rust backend receives and emits Tauri event 'sidecar-rpc-request'
 * 3. Frontend receives event, dispatches to handler
 * 4. Handler returns result
 * 5. Frontend sends response via Tauri command 'send_rpc_response'
 * 6. Rust sends response back to sidecar over socket
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

// ============================================================================
// Types
// ============================================================================

/**
 * Incoming RPC request from sidecar
 */
export interface SidecarRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: unknown
  id: string | number
}

/**
 * RPC response to send back
 */
export interface SidecarRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
  id: string | number
}

/**
 * Notification from sidecar (no response needed)
 */
export interface SidecarNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

// ============================================================================
// RPC Method Names
// ============================================================================

export const SIDECAR_RPC_METHODS = {
  ASK_USER_QUESTION: 'askUserQuestion',
  GET_DIFF: 'getDiff',
  DIFF_COMMENT: 'diffComment',
  GET_TERMINAL_OUTPUT: 'getTerminalOutput',
  EXIT_PLAN_MODE: 'exitPlanMode',
} as const

export const SIDECAR_NOTIFICATION_METHODS = {
  MESSAGE: 'message',
  QUERY_ERROR: 'queryError',
  ENTER_PLAN_MODE: 'enterPlanModeNotification',
  TOOL_USE: 'toolUse',
  TOOL_RESULT: 'toolResult',
  CONTEXT_USAGE: 'contextUsage',
  SESSION_STATUS: 'sessionStatus',
  PTY_DATA: 'pty.data',
  PTY_EXIT: 'pty.exit',
} as const

// ============================================================================
// Handler Types
// ============================================================================

export type RpcHandler<TParams = unknown, TResult = unknown> = (
  params: TParams
) => Promise<TResult> | TResult

export type NotificationHandler<TParams = unknown> = (params: TParams) => void

// ============================================================================
// Handler Registry
// ============================================================================

const rpcHandlers = new Map<string, RpcHandler>()
const notificationHandlers = new Map<string, NotificationHandler[]>()

/**
 * Register an RPC handler for a method
 */
export function registerRpcHandler<TParams = unknown, TResult = unknown>(
  method: string,
  handler: RpcHandler<TParams, TResult>
): void {
  rpcHandlers.set(method, handler as RpcHandler)
}

/**
 * Register a notification handler for a method
 */
export function registerNotificationHandler<TParams = unknown>(
  method: string,
  handler: NotificationHandler<TParams>
): () => void {
  const handlers = notificationHandlers.get(method) ?? []
  handlers.push(handler as NotificationHandler)
  notificationHandlers.set(method, handlers)

  // Return unsubscribe function
  return () => {
    const current = notificationHandlers.get(method) ?? []
    const index = current.indexOf(handler as NotificationHandler)
    if (index !== -1) {
      current.splice(index, 1)
    }
  }
}

/**
 * Unregister an RPC handler
 */
export function unregisterRpcHandler(method: string): void {
  rpcHandlers.delete(method)
}

// ============================================================================
// Message Processing
// ============================================================================

/**
 * Handle an incoming RPC request
 */
async function handleRpcRequest(request: SidecarRpcRequest): Promise<SidecarRpcResponse> {
  const handler = rpcHandlers.get(request.method)

  if (!handler) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: `Method not found: ${request.method}`,
      },
      id: request.id,
    }
  }

  try {
    const result = await handler(request.params)
    return {
      jsonrpc: '2.0',
      result,
      id: request.id,
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : String(err),
      },
      id: request.id,
    }
  }
}

/**
 * Handle an incoming notification
 */
function handleNotification(notification: SidecarNotification): void {
  const handlers = notificationHandlers.get(notification.method) ?? []
  for (const handler of handlers) {
    try {
      handler(notification.params)
    } catch (err) {
      console.error(`[SidecarRpc] Notification handler error (${notification.method}):`, err)
    }
  }
}

/**
 * Send RPC response back to sidecar via Tauri
 */
async function sendRpcResponse(response: SidecarRpcResponse): Promise<void> {
  await invoke('send_rpc_response', { response: JSON.stringify(response) })
}

// ============================================================================
// Event Listeners
// ============================================================================

let rpcRequestUnlisten: UnlistenFn | null = null
let notificationUnlisten: UnlistenFn | null = null

/**
 * Start listening for sidecar RPC requests and notifications
 */
export async function startSidecarRpcListener(): Promise<void> {
  // Listen for RPC requests (bidirectional - need response)
  rpcRequestUnlisten = await listen<SidecarRpcRequest>('sidecar-rpc-request', (event) => {
    console.log('[SidecarRpc] Received request:', event.payload.method)
    void handleRpcRequest(event.payload).then((response) => sendRpcResponse(response))
  })

  // Listen for notifications (one-way - no response needed)
  notificationUnlisten = await listen<SidecarNotification>('sidecar-notification', (event) => {
    handleNotification(event.payload)
  })

  console.log('[SidecarRpc] Listening for sidecar RPC requests and notifications')
}

/**
 * Stop listening for sidecar RPC
 */
export function stopSidecarRpcListener(): void {
  rpcRequestUnlisten?.()
  notificationUnlisten?.()
  rpcRequestUnlisten = null
  notificationUnlisten = null
}

// ============================================================================
// Typed Registration Helpers
// ============================================================================

/**
 * Question option from AskUserQuestion
 */
export interface AskUserQuestionParams {
  questions: Array<{
    question: string
    options: string[]
    multiSelect?: boolean
  }>
}

export interface AskUserQuestionResult {
  answers: Array<{
    question: string
    selectedOptions: string[]
    otherText?: string
  }>
  cancelled: boolean
}

/**
 * Register handler for AskUserQuestion
 */
export function onAskUserQuestion(
  handler: RpcHandler<AskUserQuestionParams, AskUserQuestionResult>
): void {
  registerRpcHandler(SIDECAR_RPC_METHODS.ASK_USER_QUESTION, handler)
}

/**
 * GetDiff parameters
 */
export interface GetDiffParams {
  workspaceId?: string | null
  stat?: boolean
  file?: string
}

export interface GetDiffResult {
  diff: string
  error?: string
}

/**
 * Register handler for GetDiff
 */
export function onGetDiff(handler: RpcHandler<GetDiffParams, GetDiffResult>): void {
  registerRpcHandler(SIDECAR_RPC_METHODS.GET_DIFF, handler)
}

/**
 * DiffComment parameters
 */
export interface DiffCommentParams {
  workspaceId?: string | null
  comments: Array<{
    file: string
    lineNumber: number
    body: string
  }>
}

export interface DiffCommentResult {
  success: boolean
  commentIds: string[]
  error?: string
}

/**
 * Register handler for DiffComment
 */
export function onDiffComment(handler: RpcHandler<DiffCommentParams, DiffCommentResult>): void {
  registerRpcHandler(SIDECAR_RPC_METHODS.DIFF_COMMENT, handler)
}

/**
 * GetTerminalOutput parameters
 */
export interface GetTerminalOutputParams {
  workspaceId?: string | null
  source?: string
  maxLines?: number
}

export interface GetTerminalOutputResult {
  output: string
  source: string
  error?: string
}

/**
 * Register handler for GetTerminalOutput
 */
export function onGetTerminalOutput(
  handler: RpcHandler<GetTerminalOutputParams, GetTerminalOutputResult>
): void {
  registerRpcHandler(SIDECAR_RPC_METHODS.GET_TERMINAL_OUTPUT, handler)
}

// ============================================================================
// Notification Type Helpers
// ============================================================================

/**
 * Message notification payload
 */
export interface MessageNotificationPayload {
  sessionId: string
  event: {
    type: string
    [key: string]: unknown
  }
  timestamp: number
}

/**
 * Subscribe to message notifications
 */
export function onMessageNotification(
  handler: NotificationHandler<MessageNotificationPayload>
): () => void {
  return registerNotificationHandler(SIDECAR_NOTIFICATION_METHODS.MESSAGE, handler)
}

/**
 * Session status notification payload
 */
export interface SessionStatusPayload {
  sessionId: string
  status: 'idle' | 'running' | 'paused' | 'compacting' | 'completed' | 'error' | 'cancelled'
  message?: string
}

/**
 * Subscribe to session status notifications
 */
export function onSessionStatus(handler: NotificationHandler<SessionStatusPayload>): () => void {
  return registerNotificationHandler(SIDECAR_NOTIFICATION_METHODS.SESSION_STATUS, handler)
}

/**
 * Context usage notification payload
 */
export interface ContextUsagePayload {
  sessionId: string
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  contextUsedPercent: number
}

/**
 * Subscribe to context usage notifications
 */
export function onContextUsage(handler: NotificationHandler<ContextUsagePayload>): () => void {
  return registerNotificationHandler(SIDECAR_NOTIFICATION_METHODS.CONTEXT_USAGE, handler)
}

// ============================================================================
// PTY Notification Helpers
// ============================================================================

/**
 * PTY data notification payload
 */
export interface PtyDataPayload {
  sessionId: string
  data: string
}

/**
 * Subscribe to PTY data notifications
 */
export function onPtyData(handler: NotificationHandler<PtyDataPayload>): () => void {
  return registerNotificationHandler(SIDECAR_NOTIFICATION_METHODS.PTY_DATA, handler)
}

/**
 * PTY exit notification payload
 */
export interface PtyExitPayload {
  sessionId: string
  exitCode: number
}

/**
 * Subscribe to PTY exit notifications
 */
export function onPtyExit(handler: NotificationHandler<PtyExitPayload>): () => void {
  return registerNotificationHandler(SIDECAR_NOTIFICATION_METHODS.PTY_EXIT, handler)
}
