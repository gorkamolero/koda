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
  customPrompt: text('custom_prompt'),
  createdAt: timestamp(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * Workspaces - Isolated branches/worktrees
 *
 * Types:
 * - standard: Traditional workspace, one-shot interactions
 * - spec-driven: Has attached spec, agents work toward it
 * - ralph: Fresh agent loop until spec complete
 * - openprose: Running a .prose program with multiple agents
 */
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  repositoryId: text('repository_id').references(() => repos.id),
  ownerUserId: text('owner_user_id').references(() => users.id),
  directoryName: text('directory_name'),
  branch: text('branch'),
  workspaceType: text('workspace_type').default('standard'), // 'standard', 'spec-driven', 'ralph', 'openprose'
  state: text('state').default('active'), // 'active', 'archived'
  specContent: text('spec_content'), // The feature spec (for spec-driven/ralph)
  fixPlanContent: text('fix_plan_content'), // Current task list (for ralph)
  ralphEnabled: integer('ralph_enabled', { mode: 'boolean' }).default(false),
  createdAt: timestamp(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * Workspace Shares - Collaboration
 * Share any workspace with anyone
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
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspaces.id),
    agentType: text('agent_type'), // 'claude', 'codex', 'kimi', 'other'
    model: text('model'),
    status: text('status').default('idle'), // 'idle', 'running', 'paused'
    contextTokenCount: integer('context_token_count').default(0),
    forkedFromSessionId: text('forked_from_session_id'),
    createdAt: timestamp(),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index('sessions_workspace_id_idx').on(table.workspaceId)]
);

/**
 * Session Messages
 * Stores full conversation history
 * turn_id groups messages that belong to the same agent turn
 */
export const sessionMessages = sqliteTable(
  'session_messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').references(() => sessions.id),
    role: text('role'), // 'user', 'assistant'
    content: text('content'),
    fullMessageJson: text('full_message_json'), // Complete message object as JSON
    turnId: text('turn_id'),
    createdAt: timestamp(),
  },
  (table) => [index('session_messages_session_id_idx').on(table.sessionId)]
);

/**
 * Diff Comments - PR-style review
 * Users can comment on specific lines in diffs
 * Comments can be marked as resolved
 */
export const diffComments = sqliteTable('diff_comments', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id),
  userId: text('user_id').references(() => users.id),
  filePath: text('file_path'),
  lineNumber: integer('line_number'),
  body: text('body'),
  resolved: integer('resolved', { mode: 'boolean' }).default(false),
  createdAt: timestamp(),
});

/**
 * Visual Snapshots - Before/after UI screenshots
 * Captured via Playwright/Puppeteer
 * Killer differentiator: not just code diffs, actual visual comparison
 */
export const visualSnapshots = sqliteTable('visual_snapshots', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id),
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
  workspaceId: text('workspace_id').references(() => workspaces.id),
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

export type WorkspaceShare = typeof workspaceShares.$inferSelect;
export type NewWorkspaceShare = typeof workspaceShares.$inferInsert;

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
    startedAt: timestamp(),
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
