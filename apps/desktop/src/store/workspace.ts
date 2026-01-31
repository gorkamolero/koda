import { atom } from 'jotai'
import type { Workspace, Session, WorkspaceStatus } from '@/lib/rpc'

/**
 * Workspace Store - Conductor-style state management
 *
 * Manages workspaces, sessions, and their relationships.
 * Uses Jotai atoms for reactive state updates.
 */

// =============================================================================
// Core Workspace State
// =============================================================================

/**
 * All workspaces, keyed by ID for O(1) lookups
 */
export const workspacesMapAtom = atom<Map<string, Workspace>>(new Map())

/**
 * All workspaces as array (derived, for iteration)
 */
export const workspacesAtom = atom((get) => {
  const map = get(workspacesMapAtom)
  return Array.from(map.values())
})

/**
 * Currently active workspace ID
 */
export const activeWorkspaceIdAtom = atom<string | null>(null)

/**
 * Currently active workspace (derived)
 */
export const activeWorkspaceAtom = atom((get) => {
  const id = get(activeWorkspaceIdAtom)
  if (!id) return null
  const map = get(workspacesMapAtom)
  return map.get(id) ?? null
})

/**
 * Set the active workspace
 */
export const setActiveWorkspaceAtom = atom(
  null,
  (_get, set, workspaceId: string | null) => {
    set(activeWorkspaceIdAtom, workspaceId)
  }
)

// =============================================================================
// Session State
// =============================================================================

/**
 * Sessions keyed by workspace ID -> session ID -> Session
 */
export const workspaceSessionsMapAtom = atom<Map<string, Map<string, Session>>>(
  new Map()
)

/**
 * Get sessions for a specific workspace
 */
export const getWorkspaceSessionsAtom = atom((get) => {
  return (workspaceId: string): Session[] => {
    const outerMap = get(workspaceSessionsMapAtom)
    const sessionsMap = outerMap.get(workspaceId)
    if (!sessionsMap) return []
    return Array.from(sessionsMap.values())
  }
})

/**
 * Currently active session ID
 */
export const activeSessionIdAtom = atom<string | null>(null)

/**
 * Active session for the current workspace (derived)
 */
export const activeSessionAtom = atom((get) => {
  const workspaceId = get(activeWorkspaceIdAtom)
  const sessionId = get(activeSessionIdAtom)
  if (!workspaceId || !sessionId) return null

  const outerMap = get(workspaceSessionsMapAtom)
  const sessionsMap = outerMap.get(workspaceId)
  if (!sessionsMap) return null

  return sessionsMap.get(sessionId) ?? null
})

/**
 * Set the active session
 */
export const setActiveSessionAtom = atom(
  null,
  (_get, set, sessionId: string | null) => {
    set(activeSessionIdAtom, sessionId)
  }
)

// =============================================================================
// Workspace Status (Conductor-style)
// =============================================================================

/**
 * Get effective status for a workspace
 * Manual status overrides derived status if set
 */
export const getWorkspaceStatusAtom = atom((get) => {
  return (workspaceId: string): WorkspaceStatus => {
    const map = get(workspacesMapAtom)
    const workspace = map.get(workspaceId)
    if (!workspace) return 'in-progress'

    // Manual status takes precedence
    if (workspace.manualStatus) {
      return workspace.manualStatus
    }

    return workspace.derivedStatus ?? 'in-progress'
  }
})

// =============================================================================
// Pinning Support
// =============================================================================

/**
 * IDs of pinned workspaces, sorted by pin time (most recent first)
 */
export const pinnedWorkspaceIdsAtom = atom((get) => {
  const workspaces = get(workspacesAtom)

  return workspaces
    .filter((w) => w.pinnedAt != null)
    .sort((a, b) => {
      const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
      const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
      return bTime - aTime // Most recent first
    })
    .map((w) => w.id)
})

/**
 * Pinned workspaces (derived)
 */
export const pinnedWorkspacesAtom = atom((get) => {
  const ids = get(pinnedWorkspaceIdsAtom)
  const map = get(workspacesMapAtom)

  return ids.map((id) => map.get(id)).filter((w): w is Workspace => w != null)
})

/**
 * Check if a workspace is pinned
 */
export const isWorkspacePinnedAtom = atom((get) => {
  return (workspaceId: string): boolean => {
    const ids = get(pinnedWorkspaceIdsAtom)
    return ids.includes(workspaceId)
  }
})

// =============================================================================
// Filtering & Grouping
// =============================================================================

/**
 * Active (non-archived) workspaces
 */
export const activeWorkspacesAtom = atom((get) => {
  const workspaces = get(workspacesAtom)
  return workspaces.filter((w) => w.state !== 'archived')
})

/**
 * Archived workspaces
 */
export const archivedWorkspacesAtom = atom((get) => {
  const workspaces = get(workspacesAtom)
  return workspaces.filter((w) => w.state === 'archived')
})

/**
 * Workspaces grouped by repository ID
 */
export const workspacesByRepoAtom = atom((get) => {
  const workspaces = get(activeWorkspacesAtom)
  const grouped = new Map<string, Workspace[]>()

  for (const workspace of workspaces) {
    const repoId = workspace.repositoryId ?? 'unknown'
    const existing = grouped.get(repoId) ?? []
    grouped.set(repoId, [...existing, workspace])
  }

  return grouped
})

/**
 * Workspaces with unread messages
 */
export const unreadWorkspacesAtom = atom((get) => {
  const workspaces = get(activeWorkspacesAtom)
  return workspaces.filter((w) => (w.unread ?? 0) > 0)
})

/**
 * Total unread count across all workspaces
 */
export const totalUnreadCountAtom = atom((get) => {
  const workspaces = get(activeWorkspacesAtom)
  return workspaces.reduce((sum, w) => sum + (w.unread ?? 0), 0)
})

// =============================================================================
// Actions - Update Workspaces
// =============================================================================

/**
 * Set all workspaces (replace entire state)
 */
export const setWorkspacesAtom = atom(null, (_get, set, workspaces: Workspace[]) => {
  const map = new Map<string, Workspace>()
  for (const w of workspaces) {
    map.set(w.id, w)
  }
  set(workspacesMapAtom, map)
})

/**
 * Add or update a single workspace
 */
export const upsertWorkspaceAtom = atom(null, (get, set, workspace: Workspace) => {
  const map = new Map(get(workspacesMapAtom))
  map.set(workspace.id, workspace)
  set(workspacesMapAtom, map)
})

/**
 * Remove a workspace
 */
export const removeWorkspaceAtom = atom(null, (get, set, workspaceId: string) => {
  const map = new Map(get(workspacesMapAtom))
  map.delete(workspaceId)
  set(workspacesMapAtom, map)

  // Clear active if it was the removed workspace
  const activeId = get(activeWorkspaceIdAtom)
  if (activeId === workspaceId) {
    set(activeWorkspaceIdAtom, null)
  }
})

/**
 * Update workspace fields (partial update)
 */
export const updateWorkspaceAtom = atom(
  null,
  (get, set, { id, update }: { id: string; update: Partial<Workspace> }) => {
    const map = get(workspacesMapAtom)
    const existing = map.get(id)
    if (!existing) return

    const updated = { ...existing, ...update, updatedAt: new Date().toISOString() }
    const newMap = new Map(map)
    newMap.set(id, updated)
    set(workspacesMapAtom, newMap)
  }
)

/**
 * Mark workspace unread count
 */
export const setWorkspaceUnreadAtom = atom(
  null,
  (_get, set, { id, count }: { id: string; count: number }) => {
    set(updateWorkspaceAtom, { id, update: { unread: count } })
  }
)

/**
 * Clear unread for a workspace
 */
export const clearWorkspaceUnreadAtom = atom(null, (_get, set, workspaceId: string) => {
  set(updateWorkspaceAtom, { id: workspaceId, update: { unread: 0 } })
})

// =============================================================================
// Actions - Sessions
// =============================================================================

/**
 * Set sessions for a workspace
 */
export const setWorkspaceSessionsAtom = atom(
  null,
  (get, set, { workspaceId, sessions }: { workspaceId: string; sessions: Session[] }) => {
    const outerMap = new Map(get(workspaceSessionsMapAtom))
    const sessionsMap = new Map<string, Session>()

    for (const session of sessions) {
      sessionsMap.set(session.id, session)
    }

    outerMap.set(workspaceId, sessionsMap)
    set(workspaceSessionsMapAtom, outerMap)
  }
)

/**
 * Add or update a session
 */
export const upsertSessionAtom = atom(
  null,
  (get, set, { workspaceId, session }: { workspaceId: string; session: Session }) => {
    const outerMap = new Map(get(workspaceSessionsMapAtom))
    const existingSessionsMap = outerMap.get(workspaceId) ?? new Map<string, Session>()
    const sessionsMap = new Map(existingSessionsMap)

    sessionsMap.set(session.id, session)
    outerMap.set(workspaceId, sessionsMap)
    set(workspaceSessionsMapAtom, outerMap)
  }
)

/**
 * Update session fields
 */
export const updateSessionAtom = atom(
  null,
  (
    get,
    set,
    {
      workspaceId,
      sessionId,
      update,
    }: { workspaceId: string; sessionId: string; update: Partial<Session> }
  ) => {
    const outerMap = get(workspaceSessionsMapAtom)
    const sessionsMap = outerMap.get(workspaceId)
    if (!sessionsMap) return

    const existing = sessionsMap.get(sessionId)
    if (!existing) return

    const updated = { ...existing, ...update, updatedAt: new Date().toISOString() }
    const newSessionsMap = new Map(sessionsMap)
    newSessionsMap.set(sessionId, updated)

    const newOuterMap = new Map(outerMap)
    newOuterMap.set(workspaceId, newSessionsMap)
    set(workspaceSessionsMapAtom, newOuterMap)
  }
)

/**
 * Remove a session
 */
export const removeSessionAtom = atom(
  null,
  (get, set, { workspaceId, sessionId }: { workspaceId: string; sessionId: string }) => {
    const outerMap = get(workspaceSessionsMapAtom)
    const sessionsMap = outerMap.get(workspaceId)
    if (!sessionsMap) return

    const newSessionsMap = new Map(sessionsMap)
    newSessionsMap.delete(sessionId)

    const newOuterMap = new Map(outerMap)
    newOuterMap.set(workspaceId, newSessionsMap)
    set(workspaceSessionsMapAtom, newOuterMap)

    // Clear active session if removed
    const activeId = get(activeSessionIdAtom)
    if (activeId === sessionId) {
      set(activeSessionIdAtom, null)
    }
  }
)
