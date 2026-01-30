/**
 * JSON-RPC 2.0 types
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: unknown
  id: string | number
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  result?: T
  error?: JsonRpcError
  id: string | number
}

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

/**
 * Standard JSON-RPC 2.0 error codes
 */
export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const

/**
 * RPC method names - aligned with sidecar handlers
 */
export const RPC_METHODS = {
  // Health
  PING: 'ping',
  GET_STATUS: 'getStatus',
  // Workspaces
  WORKSPACE_LIST: 'workspace.list',
  WORKSPACE_CREATE: 'workspace.create',
  WORKSPACE_GET: 'workspace.get',
  // Claude agent
  CLAUDE_START: 'claude.start',
  CLAUDE_RESUME: 'claude.resume',
  CLAUDE_CANCEL: 'claude.cancel',
  CLAUDE_GET_SESSION: 'claude.getSession',
  CLAUDE_GET_MESSAGES: 'claude.getMessages',
} as const

/**
 * Sidecar status types
 */
export interface SidecarStatus {
  running: boolean
  pid?: number
  socket_path: string
}

/**
 * Health response from sidecar
 */
export interface HealthResponse {
  status: 'ok'
  timestamp: number
  version: string
}

/**
 * Workspace types - aligned with sidecar schema
 */
export interface Workspace {
  id: string
  repositoryId?: string
  ownerUserId?: string
  directoryName: string
  branch?: string
  workspaceType?: 'standard' | 'spec-driven' | 'ralph' | 'openprose'
  createdAt?: string
  updatedAt?: string
}

export interface CreateWorkspaceParams {
  directoryName: string
  repositoryId?: string
  ownerUserId?: string
  branch?: string
  workspaceType?: 'standard' | 'spec-driven' | 'ralph' | 'openprose'
}

export interface GetWorkspaceParams {
  id: string
}

export interface ListWorkspacesParams {
  limit?: number
  offset?: number
}

/**
 * Claude session types
 */
export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled'

export interface ClaudeStartParams {
  workspaceId: string
  prompt: string
  options?: {
    model?: string
    maxTokens?: number
    allowedTools?: string[]
    systemPrompt?: string
    workingDirectory?: string
    dangerouslySkipPermissions?: boolean
  }
}

export interface ClaudeStartResult {
  sessionId: string
  status: SessionStatus
}

export interface ClaudeSessionInfo {
  id: string
  workspaceId: string
  status: SessionStatus
  contextTokenCount: number
  inputTokens: number
  outputTokens: number
  createdAt: string
  updatedAt: string
}

export interface ClaudeStreamEvent {
  type: string
  message?: { type: string; text?: string; name?: string; input?: unknown }
  tool?: string
  input?: unknown
  output?: unknown
  result?: string
  [key: string]: unknown
}

export interface StoredMessage {
  index: number
  timestamp: number
  event: ClaudeStreamEvent
}

export interface ClaudeGetMessagesParams {
  sessionId: string
  fromIndex?: number
}

/**
 * Event types emitted by Tauri backend
 */
export type SidecarEvent = {
  type: 'sidecar-status'
  payload: SidecarStatus
}

export type RpcErrorEvent = {
  type: 'rpc-error'
  payload: {
    method: string
    error: JsonRpcError
  }
}
