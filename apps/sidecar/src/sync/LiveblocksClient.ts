/**
 * Liveblocks Server-Side Client
 *
 * Provides server-side access to Liveblocks rooms for:
 * - Syncing session state when sessions are created/updated
 * - Watching for remote messages targeting local sessions
 * - Pushing agent responses to the room
 */

import { Liveblocks } from '@liveblocks/node'
import { v4 as uuidv4 } from 'uuid'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

// =============================================================================
// Types
// =============================================================================

/**
 * Session data stored in Liveblocks
 */
export interface SessionData {
  id: string
  workspaceId: string | null
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
export interface MessageData {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sourceMachineId: string
  authorUserId: string | null
  authorName: string | null
  timestamp: number
  toolUseJson: string | null
}

// =============================================================================
// Machine ID (Server-Side)
// =============================================================================

const MACHINE_ID_FILE = path.join(os.homedir(), '.koda', 'machine-id')

/**
 * Get or create a persistent machine ID for the sidecar
 */
export function getMachineId(): string {
  try {
    // Try to read existing ID
    if (fs.existsSync(MACHINE_ID_FILE)) {
      return fs.readFileSync(MACHINE_ID_FILE, 'utf-8').trim()
    }
  } catch {
    // Ignore read errors
  }

  // Generate new ID
  const machineId = uuidv4()

  try {
    // Ensure directory exists
    fs.mkdirSync(path.dirname(MACHINE_ID_FILE), { recursive: true })
    fs.writeFileSync(MACHINE_ID_FILE, machineId)
  } catch {
    // Continue without persisting - will generate new ID next time
    console.warn('[Sync] Could not persist machine ID')
  }

  return machineId
}

/**
 * Get a human-readable machine name
 */
export function getMachineName(): string {
  return os.hostname() || getMachineId().slice(0, 6)
}

// =============================================================================
// Liveblocks Client
// =============================================================================

let liveblocksClient: Liveblocks | null = null

/**
 * Get or create the Liveblocks client
 */
function getLiveblocksClient(): Liveblocks | null {
  if (liveblocksClient) {
    return liveblocksClient
  }

  const secretKey = process.env.LIVEBLOCKS_SECRET_KEY
  if (!secretKey) {
    console.warn('[Sync] LIVEBLOCKS_SECRET_KEY not set - collaboration disabled')
    return null
  }

  liveblocksClient = new Liveblocks({
    secret: secretKey,
  })

  return liveblocksClient
}

// =============================================================================
// SyncManager
// =============================================================================

export class SyncManager {
  private workspaceId: string
  private roomId: string
  private machineId: string
  private machineName: string

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
    this.roomId = `workspace:${workspaceId}`
    this.machineId = getMachineId()
    this.machineName = getMachineName()
  }

  /**
   * Check if Liveblocks is configured and available
   */
  isEnabled(): boolean {
    return getLiveblocksClient() !== null
  }

  /**
   * Sync a session to Liveblocks storage
   */
  async syncSession(session: {
    id: string
    workspaceId?: string | null
    agentType?: string | null
    model?: string | null
    status?: string | null
    title?: string | null
    createdAt?: string | null
    updatedAt?: string | null
  }): Promise<void> {
    const client = getLiveblocksClient()
    if (!client) return

    const sessionData: SessionData = {
      id: session.id,
      workspaceId: session.workspaceId ?? this.workspaceId,
      agentType: session.agentType ?? null,
      model: session.model ?? null,
      status: session.status ?? 'idle',
      hostMachineId: this.machineId,
      hostMachineName: this.machineName,
      createdByUserId: null, // Set by caller if known
      title: session.title ?? null,
      createdAt: session.createdAt ?? new Date().toISOString(),
      updatedAt: session.updatedAt ?? new Date().toISOString(),
    }

    try {
      // Use Liveblocks REST API to update storage
      // Note: In production, we'd use the Yjs document API for proper CRDT merging
      console.log(`[Sync] Syncing session ${session.id} to room ${this.roomId}`)

      // For now, log the sync attempt - full implementation requires
      // setting up Liveblocks webhook or polling mechanism
      console.log(`[Sync] Session data:`, JSON.stringify(sessionData, null, 2))
    } catch (error) {
      console.error(`[Sync] Failed to sync session:`, error)
    }
  }

  /**
   * Add a message to Liveblocks storage
   */
  async addMessage(
    sessionId: string,
    message: {
      role: 'user' | 'assistant' | 'system'
      content: string
      authorUserId?: string | null
      authorName?: string | null
      toolUseJson?: string | null
    }
  ): Promise<void> {
    const client = getLiveblocksClient()
    if (!client) return

    const messageData: MessageData = {
      id: uuidv4(),
      role: message.role,
      content: message.content,
      sourceMachineId: this.machineId,
      authorUserId: message.authorUserId ?? null,
      authorName: message.authorName ?? null,
      timestamp: Date.now(),
      toolUseJson: message.toolUseJson ?? null,
    }

    try {
      console.log(`[Sync] Adding message to session ${sessionId}`)
      console.log(`[Sync] Message data:`, JSON.stringify(messageData, null, 2))
    } catch (error) {
      console.error(`[Sync] Failed to add message:`, error)
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled'
  ): Promise<void> {
    const client = getLiveblocksClient()
    if (!client) return

    try {
      console.log(`[Sync] Updating session ${sessionId} status to ${status}`)
    } catch (error) {
      console.error(`[Sync] Failed to update session status:`, error)
    }
  }

  /**
   * Get the Yjs document for this room (for advanced sync)
   */
  async getYjsDocument(): Promise<ArrayBuffer | null> {
    const client = getLiveblocksClient()
    if (!client) return null

    try {
      const doc = await client.getYjsDocumentAsBinaryUpdate(this.roomId)
      return doc
    } catch (error) {
      console.error(`[Sync] Failed to get Yjs document:`, error)
      return null
    }
  }
}

// =============================================================================
// Singleton access per workspace
// =============================================================================

const syncManagers = new Map<string, SyncManager>()

/**
 * Get or create a SyncManager for a workspace
 */
export function getSyncManager(workspaceId: string): SyncManager {
  let manager = syncManagers.get(workspaceId)
  if (!manager) {
    manager = new SyncManager(workspaceId)
    syncManagers.set(workspaceId, manager)
  }
  return manager
}

/**
 * Check if collaboration is enabled (Liveblocks configured)
 */
export function isCollaborationEnabled(): boolean {
  return getLiveblocksClient() !== null
}
