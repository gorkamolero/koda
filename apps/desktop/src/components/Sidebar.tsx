import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useWorkspaces, useRepos, useSidecar, useWorkspaceDiffStats } from '@/hooks/useRpc'
import { cn } from '@/lib/utils'
import type { Workspace, Repo, WorkspaceStatus } from '@/lib/rpc'
import { useState, useMemo } from 'react'
import {
  Plus,
  Settings,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Check,
  AlertCircle,
  Loader2,
  HelpCircle,
  Archive,
  FolderPlus,
} from 'lucide-react'

// ============================================================================
// Usage Bar (kept and restyled)
// ============================================================================

function UsageBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const percent = Math.min(100, Math.round((value / max) * 100))
  const isHigh = percent > 80

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-faint">{label}</span>
        <span className={cn('text-text-muted', isHigh && 'text-orange-400')}>
          {String(percent)}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-surface-inset overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isHigh
              ? 'bg-gradient-to-r from-orange-500 to-red-500'
              : 'bg-gradient-to-r from-blue-500 to-emerald-500'
          )}
          style={{ width: `${String(percent)}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Status Indicators
// ============================================================================

function getStatusConfig(status?: WorkspaceStatus | null): {
  icon: React.ReactNode
  colorClass: string
} {
  switch (status) {
    case 'done':
      return {
        icon: <Check className="w-3.5 h-3.5" />,
        colorClass: 'text-green-500',
      }
    case 'blocked':
    case 'needs-review':
      return {
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        colorClass: 'text-orange-500',
      }
    case 'in-progress':
    default:
      return {
        icon: <span className="w-1.5 h-1.5 rounded-full bg-current" />,
        colorClass: 'text-text-dim',
      }
  }
}

// ============================================================================
// Diff Stats Badge
// ============================================================================

function DiffStatsBadge({ workspaceId }: { workspaceId: string }) {
  const { data: stats } = useWorkspaceDiffStats(workspaceId)

  if (!stats || (stats.additions === 0 && stats.deletions === 0)) {
    return null
  }

  return (
    <div className="flex items-center gap-0.5 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-inset">
      {stats.additions > 0 && (
        <span className="text-green-500">+{String(stats.additions)}</span>
      )}
      {stats.deletions > 0 && (
        <span className="text-red-400 ml-0.5">-{String(stats.deletions)}</span>
      )}
    </div>
  )
}

// ============================================================================
// Time Ago Helper
// ============================================================================

function formatTimeAgo(date: string | null | undefined): string {
  if (!date) return ''

  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${String(diffMins)}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${String(diffHours)}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${String(diffDays)}d ago`
}

// ============================================================================
// Workspace Row
// ============================================================================

function WorkspaceRow({
  workspace,
  isActive,
}: {
  workspace: Workspace
  isActive: boolean
}) {
  const status = workspace.manualStatus ?? workspace.derivedStatus
  const { icon, colorClass } = getStatusConfig(status)
  const timeAgo = formatTimeAgo(workspace.updatedAt)

  return (
    <Link
      to="/workspace/$id"
      params={{ id: workspace.id }}
      className={cn(
        'group flex items-start gap-2 px-3 py-2 rounded-md transition-colors',
        'hover:bg-surface-hover',
        isActive && 'bg-surface-active'
      )}
    >
      {/* Status icon */}
      <div className={cn('mt-1 flex-shrink-0 flex items-center justify-center w-4', colorClass)}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-primary text-sm font-medium truncate">
            {workspace.branch ?? workspace.directoryName}
          </span>
          <DiffStatsBadge workspaceId={workspace.id} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-faint">
          <span className="truncate">{workspace.directoryName}</span>
          {timeAgo && (
            <>
              <span>·</span>
              <span>{timeAgo}</span>
            </>
          )}
        </div>
      </div>

      {/* Archive action (visible on hover) */}
      <button
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'p-1 rounded hover:bg-surface-control text-text-muted hover:text-text-primary',
          'flex items-center gap-1 text-xs'
        )}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          // TODO: Implement archive
          console.log('Archive workspace:', workspace.id)
        }}
        title="Archive"
      >
        <Archive className="w-3.5 h-3.5" />
        <span>Archive</span>
      </button>
    </Link>
  )
}

// ============================================================================
// Repo Group
// ============================================================================

function RepoGroup({
  repo,
  workspaces,
  activeWorkspaceId,
}: {
  repo: Repo
  workspaces: Workspace[]
  activeWorkspaceId?: string
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const repoName = repo.name ?? repo.rootPath.split('/').pop() ?? 'Repository'
  const initial = (repoName[0] ?? 'R').toUpperCase()

  return (
    <div className="mb-3">
      {/* Repo header */}
      <div className="flex items-center gap-1 group">
        <button
          onClick={() => { setIsExpanded(!isExpanded) }}
          className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
        >
          {/* Avatar */}
          <div className="w-6 h-6 rounded bg-surface-control flex items-center justify-center text-xs font-semibold text-text-muted">
            {initial}
          </div>

          {/* Name */}
          <span className="text-text-primary text-sm font-medium truncate flex-1 text-left">
            {repoName}
          </span>

          {/* Chevron */}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-dim flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-dim flex-shrink-0" />
          )}
        </button>

        {/* Actions (visible on hover) */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1 rounded hover:bg-surface-control text-text-muted hover:text-text-primary"
            title="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-surface-control text-text-muted hover:text-text-primary"
            title="New workspace"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Workspaces */}
      {isExpanded && (
        <div className="ml-2 mt-1">
          {workspaces.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-faint italic">No workspaces</div>
          ) : (
            workspaces.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                workspace={ws}
                isActive={ws.id === activeWorkspaceId}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sidebar Header
// ============================================================================

function SidebarHeader() {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
      <div className="flex items-center gap-2">
        {/* Workspaces icon */}
        <svg
          className="w-5 h-5 text-text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span className="text-text-primary font-semibold">Workspaces</span>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          onClick={() => { void navigate({ to: '/' }) }}
          title="Back"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          title="Forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Sidebar Footer
// ============================================================================

function SidebarFooter() {
  const { status } = useSidecar()
  const navigate = useNavigate()

  return (
    <div className="border-t border-border-subtle">
      {/* Usage stats (kept from original) */}
      <div className="px-4 py-3 space-y-2 border-b border-border-subtle">
        <UsageBar label="Session" value={45} max={100} />
        <UsageBar label="Weekly" value={230} max={1000} />
      </div>

      {/* Add repository button */}
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        onClick={() => { void navigate({ to: '/' }) }}
      >
        <FolderPlus className="w-4 h-4" />
        <span className="text-sm">Add repository</span>
      </button>

      {/* Bottom icons */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          {/* Sidecar status dot */}
          <span
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              status?.running ? 'bg-green-500' : 'bg-gray-500'
            )}
            title={status?.running ? 'Connected' : 'Disconnected'}
          />
          <span className="text-xs text-text-faint">
            {status?.running ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <Link
            to="/settings"
            className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Workspace List (grouped by repo)
// ============================================================================

function WorkspaceList() {
  const { data: workspaces, isLoading: loadingWorkspaces } = useWorkspaces()
  const { data: repos, isLoading: loadingRepos } = useRepos()
  const params = useParams({ strict: false })
  const activeId = (params as { id?: string }).id

  // Group workspaces by repository
  const groupedWorkspaces = useMemo(() => {
    if (!workspaces || !repos) return new Map<string, { repo: Repo; workspaces: Workspace[] }>()

    const groups = new Map<string, { repo: Repo; workspaces: Workspace[] }>()

    // Initialize groups for all repos
    for (const repo of repos) {
      groups.set(repo.id, { repo, workspaces: [] })
    }

    // Add workspaces to their repos (only non-archived)
    for (const ws of workspaces) {
      if (ws.state === 'archived') continue
      if (ws.repositoryId && groups.has(ws.repositoryId)) {
        groups.get(ws.repositoryId)?.workspaces.push(ws)
      }
    }

    // Sort workspaces within each group by updatedAt (most recent first)
    for (const group of groups.values()) {
      group.workspaces.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
    }

    return groups
  }, [workspaces, repos])

  if (loadingWorkspaces || loadingRepos) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    )
  }

  if (groupedWorkspaces.size === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <FolderPlus className="w-10 h-10 text-text-dim mx-auto mb-3" />
        <p className="text-text-muted text-sm mb-1">No repositories yet</p>
        <p className="text-text-faint text-xs">Add a repository to get started</p>
      </div>
    )
  }

  return (
    <div className="px-2">
      {Array.from(groupedWorkspaces.values()).map(({ repo, workspaces: repoWorkspaces }) => (
        <RepoGroup
          key={repo.id}
          repo={repo}
          workspaces={repoWorkspaces}
          activeWorkspaceId={activeId}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Main Sidebar
// ============================================================================

export function Sidebar() {
  return (
    <div className="flex flex-col h-full bg-surface-base">
      <SidebarHeader />

      <div className="flex-1 overflow-y-auto py-2">
        <WorkspaceList />
      </div>

      <SidebarFooter />
    </div>
  )
}
