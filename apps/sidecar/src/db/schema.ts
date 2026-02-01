/**
 * Koda Database Schema
 *
 * Collaboration-ready from day 1:
 * - Multi-git identity support
 * - Workspace sharing
 * - Conversation forking
 * - Visual snapshots
 * - Git checkpoints per turn
 * - Spec-based workspaces
 *
 * REARCHITECTURE (v2):
 * - Workspaces are pure containers (groupings of repos + worktrees)
 * - Worktrees are git worktrees, each tied to a repo
 * - Worktrees can appear in multiple workspaces via workspace_ids[]
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Helper for default timestamps
const timestamp = () => text('created_at').notNull().default(sql`(datetime('now'))`);

/**
 * Users - For collaboration features
 * Multiple users can share workspaces, comment on diffs, etc.
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp(),
});

/**
 * Git Identities - Multi-account support
 * Users can have multiple GitHub/GitLab/Bitbucket accounts
 * Each workspace can use a different identity
 */
export const gitIdentities = sqliteTable('git_identities', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  provider: text('provider'), // 'github', 'gitlab', 'bitbucket'
  username: text('username'),
  email: text('email'),
  tokenEncrypted: text('token_encrypted'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: timestamp(),
});

/**
 * Repositories
 * Root repository configurations with setup/run scripts
 *
 * Conductor-style additions:
 * - archiveScript: Run when archiving workspace
 * - runScriptMode: 'concurrent' or 'sequential'
 * - Per-task custom prompts
 */
export const repos = sqliteTable('repos', {
  id: text('id').primaryKey(),
  remoteUrl: text('remote_url'),
  name: text('name'),
  defaultBranch: text('default_branch').default('main'),
  rootPath: text('root_path'),
  gitIdentityId: text('git_identity_id').references(() => gitIdentities.id),
  setupScript: text('setup_script'),
  runScript: text('run_script'),
  archiveScript: text('archive_script'), // Conductor-style
  runScriptMode: text('run_script_mode').default('concurrent'), // 'concurrent', 'sequential'
  customPrompt: text('custom_prompt'), // General custom prompt
  customPromptCodeReview: text('custom_prompt_code_review'),
  customPromptCreatePr: text('custom_prompt_create_pr'),
  customPromptRenameBranch: text('custom_prompt_rename_branch'),
  conductorConfig: text('conductor_config'), // JSON config from .koda/config.json
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * Workspaces - Pure containers for organizing repos and worktrees
 *
 * A workspace is a grouping concept. It has:
 * - A name and description
 * - Repos attached via workspace_repos join table
 * - Worktrees appear in it via worktrees.workspace_ids[]
 */
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ownerUserId: text('owner_user_id').references(() => users.id),
  createdAt: timestamp(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * Worktrees - Git worktrees (isolated branches/checkouts)
 *
 * Each worktree:
 * - Belongs to exactly one repo (repoId)
 * - Lives at a specific path on disk (worktreePath)
 * - Can appear in multiple workspaces (workspaceIds JSON array)
 * - Has agent sessions attached to it
 *
 * Types:
 * - standard: Traditional workspace, one-shot interactions
 * - spec-driven: Has attached spec, agents work toward it
 * - ralph: Fresh agent loop until spec complete
 * - openprose: Running a .prose program with multiple agents
 *
 * Status system (Conductor-style):
 * - derivedStatus: Auto-computed from session activity
 * - manualStatus: User override for status
 */
export const worktrees = sqliteTable('worktrees', {
  id: text('id').primaryKey(),
  repoId: text('repo_id').references(() => repos.id).notNull(),
  branch: text('branch'),
  worktreePath: text('worktree_path'), // e.g., /repo/workspaces/feature-foo
  workspaceIds: text('workspace_ids'), // JSON array: ["ws-1", "ws-2"]
  worktreeType: text('worktree_type').default('standard'), // 'standard', 'spec-driven', 'ralph', 'openprose'
  state: text('state').default('active'), // 'active', 'archived'
  specContent: text('spec_content'), // The feature spec (for spec-driven/ralph)
  fixPlanContent: text('fix_plan_content'), // Current task list (for ralph)
  ralphEnabled: integer('ralph_enabled', { mode: 'boolean' }).default(false),
  // Conductor-style fields
  derivedStatus: text('derived_status').default('in-progress'), // 'in-progress', 'done', 'blocked', 'needs-review'
  manualStatus: text('manual_status'), // User override, null means use derived
  pinnedAt: text('pinned_at'), // Timestamp when pinned, null = not pinned
  notes: text('notes'), // User notes for this worktree
  linkedWorktreeIds: text('linked_worktree_ids'), // JSON array of related worktree IDs
  unread: integer('unread').default(0), // Unread message count
  activeSessionId: text('active_session_id'), // Currently active session
  bigTerminalMode: integer('big_terminal_mode', { mode: 'boolean' }).default(false),
  intendedTargetBranch: text('intended_target_branch'), // For PR creation
  createdAt: timestamp(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * Workspace Repos - Many-to-many join table
 * Which repos are attached to which workspaces
 *
 * This is purely about visibility: "repo X is available in workspace Y"
 * The actual worktrees for that repo can then be created/added to the workspace
 */
export const workspaceRepos = sqliteTable('workspace_repos', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  repoId: text('repo_id').references(() => repos.id).notNull(),
  createdAt: timestamp(),
});

/**
 * Workspace Shares - Collaboration
 * Share any workspace (container) with anyone
 *
 * Permissions:
 * - view: Read-only access
 * - comment: Can add diff comments
 * - control: Can control agent sessions, type in terminal
 */
export const workspaceShares = sqliteTable('workspace_shares', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id),
  sharedWithUserId: text('shared_with_user_id').references(() => users.id),
  permission: text('permission').default('view'), // 'view', 'comment', 'control'
  createdAt: timestamp(),
});

/**
 * Sessions - Conversations with agents
 *
 * Agent types:
 * - claude: Claude Code (first-class)
 * - codex: OpenAI Codex (first-class)
 * - kimi: Kimi Code (first-class)
 * - other: Terminal-only CLI agents
 *
 * Supports conversation forking via forkedFromSessionId
 *
 * Conductor-style additions:
 * - title: Human-readable session name
 * - permissionMode: Controls agent autonomy
 * - thinkingEnabled: Extended thinking toggle
 * - isCompacting: Currently reducing context
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    worktreeId: text('worktree_id').references(() => worktrees.id),
    agentType: text('agent_type'), // 'claude', 'codex', 'kimi', 'other'
    model: text('model'),
    status: text('status').default('idle'), // 'idle', 'running', 'paused', 'compacting'
    contextTokenCount: integer('context_token_count').default(0),
    forkedFromSessionId: text('forked_from_session_id'),
    // Conductor-style fields
    title: text('title').default('Untitled'),
    claudeSessionId: text('claude_session_id'), // Claude CLI session ID for resume
    permissionMode: text('permission_mode').default('default'), // 'default', 'plan', 'auto-approve'
    thinkingEnabled: integer('thinking_enabled', { mode: 'boolean' }).default(true),
    codexThinkingLevel: text('codex_thinking_level'), // 'high', 'medium', 'low' for Codex
    contextUsedPercent: text('context_used_percent'), // Float as text (0.0-1.0)
    isCompacting: integer('is_compacting', { mode: 'boolean' }).default(false),
    freshlyCompacted: integer('freshly_compacted', { mode: 'boolean' }).default(false),
    isHidden: integer('is_hidden', { mode: 'boolean' }).default(false),
    unreadCount: integer('unread_count').default(0),
    lastUserMessageAt: text('last_user_message_at'),
    resumeSessionAt: text('resume_session_at'), // For session resumption
    createdAt: timestamp(),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index('sessions_worktree_id_idx').on(table.worktreeId)]
);

/**
 * Session Messages
 * Stores full conversation history
 * turn_id groups messages that belong to the same agent turn
 *
 * Conductor-style additions:
 * - sentAt: Null = queued, set = sent to agent
 * - cancelledAt: Message was cancelled
 * - model: Per-message model tracking
 */
export const sessionMessages = sqliteTable(
  'session_messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').references(() => sessions.id),
    role: text('role'), // 'user', 'assistant', 'system'
    content: text('content'),
    fullMessageJson: text('full_message_json'), // Complete message object as JSON
    turnId: text('turn_id'),
    // Conductor-style fields
    fullMessage: text('full_message'), // Expanded content (for slash commands)
    model: text('model'), // Model used for this message
    sentAt: text('sent_at'), // Null = queued, set = sent
    cancelledAt: text('cancelled_at'), // Null = not cancelled
    sdkMessageId: text('sdk_message_id'), // From Claude SDK
    lastAssistantMessageId: text('last_assistant_message_id'),
    createdAt: timestamp(),
  },
  (table) => [
    index('session_messages_session_id_idx').on(table.sessionId),
    index('session_messages_sent_at_idx').on(table.sessionId, table.sentAt),
  ]
);

/**
 * Diff Comments - PR-style review
 * Users can comment on specific lines in diffs
 * Comments can be marked as resolved
 *
 * Conductor-style additions:
 * - threadId: For comment threads
 * - replyToCommentId: For replies
 * - location: Additional location context
 */
export const diffComments = sqliteTable('diff_comments', {
  id: text('id').primaryKey(),
  worktreeId: text('worktree_id').references(() => worktrees.id),
  userId: text('user_id').references(() => users.id),
  filePath: text('file_path'),
  lineNumber: integer('line_number'),
  body: text('body'),
  resolved: integer('resolved', { mode: 'boolean' }).default(false),
  // Conductor-style fields
  state: text('state').default('active'), // 'active', 'resolved', 'outdated'
  location: text('location'), // Additional location context
  author: text('author'), // Author name/handle
  threadId: text('thread_id'), // For threading
  replyToCommentId: text('reply_to_comment_id'),
  remoteUrl: text('remote_url'), // If synced from GitHub/GitLab
  updateMemory: integer('update_memory', { mode: 'boolean' }).default(false),
  createdAt: timestamp(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * Attachments - Files attached to sessions/messages
 * Conductor-style file attachment support
 */
export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    type: text('type'), // 'file', 'image', 'url'
    originalName: text('original_name'),
    path: text('path'),
    isLoading: integer('is_loading', { mode: 'boolean' }).default(false),
    isDraft: integer('is_draft', { mode: 'boolean' }).default(true),
    sessionId: text('session_id').references(() => sessions.id),
    sessionMessageId: text('session_message_id').references(() => sessionMessages.id),
    createdAt: timestamp(),
  },
  (table) => [
    index('attachments_session_id_idx').on(table.sessionId),
    index('attachments_session_message_id_idx').on(table.sessionMessageId),
  ]
);

/**
 * Visual Snapshots - Before/after UI screenshots
 * Captured via Playwright/Puppeteer
 * Killer differentiator: not just code diffs, actual visual comparison
 */
export const visualSnapshots = sqliteTable('visual_snapshots', {
  id: text('id').primaryKey(),
  worktreeId: text('worktree_id').references(() => worktrees.id),
  sessionId: text('session_id').references(() => sessions.id),
  turnId: text('turn_id'),
  snapshotType: text('snapshot_type'), // 'before', 'after'
  imagePath: text('image_path'),
  url: text('url'),
  createdAt: timestamp(),
});

/**
 * Git Checkpoints - Undo agent changes per turn
 * Stores git state (HEAD, index, worktree) for each turn
 * Enables time-travel debugging of agent sessions
 */
export const gitCheckpoints = sqliteTable('git_checkpoints', {
  id: text('id').primaryKey(),
  worktreeId: text('worktree_id').references(() => worktrees.id),
  turnId: text('turn_id'),
  headOid: text('head_oid'),
  indexTree: text('index_tree'),
  worktreeTree: text('worktree_tree'),
  createdAt: timestamp(),
});

/**
 * Settings - App-wide configuration
 * Key-value store for user preferences
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type GitIdentity = typeof gitIdentities.$inferSelect;
export type NewGitIdentity = typeof gitIdentities.$inferInsert;

export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type Worktree = typeof worktrees.$inferSelect;
export type NewWorktree = typeof worktrees.$inferInsert;

export type WorkspaceShare = typeof workspaceShares.$inferSelect;
export type NewWorkspaceShare = typeof workspaceShares.$inferInsert;

export type WorkspaceRepo = typeof workspaceRepos.$inferSelect;
export type NewWorkspaceRepo = typeof workspaceRepos.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type SessionMessage = typeof sessionMessages.$inferSelect;
export type NewSessionMessage = typeof sessionMessages.$inferInsert;

export type DiffComment = typeof diffComments.$inferSelect;
export type NewDiffComment = typeof diffComments.$inferInsert;

export type VisualSnapshot = typeof visualSnapshots.$inferSelect;
export type NewVisualSnapshot = typeof visualSnapshots.$inferInsert;

export type GitCheckpoint = typeof gitCheckpoints.$inferSelect;
export type NewGitCheckpoint = typeof gitCheckpoints.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

/**
 * Session Recordings - Video-like playback of agent sessions
 * Stores metadata about recordings (start/end time, duration)
 * Frames reference session_messages for efficient storage
 */
export const sessionRecordings = sqliteTable(
  'session_recordings',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').references(() => sessions.id),
    name: text('name'),
    description: text('description'),
    status: text('status').default('recording'), // 'recording', 'completed', 'error'
    startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
    endedAt: text('ended_at'),
    durationMs: integer('duration_ms'),
    frameCount: integer('frame_count').default(0),
  },
  (table) => [index('session_recordings_session_id_idx').on(table.sessionId)]
);

/**
 * Recording Frames - Individual events in a recording
 * References session_messages to avoid data duplication
 * Stores timing offset for accurate playback
 */
export const recordingFrames = sqliteTable(
  'recording_frames',
  {
    id: text('id').primaryKey(),
    recordingId: text('recording_id').references(() => sessionRecordings.id),
    messageId: text('message_id').references(() => sessionMessages.id),
    frameType: text('frame_type').default('message'), // 'message', 'tool_call', 'tool_result'
    offsetMs: integer('offset_ms').default(0),
    sequenceNumber: integer('sequence_number').default(0),
    createdAt: timestamp(),
  },
  (table) => [
    index('recording_frames_recording_id_idx').on(table.recordingId),
    index('recording_frames_message_id_idx').on(table.messageId),
  ]
);

export type SessionRecording = typeof sessionRecordings.$inferSelect;
export type NewSessionRecording = typeof sessionRecordings.$inferInsert;

export type RecordingFrame = typeof recordingFrames.$inferSelect;
export type NewRecordingFrame = typeof recordingFrames.$inferInsert;
