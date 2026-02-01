/**
 * Sync Module
 *
 * Provides multi-host collaboration via Liveblocks.
 *
 * Key exports:
 * - getSyncManager(workspaceId): Get a sync manager for a workspace
 * - isCollaborationEnabled(): Check if Liveblocks is configured
 *
 * Usage:
 *   import { getSyncManager, isCollaborationEnabled } from './sync/index.js'
 *
 *   // In session creation handler:
 *   const sync = getSyncManager(workspaceId)
 *   if (sync.isEnabled()) {
 *     await sync.syncSession(session)
 *   }
 *
 *   // In message handler:
 *   await sync.addMessage(sessionId, { role: 'assistant', content: '...' })
 */

export {
  SyncManager,
  getSyncManager,
  isCollaborationEnabled,
  getMachineId,
  getMachineName,
  type SessionData,
  type MessageData,
} from './LiveblocksClient.js'
