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
  // Repos
  REPO_CREATE: 'repo.create',
  REPO_GET: 'repo.get',
  REPO_LIST: 'repo.list',
  REPO_DELETE: 'repo.delete',
  // Workspaces
  WORKSPACE_LIST: 'workspace.list',
  WORKSPACE_CREATE: 'workspace.create',
  WORKSPACE_GET: 'workspace.get',
  // Worktrees
  WORKTREE_CREATE: 'worktree.create',
  WORKTREE_DELETE: 'worktree.delete',
  WORKTREE_GET: 'worktree.get',
  WORKTREE_LIST: 'worktree.list',
  // Claude agent
  CLAUDE_START: 'claude.start',
  CLAUDE_RESUME: 'claude.resume',
  CLAUDE_CANCEL: 'claude.cancel',
  CLAUDE_GET_SESSION: 'claude.getSession',
  CLAUDE_GET_MESSAGES: 'claude.getMessages',
  // Checkpoints
  CHECKPOINT_SAVE: 'checkpoint.save',
  CHECKPOINT_RESTORE: 'checkpoint.restore',
  CHECKPOINT_DIFF: 'checkpoint.diff',
  CHECKPOINT_GET: 'checkpoint.get',
  CHECKPOINT_LIST: 'checkpoint.list',
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
 * Repo types - aligned with sidecar schema
 */
export interface Repo {
  id: string
  rootPath: string
  name?: string
  remoteUrl?: string
  defaultBranch?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateRepoParams {
  rootPath: string
  name?: string
  remoteUrl?: string
  defaultBranch?: string
}

export interface CreateWorktreeParams {
  repoId: string
  branch: string
  fromBranch?: string
}

export interface WorktreeResult {
  id: string
  repositoryId?: string
  directoryName: string
  branch?: string
  workspaceType?: string
  worktreePath?: string
  setupError?: string
}

/**
 * Checkpoint types
 */
export interface CheckpointDiff {
  files: FileDiff[]
  summary: DiffSummary
}

export interface FileDiff {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  diff?: string
  additions?: number
  deletions?: number
}

export interface DiffSummary {
  filesChanged: number
  additions: number
  deletions: number
}

/**
 * Workspace status types (Conductor-style)
 */
export type WorkspaceStatus = 'in-progress' | 'done' | 'blocked' | 'needs-review'
export type WorkspaceState = 'active' | 'archived'
export type WorkspaceType = 'standard' | 'spec-driven' | 'ralph' | 'openprose'

/**
 * Workspace types - aligned with sidecar schema (with Conductor-style fields)
 */
export interface Workspace {
  id: string
  repositoryId?: string
  ownerUserId?: string
  directoryName: string
  branch?: string
  workspaceType?: WorkspaceType
  state?: WorkspaceState
  specContent?: string
  fixPlanContent?: string
  ralphEnabled?: boolean
  // Conductor-style fields
  derivedStatus?: WorkspaceStatus
  manualStatus?: WorkspaceStatus | null
  pinnedAt?: string | null
  notes?: string | null
  linkedWorkspaceIds?: string | null // JSON array
  unread?: number
  activeSessionId?: string | null
  bigTerminalMode?: boolean
  intendedTargetBranch?: string | null
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
export type SessionStatus = 'idle' | 'running' | 'paused' | 'compacting' | 'completed' | 'error' | 'cancelled'
export type PermissionMode = 'default' | 'plan' | 'auto-approve'
export type AgentType = 'claude' | 'codex' | 'kimi' | 'other'

/**
 * Session - Conductor-style with all fields
 */
export interface Session {
  id: string
  workspaceId?: string
  agentType?: AgentType
  model?: string
  status?: SessionStatus
  contextTokenCount?: number
  forkedFromSessionId?: string | null
  // Conductor-style fields
  title?: string
  claudeSessionId?: string | null
  permissionMode?: PermissionMode
  thinkingEnabled?: boolean
  codexThinkingLevel?: 'high' | 'medium' | 'low' | null
  contextUsedPercent?: string | null
  isCompacting?: boolean
  freshlyCompacted?: boolean
  isHidden?: boolean
  unreadCount?: number
  lastUserMessageAt?: string | null
  resumeSessionAt?: string | null
  createdAt?: string
  updatedAt?: string
}

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

export interface ClaudeMessageContent {
  type: string
  text?: string
  name?: string
  input?: unknown
}

export interface ClaudeStreamEvent {
  type: string
  message?: {
    role?: string
    content?: ClaudeMessageContent[]
  }
  tool?: string
  input?: unknown
  output?: unknown
  result?: string
  is_error?: boolean
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
