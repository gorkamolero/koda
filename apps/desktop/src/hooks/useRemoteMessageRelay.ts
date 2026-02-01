/**
 * useRemoteMessageRelay
 *
 * Watches for new messages in Liveblocks storage and relays them to the local sidecar
 * when they target a locally-hosted session.
 *
 * Flow:
 * 1. User on Machine B sends message to session hosted on Machine A
 * 2. Message is added to Liveblocks storage
 * 3. Machine A's frontend detects the new message via this hook
 * 4. Hook checks: is this session hosted locally? Is this a new remote message?
 * 5. If yes, relay to local sidecar via RPC
 *
 * This avoids needing webhooks or server-side Liveblocks polling.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useStorage } from '@/lib/liveblocks'
import { getMachineId } from '@/lib/machineId'
import { rpcRequest } from '@/lib/tauri'
import type { MessageData } from '@/lib/liveblocks'

interface UseRemoteMessageRelayOptions {
  /** Enable/disable the relay */
  enabled?: boolean
}

/**
 * Hook that automatically relays remote messages to local agent sessions.
 * Should be used once per workspace, inside the RoomProvider context.
 */
export function useRemoteMessageRelay(options: UseRemoteMessageRelayOptions = {}) {
  const { enabled = true } = options
  const machineId = getMachineId()

  // Track which messages we've already relayed to avoid duplicates
  const relayedMessageIds = useRef(new Set<string>())

  // Read sessions and messages from Liveblocks storage
  const sessions = useStorage((root) => root.sessions)
  const messages = useStorage((root) => root.messages)

  // Get local sessions (sessions hosted on this machine)
  const getLocalSessionIds = useCallback((): Set<string> => {
    if (!sessions) return new Set()
    const localIds = new Set<string>()
    for (const [sessionId, session] of sessions.entries()) {
      if (session.hostMachineId === machineId) {
        localIds.add(sessionId)
      }
    }
    return localIds
  }, [sessions, machineId])

  // Relay a message to the local sidecar
  const relayMessage = useCallback(
    async (sessionId: string, message: MessageData) => {
      try {
        console.log(`[RemoteRelay] Relaying message ${message.id} to session ${sessionId}`)

        // Use claude.resume with the message content
        // The resume RPC will send the message to the Claude CLI stdin
        await rpcRequest('claude.resume', {
          sessionId,
          prompt: message.content,
        })

        console.log(`[RemoteRelay] Successfully relayed message ${message.id}`)
      } catch (error) {
        console.error(`[RemoteRelay] Failed to relay message:`, error)
      }
    },
    []
  )

  // Effect to watch for new messages and relay them
  useEffect(() => {
    if (!enabled || !sessions || !messages) return

    const localSessionIds = getLocalSessionIds()
    if (localSessionIds.size === 0) return

    // Check each local session for new remote messages
    for (const sessionId of localSessionIds) {
      const sessionMessages = messages.get(sessionId)
      if (!sessionMessages) continue

      // Convert to array (Liveblocks returns immutable snapshots)
      const messageArray = sessionMessages as unknown as MessageData[]

      for (const message of messageArray) {
        // Skip if already relayed
        if (relayedMessageIds.current.has(message.id)) continue

        // Skip if this is a local message (we already sent it)
        if (message.sourceMachineId === machineId) {
          relayedMessageIds.current.add(message.id)
          continue
        }

        // Skip if not a user message (only relay user messages)
        if (message.role !== 'user') {
          relayedMessageIds.current.add(message.id)
          continue
        }

        // This is a remote user message - relay it!
        relayedMessageIds.current.add(message.id)
        void relayMessage(sessionId, message)
      }
    }
  }, [enabled, sessions, messages, machineId, getLocalSessionIds, relayMessage])

  // Return some stats for debugging
  return {
    relayedCount: relayedMessageIds.current.size,
    isEnabled: enabled,
  }
}

/**
 * Component that enables remote message relay for a workspace.
 * Use this inside the CollaborativeWorkspaceProvider.
 */
export function RemoteMessageRelay() {
  useRemoteMessageRelay({ enabled: true })
  return null
}
