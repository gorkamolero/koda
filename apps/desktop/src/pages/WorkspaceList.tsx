import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSetAtom, useAtomValue } from 'jotai'
import { useWorkspaces, useWorkspaceRepos, useWorktreesByWorkspace, useCreateStandaloneWorkspace, useDeleteWorkspace } from '@/hooks/useRpc'
import { selectedWorkspaceIdAtom } from '@/store/workspace'
import type { Workspace, WorkspaceRepo, Worktree, WorktreeStatus } from '@/lib/rpc'
import { cn } from '@/lib/utils'
import { KodaSpinner } from '@/components/KodaSpinner'

// ============================================================================
// Terminal-style Status Labels
// ============================================================================

const STATUS_LABELS: Record<WorktreeStatus, string> = {
  'in-progress': 'ACTIVE',
  done: 'DONE',
  blocked: 'BLOCKED',
  'needs-review': 'REVIEW',
}

// ============================================================================
// Time Formatting - Terminal Style
// ============================================================================

function formatTimeAgo(date: string | null | undefined): string {
  if (!date) return '--:--'

  const diffMs = Date.now() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'NOW'
  if (diffMins < 60) return `${diffMins}M`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}H`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}D`
}

// ============================================================================
// Worktree Row - Single worktree item
// ============================================================================

interface WorktreeRowProps {
  worktree: Worktree
  onClick: () => void
}

function WorktreeRow({ worktree, onClick }: WorktreeRowProps) {
  const status = worktree.manualStatus ?? worktree.derivedStatus ?? 'in-progress'
  const statusLabel = STATUS_LABELS[status]
  const displayName = worktree.branch ?? worktree.worktreePath?.split('/').pop() ?? 'unnamed'
  const timeAgo = formatTimeAgo(worktree.updatedAt)

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left font-mono pl-12 pr-4 py-2',
        'hover:bg-surface-hover hover:text-border-accent',
        'transition-colors duration-100'
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-text-dim">·</span>
        <span className={cn(
          'text-[10px] font-bold tracking-wide',
          status === 'done' ? 'text-status-success' :
          status === 'blocked' ? 'text-status-error' :
          status === 'needs-review' ? 'text-status-warning' :
          'text-border-accent'
        )}>
          [{statusLabel}]
        </span>
        <span className="flex-1 truncate text-xs text-text-primary group-hover:text-border-accent">
          {displayName}
        </span>
        <span className="text-[10px] text-text-dim tabular-nums">
          {timeAgo}
        </span>
        <span className="text-text-dim group-hover:text-border-accent">→</span>
      </div>
    </button>
  )
}

// ============================================================================
// Repo Section - Repo with its worktrees
// ============================================================================

interface RepoSectionProps {
  repo: WorkspaceRepo
  worktrees: Worktree[]
  onWorktreeClick: (worktree: Worktree) => void
}

function RepoSection({ repo, worktrees, onWorktreeClick }: RepoSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const repoWorktrees = worktrees.filter(wt => wt.repoId === repo.repoId)

  return (
    <div className="border-l border-dashed border-text-dim/20 ml-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left font-mono px-4 py-2 flex items-center gap-2 hover:bg-surface-hover transition-colors"
      >
        <span className="text-text-dim text-xs">{isExpanded ? '▼' : '▶'}</span>
        <span className="text-xs text-text-primary">{repo.repoName ?? 'unnamed'}</span>
        <span className="text-[10px] text-text-dim">({repoWorktrees.length})</span>
      </button>

      {isExpanded && repoWorktrees.length > 0 && (
        <div className="border-l border-dashed border-text-dim/20 ml-4">
          {repoWorktrees.map(worktree => (
            <WorktreeRow
              key={worktree.id}
              worktree={worktree}
              onClick={() => onWorktreeClick(worktree)}
            />
          ))}
        </div>
      )}

      {isExpanded && repoWorktrees.length === 0 && (
        <div className="pl-8 py-2 text-[10px] text-text-dim italic">
          No worktrees
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Workspace Card - Expandable workspace with repos and worktrees
// ============================================================================

interface WorkspaceCardProps {
  workspace: Workspace
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

function WorkspaceCard({ workspace, isSelected, onSelect, onDelete }: WorkspaceCardProps) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: repos } = useWorkspaceRepos(workspace.id)
  const { data: worktrees } = useWorktreesByWorkspace(workspace.id)

  const handleWorktreeClick = (worktree: Worktree) => {
    void navigate({ to: '/workspace/$workspaceId/$worktreeId', params: { workspaceId: workspace.id, worktreeId: worktree.id } })
  }

  const worktreeCount = worktrees?.length ?? 0
  const repoCount = repos?.length ?? 0

  return (
    <div className={cn(
      'border border-dashed',
      isSelected ? 'border-border-accent' : 'border-text-dim/30',
      'hover:border-border-accent/50 transition-colors'
    )}>
      {/* Workspace Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-card">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-dim hover:text-text-primary"
        >
          <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
        </button>

        <button
          onClick={onSelect}
          className="flex-1 text-left font-mono"
        >
          <span className={cn(
            'text-sm font-bold',
            isSelected ? 'text-border-accent' : 'text-text-primary'
          )}>
            {workspace.name}
          </span>
          <span className="ml-2 text-[10px] text-text-dim">
            {repoCount} repo{repoCount !== 1 ? 's' : ''} · {worktreeCount} worktree{worktreeCount !== 1 ? 's' : ''}
          </span>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {showDeleteConfirm ? (
            <>
              <button
                onClick={() => { onDelete(); setShowDeleteConfirm(false) }}
                className="px-2 py-1 text-[10px] text-status-error hover:bg-status-error hover:text-white transition-colors"
              >
                CONFIRM
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-[10px] text-text-dim hover:text-text-primary transition-colors"
              >
                CANCEL
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2 py-1 text-[10px] text-text-dim hover:text-status-error transition-colors"
              title="Delete workspace"
            >
              [×]
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-dashed border-text-dim/20">
          {repos && repos.length > 0 ? (
            repos.map(repo => (
              <RepoSection
                key={repo.id}
                repo={repo}
                worktrees={worktrees ?? []}
                onWorktreeClick={handleWorktreeClick}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-text-dim">No repos attached</p>
              <p className="text-[10px] text-text-dim mt-1">
                Use the sidebar to add repos to this workspace
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center font-mono max-w-md">
        <div className="text-text-dim text-xs mb-6">
          <pre className="inline-block text-left">
{`┌─────────────────────────────────┐
│                                 │
│     NO WORKSPACES YET           │
│                                 │
│     Create a workspace to       │
│     organize your repos         │
│                                 │
└─────────────────────────────────┘`}
          </pre>
        </div>
        <button
          onClick={onCreateClick}
          data-testid="new-workspace-button-empty"
          className={cn(
            'px-6 py-3 font-mono text-xs uppercase tracking-wider',
            'border border-dashed border-border-accent',
            'text-border-accent hover:bg-border-accent hover:text-white',
            'transition-colors duration-100'
          )}
        >
          [+] CREATE WORKSPACE
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Create Workspace Modal
// ============================================================================

function CreateWorkspaceModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: (workspace: Workspace) => void
}) {
  const createWorkspace = useCreateStandaloneWorkspace()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!name.trim()) return

    try {
      const workspace = await createWorkspace.mutateAsync({ name: name.trim() })
      setName('')
      setError(null)
      onCreated(workspace)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 bg-surface-card border border-dashed border-text-dim/30 font-mono"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-dashed border-text-dim/20">
          <div className="text-xs text-border-accent">┌─ NEW WORKSPACE ─────────────</div>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="text-status-error text-xs border border-dashed border-status-error p-2">
              ERROR: {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] text-text-dim mb-1">NAME</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-workspace"
              className="w-full px-3 py-2 bg-transparent border border-dashed border-text-dim/30 text-text-primary text-sm font-mono focus:border-border-accent focus:outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') void handleCreate()
                if (e.key === 'Escape') onClose()
              }}
              autoFocus
            />
          </div>

          <button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || createWorkspace.isPending}
            className="w-full p-3 text-xs border border-dashed border-border-accent/50 hover:border-border-accent text-border-accent hover:bg-border-accent/10 transition-colors disabled:opacity-50"
          >
            {createWorkspace.isPending ? 'CREATING...' : '[+] CREATE'}
          </button>
        </div>

        <div className="px-4 py-3 border-t border-dashed border-text-dim/20 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs text-text-dim hover:text-text-primary"
          >
            [ESC] CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkspaceList() {
  const selectedWorkspaceId = useAtomValue(selectedWorkspaceIdAtom)
  const setSelectedWorkspaceId = useSetAtom(selectedWorkspaceIdAtom)

  const { data: workspaces, isLoading, error } = useWorkspaces()
  const deleteWorkspace = useDeleteWorkspace()

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const handleWorkspaceCreated = (workspace: Workspace) => {
    setSelectedWorkspaceId(workspace.id)
  }

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspaceId(workspace.id)
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    try {
      await deleteWorkspace.mutateAsync({ id: workspaceId })
      if (selectedWorkspaceId === workspaceId) {
        setSelectedWorkspaceId(null)
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-messages">
        <KodaSpinner />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-messages">
        <div className="text-center font-mono">
          <p className="text-status-error text-sm mb-2">FAILED TO LOAD WORKSPACES</p>
          <p className="text-text-dim text-xs">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  const hasWorkspaces = workspaces && workspaces.length > 0

  return (
    <div className="h-full flex flex-col bg-surface-messages">
      {/* Header */}
      <header className="px-6 pt-6 pb-4 border-b border-dashed border-text-dim/20">
        <div className="flex items-center justify-between gap-4">
          <div className="font-mono">
            <h1 className="text-xl text-text-primary tracking-tight">
              WORKSPACES
            </h1>
            {hasWorkspaces && (
              <p className="text-xs text-text-dim mt-1">
                {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            data-testid="new-workspace-button"
            className={cn(
              'px-4 py-2 font-mono text-xs uppercase tracking-wider',
              'border border-dashed border-border-accent',
              'text-border-accent hover:bg-border-accent hover:text-white',
              'transition-colors duration-100'
            )}
          >
            [+] NEW
          </button>
        </div>
      </header>

      {/* Content */}
      {hasWorkspaces ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="workspace-grid">
          {workspaces.map(workspace => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isSelected={selectedWorkspaceId === workspace.id}
              onSelect={() => handleSelectWorkspace(workspace)}
              onDelete={() => void handleDeleteWorkspace(workspace.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState onCreateClick={() => setIsCreateOpen(true)} />
      )}

      {/* Footer */}
      <footer className="px-6 py-3 border-t border-dashed border-text-dim/20 font-mono text-[10px] text-text-dim">
        <div className="flex items-center justify-between">
          <span>KODA v0.1.0</span>
          <span>CLICK TO SELECT · EXPAND TO VIEW</span>
        </div>
      </footer>

      {/* Create Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleWorkspaceCreated}
      />
    </div>
  )
}
