import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSetAtom, useAtomValue } from 'jotai'
import { useWorkspaces, useWorkspaceRepos, useWorktreesByWorkspace, useDeleteWorkspace } from '@/hooks/useRpc'
import { selectedWorkspaceIdAtom } from '@/store/workspace'
import type { Workspace, WorkspaceRepo, Worktree, WorktreeStatus } from '@/lib/rpc'
import { cn } from '@/lib/utils'
import { Button, NavItem, Spinner, StatusBadge } from '@koda/ui'
import { CreateWorkspaceModal } from '@/components/WorkspaceDialogs'

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
    <NavItem label={displayName}
      onClick={onClick}
      buttonClassName={cn('block rounded-none',
        'group w-full text-left font-mono pl-12 pr-4 py-2',
        'hover:bg-surface-hover hover:text-border-accent',
        'transition-colors duration-100'
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-text-dim">·</span>
        <StatusBadge showDot={false} status={status === 'done' ? 'success' : status === 'blocked' ? 'error' : status === 'needs-review' ? 'warning' : 'processing'} className={cn(
          'border-0 rounded-none bg-transparent p-0 text-2xs font-bold tracking-wide',
          status === 'done' ? 'text-status-success' :
          status === 'blocked' ? 'text-status-error' :
          status === 'needs-review' ? 'text-status-warning' :
          'text-border-accent'
        )}>
          [{statusLabel}]
        </StatusBadge>
        <span className="flex-1 truncate text-xs text-text-primary group-hover:text-border-accent">
          {displayName}
        </span>
        <span className="text-2xs text-text-dim tabular-nums">
          {timeAgo}
        </span>
        <span className="text-text-dim group-hover:text-border-accent">→</span>
      </div>
    </NavItem>
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
      <NavItem label={repo.repoName ?? 'unnamed'}
        onClick={() => setIsExpanded(!isExpanded)}
        buttonClassName="rounded-none w-full text-left font-mono px-4 py-2 flex items-center gap-2 hover:bg-surface-hover transition-colors"
      >
        <span className="text-text-dim text-xs">{isExpanded ? '▼' : '▶'}</span>
        <span className="text-xs text-text-primary">{repo.repoName ?? 'unnamed'}</span>
        <span className="text-2xs text-text-dim">({repoWorktrees.length})</span>
      </NavItem>

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
        <div className="pl-8 py-2 text-2xs text-text-dim italic">
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
        <Button variant="unstyled"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-dim hover:text-text-primary"
        >
          <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
        </Button>

        <NavItem label={workspace.name} className="flex-1 hover:bg-transparent"
          onClick={onSelect}
          buttonClassName="p-0 rounded-none block flex-1 text-left font-mono"
        >
          <span className={cn(
            'text-sm font-bold',
            isSelected ? 'text-border-accent' : 'text-text-primary'
          )}>
            {workspace.name}
          </span>
          <span className="ml-2 text-2xs text-text-dim">
            {repoCount} repo{repoCount !== 1 ? 's' : ''} · {worktreeCount} worktree{worktreeCount !== 1 ? 's' : ''}
          </span>
        </NavItem>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {showDeleteConfirm ? (
            <>
              <Button variant="unstyled"
                onClick={() => { onDelete(); setShowDeleteConfirm(false) }}
                className="px-2 py-1 text-2xs text-status-error hover:bg-status-error hover:text-text-inverse transition-colors"
              >
                CONFIRM
              </Button>
              <Button variant="unstyled"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 text-2xs text-text-dim hover:text-text-primary transition-colors"
              >
                CANCEL
              </Button>
            </>
          ) : (
            <Button variant="unstyled"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2 py-1 text-2xs text-text-dim hover:text-status-error transition-colors"
              title="Delete workspace"
            >
              [×]
            </Button>
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
              <p className="text-2xs text-text-dim mt-1">
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
        <Button variant="unstyled"
          onClick={onCreateClick}
          data-testid="new-workspace-button-empty"
          className={cn(
            'px-6 py-3 font-mono text-xs uppercase tracking-wider',
            'border border-dashed border-border-accent',
            'text-border-accent hover:bg-border-accent hover:text-text-inverse',
            'transition-colors duration-100'
          )}
        >
          [+] CREATE WORKSPACE
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkspaceList() {
  const navigate = useNavigate()
  const selectedWorkspaceId = useAtomValue(selectedWorkspaceIdAtom)
  const setSelectedWorkspaceId = useSetAtom(selectedWorkspaceIdAtom)

  const { data: workspaces, isLoading, error } = useWorkspaces()
  const deleteWorkspace = useDeleteWorkspace()

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const handleWorkspaceCreated = (workspace: Workspace) => {
    setSelectedWorkspaceId(workspace.id)
    void navigate({ to: '/workspace/$workspaceId/$worktreeId', params: { workspaceId: workspace.id, worktreeId: workspace.id } })
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
        <Spinner showLabel={false} />
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
          <Button variant="unstyled"
            onClick={() => setIsCreateOpen(true)}
            data-testid="new-workspace-button"
            className={cn(
              'px-4 py-2 font-mono text-xs uppercase tracking-wider',
              'border border-dashed border-border-accent',
              'text-border-accent hover:bg-border-accent hover:text-text-inverse',
              'transition-colors duration-100'
            )}
          >
            [+] NEW
          </Button>
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
      <footer className="px-6 py-3 border-t border-dashed border-text-dim/20 font-mono text-2xs text-text-dim">
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
