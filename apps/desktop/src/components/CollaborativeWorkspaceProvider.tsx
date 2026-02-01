/**
 * CollaborativeWorkspaceProvider
 *
 * Wraps workspace content with Liveblocks RoomProvider for real-time collaboration.
 * Each workspace gets its own Liveblocks room.
 *
 * Features:
 * - Automatic room creation/joining when entering a workspace
 * - Presence awareness (who else is in the workspace)
 * - Session and message sync via CRDT
 * - Graceful degradation when Liveblocks is not configured
 */

import { ReactNode, useMemo } from 'react'
import {
  RoomProvider,
  getWorkspaceRoomId,
  createInitialStorage,
  type LiveblocksPresence,
} from '@/lib/liveblocks'
import { getMachineId, getMachineName, getUserColor } from '@/lib/machineId'
import { RemoteMessageRelay } from '@/hooks/useRemoteMessageRelay'

interface CollaborativeWorkspaceProviderProps {
  /** Workspace ID */
  workspaceId: string
  /** User's display name (optional, defaults to machine name) */
  userName?: string
  /** Children to render inside the room */
  children: ReactNode
}

/**
 * Provider that enables collaboration features for a workspace.
 * If Liveblocks is not configured (no API key), renders children without collaboration.
 */
export function CollaborativeWorkspaceProvider({
  workspaceId,
  userName,
  children,
}: CollaborativeWorkspaceProviderProps) {
  // Generate room ID from workspace ID
  const roomId = useMemo(() => getWorkspaceRoomId(workspaceId), [workspaceId])

  // Generate initial presence
  const initialPresence = useMemo((): LiveblocksPresence => {
    return {
      name: userName ?? getMachineName(),
      color: getUserColor(),
      machineId: getMachineId(),
      activeSessionId: null,
      cursorFile: null,
      cursorLine: null,
    }
  }, [userName])

  // Check if Liveblocks is configured
  const isLiveblocksConfigured = Boolean(import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY)

  // If not configured, just render children without collaboration
  if (!isLiveblocksConfigured) {
    return <>{children}</>
  }

  return (
    <RoomProvider
      id={roomId}
      initialPresence={initialPresence}
      initialStorage={createInitialStorage}
    >
      {/* Relay remote messages to local sidecar */}
      <RemoteMessageRelay />
      {children}
    </RoomProvider>
  )
}

/**
 * Hook to check if collaboration is available in the current context
 */
export function useIsCollaborationAvailable(): boolean {
  return Boolean(import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY)
}
