/**
 * Collaboration Hooks
 *
 * Provides React hooks for collaborative features:
 * - useCollaboration: Connection status and presence
 * - usePresence: Access to other users in the room
 */

import { useCallback, useMemo } from 'react'
import {
  useOthers,
  useSelf,
  useStatus,
  useUpdateMyPresence,
} from '@/lib/liveblocks'
import { getMachineId, getMachineName, getUserColor } from '@/lib/machineId'

// =============================================================================
// useCollaboration - Connection status and basic info
// =============================================================================

export interface CollaborationInfo {
  /** Current connection status */
  status: 'initial' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  /** Whether collaboration is enabled and connected */
  isConnected: boolean
  /** Local machine ID */
  machineId: string
  /** Local machine name */
  machineName: string
  /** User's presence color */
  userColor: string
}

export function useCollaboration(): CollaborationInfo {
  const status = useStatus()
  const machineId = useMemo(() => getMachineId(), [])
  const machineName = useMemo(() => getMachineName(), [])
  const userColor = useMemo(() => getUserColor(), [])

  return {
    status,
    isConnected: status === 'connected',
    machineId,
    machineName,
    userColor,
  }
}

// =============================================================================
// usePresence - Other users in the room
// =============================================================================

export interface Peer {
  connectionId: number
  name: string
  color: string
  machineId: string
  activeSessionId: string | null
  isLocal: boolean
}

export function usePresence() {
  const others = useOthers()
  const self = useSelf()
  const updatePresence = useUpdateMyPresence()
  const localMachineId = useMemo(() => getMachineId(), [])

  const peers = useMemo((): Peer[] => {
    return others.filter((other) => !other.presence.service).map((other) => ({
      connectionId: other.connectionId,
      name: other.presence.name,
      color: other.presence.color,
      machineId: other.presence.machineId,
      activeSessionId: other.presence.activeSessionId,
      isLocal: other.presence.machineId === localMachineId,
    }))
  }, [others, localMachineId])

  const setActiveSession = useCallback(
    (sessionId: string | null) => {
      updatePresence({ activeSessionId: sessionId })
    },
    [updatePresence]
  )

  return {
    /** All other users in the room */
    peers,
    /** Count of other users */
    peerCount: peers.length,
    /** Current user's presence */
    self: self?.presence ?? null,
    /** Set which session the current user is viewing */
    setActiveSession,
    /** Update any presence field */
    updatePresence,
  }
}
