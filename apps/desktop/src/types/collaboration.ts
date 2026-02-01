/**
 * Collaboration Types
 *
 * Types for multi-host collaborative workspaces using Liveblocks + Yjs.
 * These extend the base types from lib/rpc.ts with collaboration-specific fields.
 *
 * Note: Types use index signatures to satisfy Liveblocks' LsonObject constraint.
 */

import type { Session } from '@/lib/rpc'

// =============================================================================
// Presence - Ephemeral state (who's online, what they're doing)
// =============================================================================

/**
 * Cursor position in a file
 */
export type CursorPosition = {
  file: string
  line: number
  [key: string]: unknown
}

/**
 * User presence in a collaborative workspace room
 */
export type Presence = {
  /** User's display name */
  name: string
  /** User's avatar color (hex) */
  color: string
  /** Unique identifier for the user's machine */
  machineId: string
  /** Session the user is currently viewing */
  activeSessionId?: string | null
  /** Cursor position in a file (for future code collaboration) */
  cursor?: CursorPosition | null
  [key: string]: unknown
}

// =============================================================================
// Storage - Persisted state (synced via CRDT)
// =============================================================================

/**
 * Collaborative session - extends Session with host information
 * Uses index signature for Liveblocks compatibility
 */
export type CollaborativeSession = {
  id: string
  workspaceId?: string | null
  agentType?: string | null
  model?: string | null
  status?: string | null
  contextTokenCount?: number | null
  forkedFromSessionId?: string | null
  title?: string | null
  claudeSessionId?: string | null
  permissionMode?: string | null
  thinkingEnabled?: boolean | null
  codexThinkingLevel?: string | null
  contextUsedPercent?: string | null
  isCompacting?: boolean | null
  freshlyCompacted?: boolean | null
  isHidden?: boolean | null
  unreadCount?: number | null
  lastUserMessageAt?: string | null
  resumeSessionAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  /** Machine that hosts/runs this agent session */
  hostMachineId: string
  /** User who created the session */
  createdByUserId?: string | null
  /** Display name of the host machine */
  hostMachineName?: string | null
  [key: string]: unknown
}

/**
 * Tool use record for messages
 */
export type CollaborativeToolUse = {
  id: string
  name: string
  input?: unknown
  result?: string | null
  isError?: boolean | null
  [key: string]: unknown
}

/**
 * Message in a collaborative session
 */
export type CollaborativeMessage = {
  /** Unique message ID */
  id: string
  /** 'user' | 'assistant' | 'system' */
  role: 'user' | 'assistant' | 'system'
  /** Message content */
  content: string
  /** Machine that sent/generated this message */
  sourceMachineId: string
  /** User who sent (for user messages) */
  authorUserId?: string | null
  /** Author display name */
  authorName?: string | null
  /** Unix timestamp */
  timestamp: number
  /** Tool calls/results for assistant messages (stored as JSON string for Liveblocks) */
  toolUseJson?: string | null
  [key: string]: unknown
}

/**
 * Diff comment for code review
 */
export type CollaborativeDiffComment = {
  id: string
  /** User who created the comment */
  userId: string
  /** User display name */
  userName: string
  /** File path the comment is on */
  filePath: string
  /** Line number in the diff */
  lineNumber: number
  /** Comment body */
  body: string
  /** Whether the comment is resolved */
  resolved: boolean
  /** Unix timestamp */
  timestamp: number
  /** Parent comment ID for threads */
  parentId?: string | null
  [key: string]: unknown
}

// =============================================================================
// Room Storage Structure (for Liveblocks)
// =============================================================================

/**
 * Room storage types for Liveblocks
 * These map to Yjs data structures
 */
export interface RoomStorage {
  /** Sessions indexed by session ID */
  sessions: Map<string, CollaborativeSession>
  /** Messages indexed by session ID -> message list */
  messages: Map<string, CollaborativeMessage[]>
  /** Diff comments */
  comments: CollaborativeDiffComment[]
}

// =============================================================================
// Events
// =============================================================================

/**
 * Collaboration event types for pub/sub
 */
export type CollaborationEventType =
  | 'session:created'
  | 'session:updated'
  | 'session:deleted'
  | 'message:added'
  | 'comment:added'
  | 'comment:resolved'

export type CollaborationEvent = {
  type: CollaborationEventType
  workspaceId: string
  sessionId?: string | null
  machineId: string
  timestamp: number
  payload: unknown
  [key: string]: unknown
}

// =============================================================================
// Sync State
// =============================================================================

/**
 * Connection status for collaboration
 */
export type CollaborationConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

/**
 * Peer information (other users in the room)
 */
export type Peer = {
  connectionId: string
  presence: Presence
  [key: string]: unknown
}

// =============================================================================
// Helpers to convert between Session and CollaborativeSession
// =============================================================================

/**
 * Convert a Session to CollaborativeSession
 */
export function toCollaborativeSession(
  session: Session,
  hostMachineId: string,
  hostMachineName?: string,
  createdByUserId?: string
): CollaborativeSession {
  return {
    ...session,
    id: session.id,
    hostMachineId,
    hostMachineName: hostMachineName ?? null,
    createdByUserId: createdByUserId ?? null,
  }
}

/**
 * Convert CollaborativeSession back to Session-like object
 */
export function fromCollaborativeSession(collabSession: CollaborativeSession): Session {
  const { hostMachineId: _hostMachineId, hostMachineName: _hostMachineName, createdByUserId: _createdByUserId, ...session } = collabSession
  return session as Session
}
