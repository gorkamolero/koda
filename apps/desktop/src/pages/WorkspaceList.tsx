import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { useAllWorktrees, useRepos, useCreateRepo, useCreateWorktree } from '@/hooks/useRpc'
import type { Worktree } from '@/lib/rpc'

type CreateMode = 'repo' | 'branch'

export function WorkspaceList() {
  const navigate = useNavigate()
  const { data: workspaces, isLoading: loadingWorkspaces, error: workspacesError } = useAllWorktrees()
  const { data: repos, isLoading: loadingRepos } = useRepos()
  const createRepo = useCreateRepo()
  const createWorktree = useCreateWorktree()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('repo')
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [branchName, setBranchName] = useState('')
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
      setCreateMode('repo')
      void navigate({ to: '/workspace/$id', params: { id: worktree.id } })
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
    setCreateMode('repo')
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
            <button
              key={workspace.id}
              onClick={() => { handleWorkspaceClick(workspace); }}
              className="text-left p-4 border border-border-subtle rounded-lg hover:border-border-accent hover:bg-surface-hover transition-colors"
            >
              <h3 className="font-medium text-text-primary">{workspace.branch ?? workspace.worktreePath?.split('/').pop() ?? 'unnamed'}</h3>
              <p className="text-sm text-text-muted mt-1">
                {workspace.branch || 'no branch'}
              </p>
              {workspace.createdAt && (
                <p className="text-xs text-text-faint mt-2">
                  Created {new Date(workspace.createdAt).toLocaleDateString()}
                </p>
              )}
            </button>
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
