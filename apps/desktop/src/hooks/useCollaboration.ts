/**
 * Collaboration Hooks
 *
 * Provides React hooks for collaborative features:
 * - useCollaboration: Connection status and presence
 * - useSessionSync: Sync session state via CRDT
 * - useMessageSync: Sync messages via CRDT
 * - usePresence: Access to other users in the room
 */

import { useCallback, useMemo } from 'react'
import {
  useStorage,
  useMutation,
  useOthers,
  useSelf,
  useStatus,
  useUpdateMyPresence,
  LiveObject,
  LiveList,
  type SessionData,
  type MessageData,
} from '@/lib/liveblocks'
import { getMachineId, getMachineName, getUserColor } from '@/lib/machineId'
import type { Session } from '@/lib/rpc'

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
    return others.map((other) => ({
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

// =============================================================================
// useSessionSync - Sync session state via CRDT
// =============================================================================

export interface SessionSyncResult {
  /** All sessions in the room (including remote) */
  sessions: SessionData[]
  /** Sessions hosted on the local machine */
  localSessions: SessionData[]
  /** Sessions hosted on remote machines */
  remoteSessions: SessionData[]
  /** Get a specific session by ID */
  getSession: (sessionId: string) => SessionData | undefined
  /** Check if a session is local (hosted on this machine) */
  isLocalSession: (sessionId: string) => boolean
  /** Create/sync a new session */
  createSession: (session: Session) => void
  /** Update a session */
  updateSession: (sessionId: string, updates: Partial<SessionData>) => void
  /** Delete a session */
  deleteSession: (sessionId: string) => void
}

export function useSessionSync(): SessionSyncResult {
  const localMachineId = useMemo(() => getMachineId(), [])
  const localMachineName = useMemo(() => getMachineName(), [])

  // Read sessions from storage
  const sessionsMap = useStorage((root) => root.sessions)

  // Convert to array
  const sessions = useMemo((): SessionData[] => {
    if (!sessionsMap) return []
    return Array.from(sessionsMap.values())
  }, [sessionsMap])

  // Split into local and remote
  const localSessions = useMemo(
    () => sessions.filter((s) => s.hostMachineId === localMachineId),
    [sessions, localMachineId]
  )

  const remoteSessions = useMemo(
    () => sessions.filter((s) => s.hostMachineId !== localMachineId),
    [sessions, localMachineId]
  )

  // Get session by ID
  const getSession = useCallback(
    (sessionId: string): SessionData | undefined => {
      return sessionsMap?.get(sessionId)
    },
    [sessionsMap]
  )

  // Check if local
  const isLocalSession = useCallback(
    (sessionId: string): boolean => {
      const session = sessionsMap?.get(sessionId)
      return session?.hostMachineId === localMachineId
    },
    [sessionsMap, localMachineId]
  )

  // Create session mutation
  const createSession = useMutation(
    ({ storage }, session: Session) => {
      const sessions = storage.get('sessions')
      const sessionData: SessionData = {
        id: session.id,
        workspaceId: session.workspaceId ?? null,
        agentType: session.agentType ?? null,
        model: session.model ?? null,
        status: session.status ?? 'idle',
        hostMachineId: localMachineId,
        hostMachineName: localMachineName,
        createdByUserId: null,
        title: session.title ?? null,
        createdAt: session.createdAt ?? new Date().toISOString(),
        updatedAt: session.updatedAt ?? new Date().toISOString(),
      }
      sessions.set(session.id, new LiveObject(sessionData))
    },
    [localMachineId, localMachineName]
  )

  // Update session mutation
  const updateSession = useMutation(
    ({ storage }, sessionId: string, updates: Partial<SessionData>) => {
      const sessions = storage.get('sessions')
      const session = sessions.get(sessionId)
      if (session) {
        // Only allow updating local sessions
        if (session.get('hostMachineId') === localMachineId) {
          Object.entries(updates).forEach(([key, value]) => {
            session.set(key as keyof SessionData, value as never)
          })
          session.set('updatedAt', new Date().toISOString())
        }
      }
    },
    [localMachineId]
  )

  // Delete session mutation
  const deleteSession = useMutation(
    ({ storage }, sessionId: string) => {
      const sessions = storage.get('sessions')
      const session = sessions.get(sessionId)
      // Only allow deleting local sessions
      if (session && session.get('hostMachineId') === localMachineId) {
        sessions.delete(sessionId)
      }
    },
    [localMachineId]
  )

  return {
    sessions,
    localSessions,
    remoteSessions,
    getSession,
    isLocalSession,
    createSession,
    updateSession,
    deleteSession,
  }
}

// =============================================================================
// useMessageSync - Sync messages via CRDT
// =============================================================================

export interface MessageSyncResult {
  /** All messages for the current session */
  messages: MessageData[]
  /** Add a new message (user or assistant) */
  addMessage: (message: Omit<MessageData, 'id' | 'sourceMachineId' | 'timestamp'>) => void
  /** Check if a message is from the local machine */
  isLocalMessage: (message: MessageData) => boolean
}

export function useMessageSync(sessionId: string | undefined): MessageSyncResult {
  const localMachineId = useMemo(() => getMachineId(), [])

  // Read messages from storage
  const messagesMap = useStorage((root) => root.messages)

  // Get messages for this session
  // Note: useStorage returns immutable snapshots, so sessionMessages is already a plain array
  const messages = useMemo((): MessageData[] => {
    if (!messagesMap || !sessionId) return []
    const sessionMessages = messagesMap.get(sessionId)
    if (!sessionMessages) return []
    // Storage returns immutable data, so we can cast directly
    return sessionMessages as unknown as MessageData[]
  }, [messagesMap, sessionId])

  // Check if local
  const isLocalMessage = useCallback(
    (message: MessageData): boolean => {
      return message.sourceMachineId === localMachineId
    },
    [localMachineId]
  )

  // Add message mutation
  const addMessage = useMutation(
    (
      { storage },
      message: Omit<MessageData, 'id' | 'sourceMachineId' | 'timestamp'>
    ) => {
      if (!sessionId) return

      const messagesMap = storage.get('messages')
      let sessionMessages = messagesMap.get(sessionId)

      // Create message list if it doesn't exist
      if (!sessionMessages) {
        sessionMessages = new LiveList([])
        messagesMap.set(sessionId, sessionMessages)
      }

      const messageData: MessageData = {
        id: crypto.randomUUID(),
        ...message,
        sourceMachineId: localMachineId,
        timestamp: Date.now(),
      }

      sessionMessages.push(new LiveObject(messageData))
    },
    [sessionId, localMachineId]
  )

  return {
    messages,
    addMessage,
    isLocalMessage,
  }
}
