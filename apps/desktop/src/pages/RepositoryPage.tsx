import { useState, useMemo } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useRepo, useWorkspaces } from '@/hooks/useRpc'
import { cn } from '@/lib/utils'
import type { Workspace, WorkspaceStatus } from '@/lib/rpc'
import {
  ChevronLeft,
  Plus,
  FolderOpen,
  ExternalLink,
  GitBranch,
  Loader2,
  Check,
  AlertCircle,
  Archive,
  Settings,
} from 'lucide-react'

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status?: WorkspaceStatus | null }) {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    done: { icon: <Check className="w-3 h-3" />, color: 'text-green-500 bg-green-500/10' },
    blocked: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-orange-500 bg-orange-500/10' },
    'needs-review': { icon: <AlertCircle className="w-3 h-3" />, color: 'text-yellow-500 bg-yellow-500/10' },
    'in-progress': { icon: null, color: 'text-blue-500 bg-blue-500/10' },
  }

  const cfg = status ? config[status] : null
  if (!cfg) return null

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', cfg.color)}>
      {cfg.icon}
      {status}
    </span>
  )
}

// ============================================================================
// Workspace Row
// ============================================================================

function WorkspaceRow({ workspace }: { workspace: Workspace }) {
  const status = workspace.manualStatus ?? workspace.derivedStatus
  const isArchived = workspace.state === 'archived'

  return (
    <Link
      to="/workspace/$id"
      params={{ id: workspace.id }}
      className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors',
        'hover:bg-surface-hover',
        isArchived
          ? 'border-border-subtle bg-surface-inset opacity-60'
          : 'border-border-subtle bg-surface-base'
      )}
    >
      <GitBranch className="w-4 h-4 text-text-dim flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {workspace.branch ?? workspace.directoryName}
          </span>
          {isArchived && (
            <Archive className="w-3.5 h-3.5 text-text-dim" />
          )}
        </div>
        <span className="text-xs text-text-faint">{workspace.directoryName}</span>
      </div>

      <StatusBadge status={status} />

      {workspace.updatedAt && (
        <span className="text-xs text-text-faint flex-shrink-0">
          {new Date(workspace.updatedAt).toLocaleDateString()}
        </span>
      )}
    </Link>
  )
}

// ============================================================================
// Repository Page
// ============================================================================

export function RepositoryPage() {
  const { repoId } = useParams({ from: '/repository/$repoId' })
  const { data: repo, isLoading: loadingRepo } = useRepo(repoId)
  const { data: allWorkspaces, isLoading: loadingWorkspaces } = useWorkspaces()
  const [showArchived, setShowArchived] = useState(false)

  // Filter workspaces for this repo
  const { activeWorkspaces, archivedWorkspaces } = useMemo(() => {
    if (!allWorkspaces) return { activeWorkspaces: [], archivedWorkspaces: [] }

    const repoWorkspaces = allWorkspaces.filter((ws) => ws.repositoryId === repoId)

    const active = repoWorkspaces.filter((ws) => ws.state !== 'archived')
    const archived = repoWorkspaces.filter((ws) => ws.state === 'archived')

    // Sort by updatedAt
    const sortByUpdated = (a: Workspace, b: Workspace) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bTime - aTime
    }

    active.sort(sortByUpdated)
    archived.sort(sortByUpdated)

    return { activeWorkspaces: active, archivedWorkspaces: archived }
  }, [allWorkspaces, repoId])

  const isLoading = loadingRepo || loadingWorkspaces
  const repoName = repo?.name ?? repo?.rootPath.split('/').pop() ?? 'Repository'

  return (
    <div className="h-full flex flex-col bg-surface-base">
      {/* Header */}
      <header className="border-b border-border-subtle px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">{repoName}</h1>
              {repo && (
                <p className="text-sm text-text-faint truncate max-w-md">{repo.rootPath}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
              onClick={() => {
                // TODO: Open in Finder
                console.log('Open:', repo?.rootPath)
              }}
            >
              <FolderOpen className="w-4 h-4" />
              Open
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
              onClick={() => {
                // TODO: Open in editor
                console.log('Editor:', repo?.rootPath)
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Editor
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <Link
              to="/"
              search={{ repoId }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </Link>
          </div>
        </div>
      </header>

      {/* Stats */}
      {repo && (
        <div className="border-b border-border-subtle px-6 py-3">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-text-faint">Active:</span>{' '}
              <span className="text-text-primary font-medium">{String(activeWorkspaces.length)}</span>
            </div>
            <div>
              <span className="text-text-faint">Archived:</span>{' '}
              <span className="text-text-muted">{String(archivedWorkspaces.length)}</span>
            </div>
            {repo.defaultBranch && (
              <div>
                <span className="text-text-faint">Default branch:</span>{' '}
                <span className="text-text-muted">{repo.defaultBranch}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Workspaces */}
            <div>
              <h2 className="text-sm font-medium text-text-muted mb-3">
                Active Workspaces ({String(activeWorkspaces.length)})
              </h2>
              {activeWorkspaces.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border-subtle rounded-lg">
                  <p className="text-text-muted">No active workspaces</p>
                  <Link
                    to="/"
                    search={{ repoId }}
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Workspace
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeWorkspaces.map((ws) => (
                    <WorkspaceRow key={ws.id} workspace={ws} />
                  ))}
                </div>
              )}
            </div>

            {/* Archived Workspaces */}
            {archivedWorkspaces.length > 0 && (
              <div>
                <button
                  onClick={() => { setShowArchived(!showArchived) }}
                  className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors mb-3"
                >
                  <Archive className="w-4 h-4" />
                  Archived ({String(archivedWorkspaces.length)})
                  <span className="text-xs text-text-faint">
                    {showArchived ? 'Hide' : 'Show'}
                  </span>
                </button>
                {showArchived && (
                  <div className="space-y-2">
                    {archivedWorkspaces.map((ws) => (
                      <WorkspaceRow key={ws.id} workspace={ws} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
