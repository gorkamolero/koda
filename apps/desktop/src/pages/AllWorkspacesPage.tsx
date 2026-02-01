import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useAllWorktrees, useRepos } from '@/hooks/useRpc'
import { cn } from '@/lib/utils'
import { WorktreeStatusBadge } from '@/components/WorktreeStatusBadge'
import type { Worktree, WorktreeStatus } from '@/lib/rpc'
import {
  Search,
  Filter,
  Loader2,
  Archive,
  ChevronLeft,
  FolderPlus,
} from 'lucide-react'

// ============================================================================
// Status Filter Options
// ============================================================================

type StatusFilter = 'all' | 'active' | 'archived' | WorktreeStatus

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'needs-review', label: 'Needs Review' },
  { id: 'archived', label: 'Archived' },
]

// ============================================================================
// Workspace Card
// ============================================================================

function WorkspaceCard({ workspace }: { workspace: Worktree }) {
  const status = workspace.manualStatus ?? workspace.derivedStatus
  const isArchived = workspace.state === 'archived'
  const displayName = workspace.branch ?? workspace.worktreePath?.split('/').pop() ?? 'unnamed'

  return (
    <Link
      to="/workspace/$id"
      params={{ id: workspace.id }}
      className={cn(
        'block p-4 rounded-lg border transition-colors',
        'hover:bg-surface-hover',
        isArchived
          ? 'border-border-subtle bg-surface-inset opacity-60'
          : 'border-border-subtle bg-surface-base'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-text-primary truncate">
              {displayName}
            </h3>
            {isArchived && (
              <Archive className="w-3.5 h-3.5 text-text-dim flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-text-faint mt-0.5 truncate">
            {workspace.worktreePath?.split('/').pop() ?? workspace.branch}
          </p>
        </div>
        <WorktreeStatusBadge status={status} />
      </div>

      {workspace.updatedAt && (
        <p className="text-xs text-text-faint mt-2">
          Updated {new Date(workspace.updatedAt).toLocaleDateString()}
        </p>
      )}
    </Link>
  )
}

// ============================================================================
// All Workspaces Page
// ============================================================================

export function AllWorkspacesPage() {
  const { data: workspaces, isLoading: loadingWorkspaces } = useAllWorktrees(true)
  const { data: repos } = useRepos()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Create repo lookup map
  const repoMap = useMemo(() => {
    const map = new Map<string, string>()
    if (repos) {
      for (const repo of repos) {
        map.set(repo.id, repo.name ?? repo.rootPath.split('/').pop() ?? 'Unknown')
      }
    }
    return map
  }, [repos])

  // Filter workspaces
  const filteredWorkspaces = useMemo(() => {
    if (!workspaces) return []

    return workspaces.filter((ws) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesBranch = ws.branch?.toLowerCase().includes(query)
        const matchesPath = ws.worktreePath?.toLowerCase().includes(query)
        if (!matchesBranch && !matchesPath) return false
      }

      // Status filter
      const status = ws.manualStatus ?? ws.derivedStatus
      const isArchived = ws.state === 'archived'

      if (statusFilter === 'all') return true
      if (statusFilter === 'active') return !isArchived
      if (statusFilter === 'archived') return isArchived
      return status === statusFilter
    })
  }, [workspaces, searchQuery, statusFilter])

  // Group by repo
  const groupedWorkspaces = useMemo(() => {
    const groups = new Map<string, Worktree[]>()

    for (const ws of filteredWorkspaces) {
      const repoId = ws.repoId ?? 'unknown'
      if (!groups.has(repoId)) {
        groups.set(repoId, [])
      }
      groups.get(repoId)?.push(ws)
    }

    // Sort within each group by updatedAt
    for (const group of groups.values()) {
      group.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
    }

    return groups
  }, [filteredWorkspaces])

  return (
    <div className="h-full flex flex-col bg-surface-base">
      {/* Header */}
      <header className="border-b border-border-subtle px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">All Workspaces</h1>
            <p className="text-sm text-text-faint">
              {filteredWorkspaces.length} workspace{filteredWorkspaces.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="border-b border-border-subtle px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value) }}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border-subtle bg-surface-inset text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-text-dim mr-1" />
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => { setStatusFilter(filter.id) }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  statusFilter === filter.id
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loadingWorkspaces ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="text-center py-12">
            <FolderPlus className="w-12 h-12 text-text-dim mx-auto mb-3" />
            <p className="text-text-muted">No workspaces found</p>
            {searchQuery && (
              <p className="text-text-faint text-sm mt-1">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(groupedWorkspaces.entries()).map(([repoId, workspaceList]) => (
              <div key={repoId}>
                <h2 className="text-sm font-medium text-text-muted mb-3">
                  {repoMap.get(repoId) ?? 'Unknown Repository'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workspaceList.map((ws) => (
                    <WorkspaceCard key={ws.id} workspace={ws} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
