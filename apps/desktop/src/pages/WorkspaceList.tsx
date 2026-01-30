import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useWorkspaces, useCreateWorkspace } from '@/hooks/useRpc'
import type { Workspace, CreateWorkspaceParams } from '@/lib/rpc'

export function WorkspaceList() {
  const navigate = useNavigate()
  const { data: workspaces, isLoading, error } = useWorkspaces()
  const createWorkspace = useCreateWorkspace()
  
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [workspaceType, setWorkspaceType] = useState<CreateWorkspaceParams['workspaceType']>('standard')

  const handleCreate = async () => {
    if (!newWorkspaceName.trim()) return
    
    try {
      const workspace = await createWorkspace.mutateAsync({
        directoryName: newWorkspaceName.trim(),
        workspaceType,
      })
      setIsCreateOpen(false)
      setNewWorkspaceName('')
      void navigate({ to: '/workspace/$id', params: { id: workspace.id } })
    } catch (err) {
      console.error('Failed to create workspace:', err)
    }
  }

  const handleWorkspaceClick = (workspace: Workspace) => {
    void navigate({ to: '/workspace/$id', params: { id: workspace.id } })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading workspaces...</div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-destructive">
          <p>Failed to load workspaces</p>
          <p className="text-sm mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const hasWorkspaces = workspaces && workspaces.length > 0

  return (
    <div className="h-full flex flex-col p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage your agent workspaces and review their work
          </p>
        </div>
        {hasWorkspaces && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 transition-colors"
          >
            Create Workspace
          </button>
        )}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Create Workspace</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Workspace Name</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="my-feature"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreate()
                    if (e.key === 'Escape') setIsCreateOpen(false)
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Workspace Type</label>
                <select
                  value={workspaceType}
                  onChange={(e) => setWorkspaceType(e.target.value as CreateWorkspaceParams['workspaceType'])}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="standard">Standard</option>
                  <option value="spec-driven">Spec-Driven</option>
                  <option value="ralph">Ralph</option>
                  <option value="openprose">OpenProse</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={!newWorkspaceName.trim() || createWorkspace.isPending}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {createWorkspace.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
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
                {workspace.workspaceType || 'standard'} • {workspace.branch || 'main'}
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
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-primary mb-2">
              No workspaces yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Create your first workspace to start orchestrating agents and
              reviewing their work.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 transition-colors"
            >
              Create Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
