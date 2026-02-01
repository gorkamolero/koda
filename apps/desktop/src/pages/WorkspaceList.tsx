import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { useAllWorktrees, useRepos, useCreateRepo, useCreateWorktree, useCreateStandaloneWorkspace } from '@/hooks/useRpc'
import type { Worktree, WorktreeStatus } from '@/lib/rpc'
import { cn } from '@/lib/utils'
import {
  Archive,
  ArchiveRestore,
  Check,
  AlertCircle,
} from 'lucide-react'

type CreateMode = 'choose' | 'repo' | 'branch' | 'standalone'

// ============================================================================
// Status Indicator
// ============================================================================

interface StatusConfig {
  icon: React.ReactNode
  colorClass: string
}

function getStatusConfig(status?: WorktreeStatus | null): StatusConfig {
  if (status === 'done') {
    return { icon: <Check className="w-3.5 h-3.5" />, colorClass: 'text-green-500' }
  }
  if (status === 'blocked' || status === 'needs-review') {
    return { icon: <AlertCircle className="w-3.5 h-3.5" />, colorClass: 'text-orange-500' }
  }
  return {
    icon: <span className="w-1.5 h-1.5 rounded-full bg-current" />,
    colorClass: 'text-text-dim',
  }
}

// ============================================================================
// Time Ago Helper
// ============================================================================

function formatTimeAgo(date: string | null | undefined): string {
  if (!date) return ''

  const diffMs = Date.now() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${String(diffMins)}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${String(diffHours)}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${String(diffDays)}d ago`
}

// ============================================================================
// Workspace Card (Sidebar-style design)
// ============================================================================

function WorkspaceCard({ workspace, onClick }: { workspace: Worktree; onClick: () => void }) {
  const status = workspace.manualStatus ?? workspace.derivedStatus
  const { icon, colorClass } = getStatusConfig(status)
  const isArchived = workspace.state === 'archived'
  const displayName = workspace.branch ?? workspace.worktreePath?.split('/').pop() ?? 'unnamed'
  const timeAgo = formatTimeAgo(workspace.updatedAt)

  return (
    <button
      data-testid="workspace-card"
      onClick={onClick}
      className={cn(
        'group relative flex items-start gap-3 p-3 rounded-lg border transition-colors text-left w-full',
        'hover:bg-surface-hover hover:border-border-accent',
        isArchived
          ? 'border-border-subtle bg-surface-inset opacity-60'
          : 'border-border-subtle bg-surface-base'
      )}
    >
      {/* Status icon */}
      <div className={cn('mt-0.5 flex-shrink-0 flex items-center justify-center w-4', colorClass)}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {displayName}
          </span>
          {isArchived && (
            <Archive className="w-3 h-3 text-text-dim flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-faint mt-0.5">
          <span className="truncate">{workspace.branch || 'no branch'}</span>
          {timeAgo && (
            <>
              <span>·</span>
              <span>{timeAgo}</span>
            </>
          )}
        </div>
      </div>

      {/* Archive action - floating icon button on hover */}
      <div
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'p-1.5 rounded-md hover:bg-surface-control text-text-muted hover:text-text-primary'
        )}
        onClick={(e) => {
          e.stopPropagation()
          // TODO: Implement archive/restore
          console.log(isArchived ? 'Restore:' : 'Archive:', workspace.id)
        }}
        role="button"
        tabIndex={0}
        title={isArchived ? 'Restore' : 'Archive'}
      >
        {isArchived ? (
          <ArchiveRestore className="w-4 h-4" />
        ) : (
          <Archive className="w-4 h-4" />
        )}
      </div>
    </button>
  )
}

export function WorkspaceList() {
  const navigate = useNavigate()
  const { data: workspaces, isLoading: loadingWorkspaces, error: workspacesError } = useAllWorktrees()
  const { data: repos, isLoading: loadingRepos } = useRepos()
  const createRepo = useCreateRepo()
  const createWorktree = useCreateWorktree()
  const createStandaloneWorkspace = useCreateStandaloneWorkspace()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('choose')
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [branchName, setBranchName] = useState('')
  const [standaloneName, setStandaloneName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Git Repository',
      })

      if (selected && typeof selected === 'string') {
        const repo = await createRepo.mutateAsync({ rootPath: selected })
        setSelectedRepoId(repo.id)
        setCreateMode('branch')
        setCreateError(null)
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to register repo')
    }
  }

  const handleCreateWorktree = async () => {
    if (!selectedRepoId || !branchName.trim()) return

    try {
      const worktree = await createWorktree.mutateAsync({
        repoId: selectedRepoId,
        branch: branchName.trim(),
      })
      setIsCreateOpen(false)
      setBranchName('')
      setSelectedRepoId('')
      setCreateMode('choose')
      void navigate({ to: '/workspace/$id', params: { id: worktree.id } })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace')
    }
  }

  const handleCreateStandalone = async () => {
    if (!standaloneName.trim()) return

    try {
      const workspace = await createStandaloneWorkspace.mutateAsync({
        name: standaloneName.trim(),
      })
      setIsCreateOpen(false)
      setStandaloneName('')
      setCreateMode('choose')
      void navigate({ to: '/workspace/$id', params: { id: workspace.id } })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace')
    }
  }

  const handleWorkspaceClick = (workspace: Worktree) => {
    void navigate({ to: '/workspace/$id', params: { id: workspace.id } })
  }

  const handleRepoSelect = (repoId: string) => {
    setSelectedRepoId(repoId)
    setCreateMode('branch')
  }

  const closeModal = () => {
    setIsCreateOpen(false)
    setBranchName('')
    setSelectedRepoId('')
    setStandaloneName('')
    setCreateMode('choose')
    setCreateError(null)
  }

  const isLoading = loadingWorkspaces || loadingRepos
  const selectedRepo = repos?.find((r) => r.id === selectedRepoId)

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    )
  }

  if (workspacesError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-destructive">
          <p>Failed to load workspaces</p>
          <p className="text-sm mt-1">{workspacesError instanceof Error ? workspacesError.message : 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const hasWorkspaces = workspaces && workspaces.length > 0
  const hasRepos = repos && repos.length > 0

  return (
    <div className="h-full flex flex-col p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Workspaces</h1>
          <p className="text-text-muted">
            Manage your agent workspaces and review their work
          </p>
        </div>
        <button
          onClick={() => { setIsCreateOpen(true); }}
          data-testid="new-workspace-button"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-surface-control hover:bg-surface-control-hover text-text-primary h-10 px-4 py-2 transition-colors"
        >
          New Workspace
        </button>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-card border border-border-subtle rounded-lg p-6 w-full max-w-lg shadow-xl">
            {/* Step 1: Choose workspace type */}
            {createMode === 'choose' && (
              <>
                <h2 className="text-lg font-semibold text-text-primary mb-4">New Workspace</h2>

                <p className="text-sm text-text-muted mb-4">
                  Choose how to create your workspace.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => { setCreateMode('repo') }}
                    data-testid="create-with-repo"
                    className="w-full text-left p-4 border border-border-subtle rounded-md hover:border-border-accent hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <div>
                        <div className="font-medium text-text-primary">With Repository</div>
                        <div className="text-xs text-text-faint">Connect a git repository and create a worktree branch</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setCreateMode('standalone') }}
                    data-testid="create-standalone"
                    className="w-full text-left p-4 border border-border-subtle rounded-md hover:border-border-accent hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <div>
                        <div className="font-medium text-text-primary">Standalone</div>
                        <div className="text-xs text-text-faint">Create workspace first, connect repository later</div>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-md hover:bg-surface-hover text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Step 2a: Select repository */}
            {createMode === 'repo' && (
              <>
                <h2 className="text-lg font-semibold text-text-primary mb-4">New Workspace</h2>

                {createError && (
                  <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {createError}
                  </div>
                )}

                <p className="text-sm text-text-muted mb-4">
                  Select a git repository to create a new workspace branch.
                </p>

                {/* Existing repos */}
                {hasRepos && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-text-primary mb-2">Recent Repositories</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto" data-testid="repo-list">
                      {repos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => { handleRepoSelect(repo.id); }}
                          data-testid={`repo-button-${repo.id}`}
                          className="w-full text-left p-3 border border-border-subtle rounded-md hover:border-border-accent hover:bg-surface-hover transition-colors"
                        >
                          <div className="font-medium text-text-primary">{repo.name}</div>
                          <div className="text-xs text-text-faint truncate">{repo.rootPath}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new repo */}
                <button
                  onClick={() => void handleSelectFolder()}
                  disabled={createRepo.isPending}
                  className="w-full p-4 border-2 border-dashed border-border-subtle rounded-md hover:border-border-accent hover:bg-surface-hover transition-colors flex items-center justify-center gap-2 text-text-muted hover:text-text-primary"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {createRepo.isPending ? 'Registering...' : 'Add Git Repository'}
                </button>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => { setCreateMode('choose') }}
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-md hover:bg-surface-hover text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Step 2b: Standalone workspace name */}
            {createMode === 'standalone' && (
              <>
                <h2 className="text-lg font-semibold text-text-primary mb-4">Standalone Workspace</h2>

                {createError && (
                  <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {createError}
                  </div>
                )}

                <p className="text-sm text-text-muted mb-4">
                  Create a workspace without a repository. You can connect one later.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Workspace Name</label>
                    <input
                      type="text"
                      value={standaloneName}
                      onChange={(e) => { setStandaloneName(e.target.value) }}
                      placeholder="My Workspace"
                      data-testid="standalone-name-input"
                      className="w-full px-3 py-2 border border-border-subtle rounded-md bg-surface-control text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-border-accent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleCreateStandalone()
                        if (e.key === 'Escape') closeModal()
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => { setCreateMode('choose') }}
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                  >
                    Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-md hover:bg-surface-hover text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleCreateStandalone()}
                      disabled={!standaloneName.trim() || createStandaloneWorkspace.isPending}
                      data-testid="create-standalone-button"
                      className="px-4 py-2 text-sm font-medium bg-surface-control hover:bg-surface-control-hover text-text-primary rounded-md disabled:opacity-50 transition-colors"
                    >
                      {createStandaloneWorkspace.isPending ? 'Creating...' : 'Create Workspace'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Branch name (for repo-based) */}
            {createMode === 'branch' && (
              <>
                <h2 className="text-lg font-semibold text-text-primary mb-4">Create Branch</h2>

                {createError && (
                  <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {createError}
                  </div>
                )}

                <div className="mb-4 p-3 rounded-md bg-surface-item">
                  <div className="text-sm font-medium text-text-primary">{selectedRepo?.name}</div>
                  <div className="text-xs text-text-faint">{selectedRepo?.rootPath}</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Branch Name</label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => { setBranchName(e.target.value); }}
                      placeholder="feature/my-feature"
                      className="w-full px-3 py-2 border border-border-subtle rounded-md bg-surface-control text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-border-accent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleCreateWorktree()
                        if (e.key === 'Escape') closeModal()
                      }}
                    />
                    <p className="text-xs text-text-faint mt-1">
                      A git worktree will be created for isolated work
                    </p>
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => { setCreateMode('repo'); }}
                    data-testid="modal-back-button"
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                  >
                    Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-md hover:bg-surface-hover text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleCreateWorktree()}
                      disabled={!branchName.trim() || createWorktree.isPending}
                      className="px-4 py-2 text-sm font-medium bg-surface-control hover:bg-surface-control-hover text-text-primary rounded-md disabled:opacity-50 transition-colors"
                    >
                      {createWorktree.isPending ? 'Creating...' : 'Create Workspace'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Workspace List or Empty State */}
      {hasWorkspaces ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" data-testid="workspace-grid">
          {workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              onClick={() => { handleWorkspaceClick(workspace); }}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center" data-testid="empty-state">
          <div className="text-center max-w-md px-8">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-text-dim"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-text-muted mb-1">
              No workspaces yet
            </h3>
            <p className="text-xs text-text-faint mb-4">
              Add a repository to get started
            </p>
            <button
              onClick={() => { setIsCreateOpen(true); }}
              data-testid="new-workspace-button-empty"
              className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium bg-surface-control hover:bg-surface-control-hover text-text-primary h-9 px-4 py-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
