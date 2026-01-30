import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { useWorkspaces, useRepos, useCreateRepo, useCreateWorktree } from '@/hooks/useRpc'
import type { Workspace } from '@/lib/rpc'

type CreateMode = 'repo' | 'branch'

export function WorkspaceList() {
  const navigate = useNavigate()
  const { data: workspaces, isLoading: loadingWorkspaces, error: workspacesError } = useWorkspaces()
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
      const workspace = await createWorktree.mutateAsync({
        repoId: selectedRepoId,
        branch: branchName.trim(),
      })
      setIsCreateOpen(false)
      setBranchName('')
      setSelectedRepoId('')
      setCreateMode('repo')
      void navigate({ to: '/workspace/$id', params: { id: workspace.id } })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace')
    }
  }

  const handleWorkspaceClick = (workspace: Workspace) => {
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
        <div className="text-muted-foreground">Loading...</div>
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
          <h1 className="text-3xl font-bold text-primary mb-2">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage your agent workspaces and review their work
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 transition-colors"
        >
          New Workspace
        </button>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg p-6 w-full max-w-lg shadow-xl">
            {createMode === 'repo' ? (
              <>
                <h2 className="text-lg font-semibold mb-4">Select Repository</h2>
                
                {createError && (
                  <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {createError}
                  </div>
                )}

                {/* Existing repos */}
                {hasRepos && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Recent Repositories</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {repos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => handleRepoSelect(repo.id)}
                          className="w-full text-left p-3 border border-border rounded-md hover:border-primary hover:bg-accent/50 transition-colors"
                        >
                          <div className="font-medium">{repo.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{repo.rootPath}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new repo */}
                <button
                  onClick={() => void handleSelectFolder()}
                  disabled={createRepo.isPending}
                  className="w-full p-4 border-2 border-dashed border-border rounded-md hover:border-primary hover:bg-accent/30 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {createRepo.isPending ? 'Registering...' : 'Add Git Repository'}
                </button>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-4">Create Branch</h2>
                
                {createError && (
                  <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {createError}
                  </div>
                )}

                <div className="mb-4 p-3 rounded-md bg-accent/50">
                  <div className="text-sm font-medium">{selectedRepo?.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedRepo?.rootPath}</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Branch Name</label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="feature/my-feature"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleCreateWorktree()
                        if (e.key === 'Escape') closeModal()
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      A git worktree will be created for isolated work
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setCreateMode('repo')}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleCreateWorktree()}
                      disabled={!branchName.trim() || createWorktree.isPending}
                      className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => handleWorkspaceClick(workspace)}
              className="text-left p-4 border border-border rounded-lg hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <h3 className="font-medium text-primary">{workspace.directoryName}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {workspace.branch || 'no branch'}
              </p>
              {workspace.createdAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Created {new Date(workspace.createdAt).toLocaleDateString()}
                </p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="mb-4">
              <svg
                className="mx-auto h-24 w-24 text-muted-foreground/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-primary mb-2">
              No workspaces yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Select a git repository and create a branch to start working with agents.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 transition-colors"
            >
              New Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
