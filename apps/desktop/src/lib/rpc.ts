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
  // Workspaces (containers)
  WORKSPACE_LIST: 'workspace.list',
  WORKSPACE_CREATE: 'workspace.create',
  WORKSPACE_GET: 'workspace.get',
  WORKSPACE_GET_WITH_CONTENTS: 'workspace.getWithContents',
  WORKSPACE_UPDATE: 'workspace.update',
  WORKSPACE_DELETE: 'workspace.delete',
  WORKSPACE_CREATE_STANDALONE: 'workspace.createStandalone',
  // Workspace Repos (which repos are attached to workspace)
  WORKSPACE_REPO_ATTACH: 'workspaceRepo.attach',
  WORKSPACE_REPO_DETACH: 'workspaceRepo.detach',
  WORKSPACE_REPO_LIST: 'workspaceRepo.list',
  // Worktrees
  WORKTREE_CREATE: 'worktree.create',
  WORKTREE_DELETE: 'worktree.delete',
  WORKTREE_GET: 'worktree.get',
  WORKTREE_LIST: 'worktree.list',
  WORKTREE_LIST_ALL: 'worktree.listAll',
  WORKTREE_LIST_BY_WORKSPACE: 'worktree.listByWorkspace',
  WORKTREE_ADD_TO_WORKSPACE: 'worktree.addToWorkspace',
  WORKTREE_REMOVE_FROM_WORKSPACE: 'worktree.removeFromWorkspace',
  WORKTREE_GET_DIFF: 'worktree.getDiff',
  WORKTREE_ENABLE_COLLABORATION: 'worktree.enableCollaboration',
  WORKTREE_DISABLE_COLLABORATION: 'worktree.disableCollaboration',
  // Sessions
  SESSION_LIST: 'session.list',
  SESSION_CREATE: 'session.create',
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
  // Pulse
  PULSE_START: 'pulse.start',
  PULSE_STOP: 'pulse.stop',
  PULSE_STATUS: 'pulse.status',
  PULSE_LIST_ACTIVE: 'pulse.listActive',
  // GitHub
  GITHUB_CREATE_PR: 'github.createPr',
  GITHUB_GET_CHECKS: 'github.getChecks',
  // Filesystem
  FS_READ_DIRECTORY: 'fs.readDirectory',
  FS_READ_FILE: 'fs.readFile',
  // Activity feed
  ACTIVITY_CREATE: 'activity.create',
  ACTIVITY_LIST: 'activity.list',
  ACTIVITY_MARK_READ: 'activity.markRead',
  ACTIVITY_UNREAD_COUNT: 'activity.unreadCount',
  ACTIVITY_GET_WORKSPACES_WITH_STATUS: 'activity.getWorkspacesWithStatus',
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
  workspaceId?: string // Optional workspace to add this worktree to
}

/**
 * Worktree status types (Conductor-style)
 */
export type WorktreeStatus = 'in-progress' | 'done' | 'blocked' | 'needs-review'
export type WorktreeState = 'active' | 'archived'
export type WorktreeType = 'standard' | 'spec-driven' | 'ralph' | 'openprose'

// Backwards-compat aliases - the old "WorkspaceStatus" was really worktree status
export type WorkspaceStatus = WorktreeStatus
export type WorkspaceState = WorktreeState
export type WorkspaceType = WorktreeType

/**
 * Worktree - A git worktree tied to a repo
 * Can appear in multiple workspaces via workspaceIds[]
 */
export interface Worktree {
  id: string
  repoId: string
  branch?: string | null
  worktreePath?: string | null
  workspaceIds?: string | null // JSON array: ["ws-1", "ws-2"]
  worktreeType?: WorktreeType | null
  state?: WorktreeState | null
  specContent?: string | null
  fixPlanContent?: string | null
  ralphEnabled?: boolean
  // Conductor-style fields
  derivedStatus?: WorktreeStatus | null
  manualStatus?: WorktreeStatus | null
  pinnedAt?: string | null
  notes?: string | null
  linkedWorktreeIds?: string | null
  unread?: number
  activeSessionId?: string | null
  bigTerminalMode?: boolean
  intendedTargetBranch?: string | null
  collaborative?: boolean // Opt-in Liveblocks collaboration
  createdAt?: string
  updatedAt?: string
  // Extra field from handler
  setupError?: string
}

// Backwards-compat alias - the old code used "WorktreeResult"
export type WorktreeResult = Worktree

/**
 * Legacy workspace type for backwards compatibility with existing UI
 * This maps to the new Worktree type - use Worktree for new code
 * @deprecated Use Worktree instead
 */
export interface LegacyWorkspace {
  id: string
  repositoryId?: string | null
  ownerUserId?: string | null
  directoryName?: string | null
  branch?: string | null
  workspaceType?: WorktreeType | null
  state?: WorktreeState | null
  specContent?: string | null
  fixPlanContent?: string | null
  ralphEnabled?: boolean
  derivedStatus?: WorktreeStatus | null
  manualStatus?: WorktreeStatus | null
  pinnedAt?: string | null
  notes?: string | null
  linkedWorkspaceIds?: string | null
  unread?: number
  activeSessionId?: string | null
  bigTerminalMode?: boolean
  intendedTargetBranch?: string | null
  createdAt?: string
  updatedAt?: string
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
 * Diff stats for a workspace
 */
export interface DiffStats {
  additions: number
  deletions: number
  filesChanged: number
}

/**
 * Worktree diff - changes compared to merge base
 */
export interface WorktreeDiff {
  files: FileDiff[]
  summary: DiffSummary
  mergeBase?: string
  targetBranch?: string
}

/**
 * Workspace - Pure container for organizing repos and worktrees
 */
export interface Workspace {
  id: string
  name: string
  description?: string | null
  ownerUserId?: string | null
  createdAt?: string
  updatedAt?: string
}

/**
 * Workspace with its contents (repos and worktrees)
 */
export interface WorkspaceWithContents extends Workspace {
  repos: Array<{
    id: string
    name: string | null
    rootPath: string | null
    remoteUrl: string | null
    defaultBranch: string | null
  }>
  worktrees: Array<{
    id: string
    repoId: string
    branch: string | null
    worktreePath: string | null
    state: string | null
    derivedStatus: string | null
  }>
}

export interface CreateWorkspaceParams {
  name: string
  description?: string
  ownerUserId?: string
}

export interface UpdateWorkspaceParams {
  id: string
  name?: string
  description?: string
}

export interface GetWorkspaceParams {
  id: string
}

export interface ListWorkspacesParams {
  limit?: number
  offset?: number
}

/**
 * Create standalone workspace (same as CreateWorkspaceParams)
 */
export interface CreateStandaloneWorkspaceParams {
  name: string
  description?: string
}

/**
 * Workspace repo types - for multi-repo workspaces
 * This is purely about visibility: "repo X is available in workspace Y"
 * Repos are horizontal - no hierarchy.
 */
export interface WorkspaceRepo {
  id: string
  workspaceId: string
  repoId: string
  createdAt: string
  // Joined repo details
  repoName?: string | null
  repoRootPath?: string | null
  repoRemoteUrl?: string | null
  repoDefaultBranch?: string | null
}

export interface AttachRepoParams {
  workspaceId: string
  repoId: string
}

export interface DetachRepoParams {
  workspaceId: string
  repoId: string
}

export interface ListWorkspaceReposParams {
  workspaceId: string
}

/**
 * Worktree workspace management params
 */
export interface ListWorktreesByWorkspaceParams {
  workspaceId: string
  includeArchived?: boolean
}

export interface AddWorktreeToWorkspaceParams {
  worktreeId: string
  workspaceId: string
}

export interface RemoveWorktreeFromWorkspaceParams {
  worktreeId: string
  workspaceId: string
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
  worktreeId?: string
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
  worktreeId: string
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

/**
 * Pulse types
 */
export type PulseStatus = 'idle' | 'starting' | 'running' | 'syncing' | 'error' | 'stopping'

export interface PulseInfo {
  worktreeId: string
  status: PulseStatus
  repoRootPath: string
  syncCount: number
  lastSyncAt: string | null
  errorMessage: string | null
}

export interface StartPulseParams {
  worktreeId: string
  repoRootPath: string
}

export interface StopPulseParams {
  worktreeId: string
}

export interface GetPulseStatusParams {
  worktreeId: string
}

export interface PulseStatusNotification {
  worktreeId: string
  status: PulseStatus
  syncCount: number
  lastSyncAt: string | null
  errorMessage: string | null
}

export interface PulseLogNotification {
  worktreeId: string
  line: string
  stream: 'stdout' | 'stderr'
  timestamp: number
}

/**
 * GitHub types
 */
export interface CreatePrParams {
  worktreeId: string
  title?: string
  body?: string
  draft?: boolean
}

export interface PrResult {
  url: string
  number: number
  state: 'open' | 'draft'
}

export interface GetChecksParams {
  worktreeId: string
}

export type GhCheckStatus = 'pending' | 'running' | 'success' | 'failure' | 'skipped'

export interface GhCheck {
  id: string
  name: string
  status: GhCheckStatus
  description?: string
  duration?: string
  url?: string
}

export interface ChecksResult {
  checks: GhCheck[]
  prUrl?: string
  commitSha?: string
}

/**
 * Filesystem types
 */
export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
}

export interface ReadDirectoryParams {
  path: string
}

export interface ReadFileParams {
  path: string
}

/**
 * Activity types (Agent Overview & Activity Feed)
 */
export type ActivityType = 'file_change' | 'agent_complete' | 'agent_error' | 'checkpoint'

export interface Activity {
  id: string
  workspaceId: string
  type: ActivityType
  title: string
  description?: string | null
  navigateTo?: { view: string; params?: Record<string, string> } | null
  read: boolean
  createdAt: number
}

export interface CreateActivityParams {
  workspaceId: string
  type: ActivityType
  title: string
  description?: string
  navigateTo?: { view: string; params?: Record<string, string> }
}

export interface ListActivityParams {
  workspaceId: string
  limit?: number
  unreadOnly?: boolean
}

export interface MarkReadParams {
  workspaceId: string
  ids?: string[]
}

export interface UnreadCountParams {
  workspaceId: string
}

export type AgentStatus = 'idle' | 'thinking' | 'writing' | 'error'

export interface WorkspaceWithStatus {
  id: string
  name: string
  status: AgentStatus
  worktreeCount: number
  activeSessionCount: number
}
