/**
 * Liveblocks Configuration
 *
 * Sets up the Liveblocks client for real-time collaboration.
 * Uses Yjs for CRDT-based data synchronization.
 *
 * Architecture:
 * - Each workspace = one Liveblocks room
 * - Room ID format: "workspace:{workspaceId}"
 * - Presence: ephemeral state (who's online, cursor position)
 * - Storage: persistent CRDT data (sessions, messages, comments)
 */

import { createClient, LiveList, LiveMap, LiveObject } from '@liveblocks/client'
import { createRoomContext, createLiveblocksContext } from '@liveblocks/react'
import type { Presence } from '@/types/collaboration'

// =============================================================================
// Liveblocks Client
// =============================================================================

/**
 * Create the Liveblocks client
 * Uses public API key for frontend (safe to expose)
 */
const client = createClient({
  publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY ?? '',

  // Throttle presence updates (avoid spamming)
  throttle: 100,
})

// =============================================================================
// Type Definitions for Liveblocks
// =============================================================================

/**
 * Liveblocks Presence type (ephemeral user state)
 * Flattened structure to satisfy JsonObject constraint
 */
type LiveblocksPresence = {
  name: string
  color: string
  machineId: string
  activeSessionId: string | null
  cursorFile: string | null
  cursorLine: number | null
}

/**
 * Session data stored in Liveblocks
 */
type SessionData = {
  id: string
  worktreeId: string | null
  agentType: string | null
  model: string | null
  status: string | null
  hostMachineId: string
  hostMachineName: string | null
  createdByUserId: string | null
  title: string | null
  createdAt: string | null
  updatedAt: string | null
}

/**
 * Message data stored in Liveblocks
 */
type MessageData = {
  id: string
  role: string
  content: string
  sourceMachineId: string
  authorUserId: string | null
  authorName: string | null
  timestamp: number
  toolUseJson: string | null
}

/**
 * Diff comment data stored in Liveblocks
 */
type CommentData = {
  id: string
  userId: string
  userName: string
  filePath: string
  lineNumber: number
  body: string
  resolved: boolean
  timestamp: number
  parentId: string | null
}

/**
 * Workspace metadata stored in Liveblocks
 * This is the source of truth for shared workspace identity
 */
type WorkspaceMeta = {
  id: string
  name: string
  description: string | null
  createdByMachineId: string
  createdByName: string
  createdAt: string
  /** Repo info is optional - workspace can exist without local repo */
  repoRemoteUrl: string | null
  repoBranch: string | null
}

/**
 * Liveblocks Storage type (persistent CRDT state)
 * Uses Liveblocks primitives for sync
 */
type LiveblocksStorage = {
  /** Workspace metadata - source of truth for shared identity */
  workspace: LiveObject<WorkspaceMeta>
  /** Sessions stored as LiveMap<sessionId, LiveObject<SessionData>> */
  sessions: LiveMap<string, LiveObject<SessionData>>
  /** Messages per session stored as LiveMap<sessionId, LiveList<LiveObject<MessageData>>> */
  messages: LiveMap<string, LiveList<LiveObject<MessageData>>>
  /** Diff comments stored as LiveList */
  comments: LiveList<LiveObject<CommentData>>
}

/**
 * User metadata (from auth endpoint)
 */
type UserMeta = {
  id: string
  info: {
    name: string
    color: string
    machineId: string
  }
}

/**
 * Room event types for pub/sub
 */
type RoomEvent =
  | { type: 'cursor'; data: { file: string; line: number } }
  | { type: 'notification'; data: { message: string } }

/**
 * Thread metadata (for comments)
 */
type ThreadMetadata = {
  filePath: string
  lineNumber: number
  resolved: boolean
}

// =============================================================================
// Room Context (for React components)
// =============================================================================

/**
 * Create typed room context
 * This provides React hooks for the specific room types
 */
export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOthersMapped,
  useOthersConnectionIds,
  useOther,
  useSelf,
  useStorage,
  useMutation,
  useStatus,
  useLostConnectionListener,
  useErrorListener,
  useEventListener,
  useBroadcastEvent,
  useHistory,
  useUndo,
  useRedo,
  useCanUndo,
  useCanRedo,
} = createRoomContext<LiveblocksPresence, LiveblocksStorage, UserMeta, RoomEvent, ThreadMetadata>(
  client
)

// =============================================================================
// Global Liveblocks Context
// =============================================================================

/**
 * Global Liveblocks context for non-room-specific operations
 */
export const { LiveblocksProvider, useClient } = createLiveblocksContext(client)

// =============================================================================
// Room ID Helpers
// =============================================================================

/**
 * Generate a room ID for a workspace
 */
export function getWorkspaceRoomId(workspaceId: string): string {
  return `workspace:${workspaceId}`
}

/**
 * Extract workspace ID from a room ID
 */
export function getWorkspaceIdFromRoomId(roomId: string): string | null {
  const match = roomId.match(/^workspace:(.+)$/)
  return match?.[1] ?? null
}

// =============================================================================
// Initial Storage Factory
// =============================================================================

/**
 * Create initial storage for a new room
 * Called by RoomProvider's initialStorage prop
 */
export function createInitialStorage(): LiveblocksStorage {
  return {
    workspace: new LiveObject({
      id: '',
      name: '',
      description: null,
      createdByMachineId: '',
      createdByName: '',
      createdAt: '',
      repoRemoteUrl: null,
      repoBranch: null,
    }),
    sessions: new LiveMap([]),
    messages: new LiveMap([]),
    comments: new LiveList([]),
  }
}

// =============================================================================
// Presence Helpers
// =============================================================================

/**
 * Convert internal Presence to Liveblocks Presence
 */
export function toLiveblocksPresence(presence: Presence): LiveblocksPresence {
  return {
    name: presence.name,
    color: presence.color,
    machineId: presence.machineId,
    activeSessionId: presence.activeSessionId ?? null,
    cursorFile: presence.cursor?.file ?? null,
    cursorLine: presence.cursor?.line ?? null,
  }
}

/**
 * Convert Liveblocks Presence to internal Presence
 */
export function fromLiveblocksPresence(lbPresence: LiveblocksPresence): Presence {
  return {
    name: lbPresence.name,
    color: lbPresence.color,
    machineId: lbPresence.machineId,
    activeSessionId: lbPresence.activeSessionId ?? undefined,
    cursor:
      lbPresence.cursorFile && lbPresence.cursorLine != null
        ? { file: lbPresence.cursorFile, line: lbPresence.cursorLine }
        : undefined,
  }
}

// =============================================================================
// Re-exports
// =============================================================================

export { client, LiveObject, LiveMap, LiveList }
export type {
  LiveblocksPresence,
  LiveblocksStorage,
  UserMeta,
  RoomEvent,
  ThreadMetadata,
  SessionData,
  MessageData,
  CommentData,
  WorkspaceMeta,
}
