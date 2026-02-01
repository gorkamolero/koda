import { atom } from 'jotai'
import type { Worktree, Session, WorktreeStatus } from '@/lib/rpc'

/**
 * Worktree Store - Conductor-style state management
 *
 * NOTE: This store manages "worktrees" which are git worktrees tied to repos.
 * The naming uses "workspace" in some places for backwards compatibility with
 * the UI, but the underlying data is worktrees.
 *
 * In the new model:
 * - Workspace = pure container (just name/description)
 * - Worktree = git worktree (has branch, repoId, workspaceIds[])
 */

// =============================================================================
// Core Worktree State (UI calls these "workspaces" for now)
// =============================================================================

/**
 * All worktrees, keyed by ID for O(1) lookups
 */
export const workspacesMapAtom = atom<Map<string, Worktree>>(new Map())

/**
 * All worktrees as array (derived, for iteration)
 */
export const workspacesAtom = atom((get) => {
  const map = get(workspacesMapAtom)
  return Array.from(map.values())
})

/**
 * Currently active worktree ID
 */
export const activeWorkspaceIdAtom = atom<string | null>(null)

/**
 * Currently active worktree (derived)
 */
export const activeWorkspaceAtom = atom((get) => {
  const id = get(activeWorkspaceIdAtom)
  if (!id) return null
  const map = get(workspacesMapAtom)
  return map.get(id) ?? null
})

/**
 * Set the active worktree
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
 * Sessions keyed by worktree ID -> session ID -> Session
 */
export const workspaceSessionsMapAtom = atom<Map<string, Map<string, Session>>>(
  new Map()
)

/**
 * Get sessions for a specific worktree
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
 * Active session for the current worktree (derived)
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
// Worktree Status (Conductor-style)
// =============================================================================

/**
 * Get effective status for a worktree
 * Manual status overrides derived status if set
 */
export const getWorkspaceStatusAtom = atom((get) => {
  return (workspaceId: string): WorktreeStatus => {
    const map = get(workspacesMapAtom)
    const worktree = map.get(workspaceId)
    if (!worktree) return 'in-progress'

    // Manual status takes precedence
    if (worktree.manualStatus) {
      return worktree.manualStatus
    }

    return worktree.derivedStatus ?? 'in-progress'
  }
})

// =============================================================================
// Pinning Support
// =============================================================================

/**
 * IDs of pinned worktrees, sorted by pin time (most recent first)
 */
export const pinnedWorkspaceIdsAtom = atom((get) => {
  const worktrees = get(workspacesAtom)

  return worktrees
    .filter((w) => w.pinnedAt != null)
    .sort((a, b) => {
      const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
      const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
      return bTime - aTime // Most recent first
    })
    .map((w) => w.id)
})

/**
 * Pinned worktrees (derived)
 */
export const pinnedWorkspacesAtom = atom((get) => {
  const ids = get(pinnedWorkspaceIdsAtom)
  const map = get(workspacesMapAtom)

  return ids.map((id) => map.get(id)).filter((w): w is Worktree => w != null)
})

/**
 * Check if a worktree is pinned
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
 * Active (non-archived) worktrees
 */
export const activeWorkspacesAtom = atom((get) => {
  const worktrees = get(workspacesAtom)
  return worktrees.filter((w) => w.state !== 'archived')
})

/**
 * Archived worktrees
 */
export const archivedWorkspacesAtom = atom((get) => {
  const worktrees = get(workspacesAtom)
  return worktrees.filter((w) => w.state === 'archived')
})

/**
 * Worktrees grouped by repository ID
 */
export const workspacesByRepoAtom = atom((get) => {
  const worktrees = get(activeWorkspacesAtom)
  const grouped = new Map<string, Worktree[]>()

  for (const worktree of worktrees) {
    const repoId = worktree.repoId ?? 'unknown'
    const existing = grouped.get(repoId) ?? []
    grouped.set(repoId, [...existing, worktree])
  }

  return grouped
})

/**
 * Worktrees with unread messages
 */
export const unreadWorkspacesAtom = atom((get) => {
  const worktrees = get(activeWorkspacesAtom)
  return worktrees.filter((w) => (w.unread ?? 0) > 0)
})

/**
 * Total unread count across all worktrees
 */
export const totalUnreadCountAtom = atom((get) => {
  const worktrees = get(activeWorkspacesAtom)
  return worktrees.reduce((sum, w) => sum + (w.unread ?? 0), 0)
})

// =============================================================================
// Actions - Update Worktrees
// =============================================================================

/**
 * Set all worktrees (replace entire state)
 */
export const setWorkspacesAtom = atom(null, (_get, set, worktrees: Worktree[]) => {
  const map = new Map<string, Worktree>()
  for (const w of worktrees) {
    map.set(w.id, w)
  }
  set(workspacesMapAtom, map)
})

/**
 * Add or update a single worktree
 */
export const upsertWorkspaceAtom = atom(null, (get, set, worktree: Worktree) => {
  const map = new Map(get(workspacesMapAtom))
  map.set(worktree.id, worktree)
  set(workspacesMapAtom, map)
})

/**
 * Remove a worktree
 */
export const removeWorkspaceAtom = atom(null, (get, set, workspaceId: string) => {
  const map = new Map(get(workspacesMapAtom))
  map.delete(workspaceId)
  set(workspacesMapAtom, map)

  // Clear active if it was the removed worktree
  const activeId = get(activeWorkspaceIdAtom)
  if (activeId === workspaceId) {
    set(activeWorkspaceIdAtom, null)
  }
})

/**
 * Update worktree fields (partial update)
 */
export const updateWorkspaceAtom = atom(
  null,
  (get, set, { id, update }: { id: string; update: Partial<Worktree> }) => {
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
 * Mark worktree unread count
 */
export const setWorkspaceUnreadAtom = atom(
  null,
  (_get, set, { id, count }: { id: string; count: number }) => {
    set(updateWorkspaceAtom, { id, update: { unread: count } })
  }
)

/**
 * Clear unread for a worktree
 */
export const clearWorkspaceUnreadAtom = atom(null, (_get, set, workspaceId: string) => {
  set(updateWorkspaceAtom, { id: workspaceId, update: { unread: 0 } })
})

// =============================================================================
// Actions - Sessions
// =============================================================================

/**
 * Set sessions for a worktree
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

// =============================================================================
// Type aliases for backwards compatibility
// =============================================================================

/** @deprecated Use Worktree instead */
export type Workspace = Worktree
