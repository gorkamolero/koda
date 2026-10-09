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
import { rpcRequest } from '@/lib/tauri'

// =============================================================================
// Liveblocks Client
// =============================================================================

/**
 * Check if Liveblocks is configured
 * In E2E tests and local dev without key, this will be false
 */
const client = createClient({
  authEndpoint: async (room) => {
    if (!room) throw new Error('A workspace room is required')
    return rpcRequest<{ token: string }>('collaboration.auth', { roomId: room })
  },
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
  service?: boolean
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
  /** Authoritative host transcript snapshots, updated during each streamed turn. */
  transcripts: LiveMap<string, string>
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
  | { type: 'relay'; authorName?: string; authorMachineId?: string; roomId: string; grantId: string; signature: string; requestId: string; sessionId: string; content: string }
  | { type: 'relay-result'; requestId: string; error: string | null }

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
 * Only created if Liveblocks client is available
 */
const roomContext = client
  ? createRoomContext<LiveblocksPresence, LiveblocksStorage, UserMeta, RoomEvent, ThreadMetadata>(
      client
    )
  : null

// Export room context hooks (will throw helpful errors if used without Liveblocks)
function createNoopHook(name: string) {
  return () => {
    throw new Error(`${name} requires collaboration to be configured in Settings`)
  }
}

export const RoomProvider = roomContext?.RoomProvider ?? ((() => null) as never)
export const useRoom = roomContext?.useRoom ?? createNoopHook('useRoom')
export const useMyPresence = roomContext?.useMyPresence ?? createNoopHook('useMyPresence')
export const useUpdateMyPresence = roomContext?.useUpdateMyPresence ?? createNoopHook('useUpdateMyPresence')
export const useOthers = roomContext?.useOthers ?? createNoopHook('useOthers')
export const useOthersMapped = roomContext?.useOthersMapped ?? createNoopHook('useOthersMapped')
export const useOthersConnectionIds = roomContext?.useOthersConnectionIds ?? createNoopHook('useOthersConnectionIds')
export const useOther = roomContext?.useOther ?? createNoopHook('useOther')
export const useSelf = roomContext?.useSelf ?? createNoopHook('useSelf')
export const useStorage = roomContext?.useStorage ?? createNoopHook('useStorage')
export const useMutation = roomContext?.useMutation ?? createNoopHook('useMutation')
export const useStatus = roomContext?.useStatus ?? createNoopHook('useStatus')
export const useLostConnectionListener = roomContext?.useLostConnectionListener ?? createNoopHook('useLostConnectionListener')
export const useErrorListener = roomContext?.useErrorListener ?? createNoopHook('useErrorListener')
export const useEventListener = roomContext?.useEventListener ?? createNoopHook('useEventListener')
export const useBroadcastEvent = roomContext?.useBroadcastEvent ?? createNoopHook('useBroadcastEvent')
export const useHistory = roomContext?.useHistory ?? createNoopHook('useHistory')
export const useUndo = roomContext?.useUndo ?? createNoopHook('useUndo')
export const useRedo = roomContext?.useRedo ?? createNoopHook('useRedo')
export const useCanUndo = roomContext?.useCanUndo ?? createNoopHook('useCanUndo')
export const useCanRedo = roomContext?.useCanRedo ?? createNoopHook('useCanRedo')

// =============================================================================
// Global Liveblocks Context
// =============================================================================

/**
 * Global Liveblocks context for non-room-specific operations
 * Only created if Liveblocks client is available
 */
const liveblocksContext = client ? createLiveblocksContext(client) : null

export const LiveblocksProvider = liveblocksContext?.LiveblocksProvider ?? ((() => null) as never)
export const useClient = liveblocksContext?.useClient ?? createNoopHook('useClient')

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
    transcripts: new LiveMap([]),
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
