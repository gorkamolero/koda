import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { useSetAtom, useAtomValue } from 'jotai'
import { useAllWorktrees, useRepos, useCreateRepo, useCreateWorktree, useCreateStandaloneWorkspace } from '@/hooks/useRpc'
import { selectedWorkspaceIdAtom } from '@/store/workspace'
import type { Worktree, WorktreeStatus, WorktreeType } from '@/lib/rpc'
import { cn } from '@/lib/utils'
import { KodaSpinner } from '@/components/KodaSpinner'
import { Route } from '@/routes/index'

type CreateMode = 'choose' | 'repo' | 'branch' | 'standalone'

// ============================================================================
// Terminal-style Status Labels
// ============================================================================

const STATUS_LABELS: Record<WorktreeStatus, string> = {
  'in-progress': 'ACTIVE',
  done: 'DONE',
  blocked: 'BLOCKED',
  'needs-review': 'REVIEW',
}

const TYPE_LABELS: Record<WorktreeType, string> = {
  standard: 'STD',
  'spec-driven': 'SPEC',
  ralph: 'RALPH',
  openprose: 'PROSE',
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
// ASCII Box Components
// ============================================================================

function AsciiBox({
  children,
  title,
  className,
  accent = false,
}: {
  children: React.ReactNode
  title?: string
  className?: string
  accent?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      {/* Top border */}
      <div className={cn(
        'flex items-center font-mono text-xs select-none',
        accent ? 'text-border-accent' : 'text-text-dim'
      )}>
        <span>┌</span>
        {title && (
          <>
            <span className="px-1">{title}</span>
          </>
        )}
        <span className="flex-1 overflow-hidden whitespace-nowrap">
          {'─'.repeat(100)}
        </span>
        <span>┐</span>
      </div>

      {/* Content with side borders */}
      <div className={cn(
        'border-l border-r border-dashed px-3 py-2',
        accent ? 'border-border-accent' : 'border-text-dim/30'
      )}>
        {children}
      </div>

      {/* Bottom border */}
      <div className={cn(
        'flex items-center font-mono text-xs select-none',
        accent ? 'text-border-accent' : 'text-text-dim'
      )}>
        <span>└</span>
        <span className="flex-1 overflow-hidden whitespace-nowrap">
          {'─'.repeat(100)}
        </span>
        <span>┘</span>
      </div>
    </div>
  )
}

// ============================================================================
// Workspace Row - Terminal Table Style
// ============================================================================

interface WorktreeRowProps {
  worktree: Worktree
  onClick: () => void
  index: number
}

function WorktreeRow({ worktree, onClick, index }: WorktreeRowProps) {
  const status = worktree.manualStatus ?? worktree.derivedStatus ?? 'in-progress'
  const statusLabel = STATUS_LABELS[status]
  const typeLabel = TYPE_LABELS[worktree.worktreeType ?? 'standard']
  const isArchived = worktree.state === 'archived'
  const displayName = worktree.branch ?? worktree.worktreePath?.split('/').pop() ?? 'unnamed'
  const timeAgo = formatTimeAgo(worktree.updatedAt)
  const hasUnread = (worktree.unread ?? 0) > 0
  const isPinned = !!worktree.pinnedAt

  return (
    <button
      data-testid="worktree-card"
      onClick={onClick}
      style={{ animationDelay: `${index * 30}ms` }}
      className={cn(
        'group w-full text-left font-mono',
        'border-b border-dashed border-text-dim/20',
        'hover:bg-surface-hover hover:border-border-accent/50',
        'transition-colors duration-100',
        'animate-in fade-in slide-in-from-left-2',
        isArchived && 'opacity-40'
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Pin indicator */}
        <span className={cn(
          'w-4 text-center text-xs',
          isPinned ? 'text-border-accent' : 'text-text-dim/30'
        )}>
          {isPinned ? '▸' : '·'}
        </span>

        {/* Status */}
        <span className={cn(
          'w-20 text-xs font-bold tracking-wide',
          status === 'done' ? 'text-status-success' :
          status === 'blocked' ? 'text-status-error' :
          status === 'needs-review' ? 'text-status-warning' :
          'text-border-accent'
        )}>
          [{statusLabel}]
        </span>

        {/* Type */}
        <span className="w-16 text-xs text-text-dim">
          [{typeLabel}]
        </span>

        {/* Name */}
        <span className={cn(
          'flex-1 truncate text-sm',
          'text-text-primary group-hover:text-border-accent',
          'transition-colors'
        )}>
          {displayName}
        </span>

        {/* Target branch */}
        {worktree.intendedTargetBranch && (
          <span className="text-xs text-text-dim hidden lg:block">
            → {worktree.intendedTargetBranch}
          </span>
        )}

        {/* Unread */}
        {hasUnread && (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-border-accent text-white">
            {worktree.unread}
          </span>
        )}

        {/* Time */}
        <span className="w-12 text-right text-xs text-text-dim tabular-nums">
          {timeAgo}
        </span>

        {/* Arrow */}
        <span className="text-text-dim group-hover:text-border-accent transition-colors">
          →
        </span>
      </div>
    </button>
  )
}

// ============================================================================
// Stats Bar - Terminal Style
// ============================================================================

function StatsBar({ worktrees }: { worktrees: Worktree[] }) {
  const stats = useMemo(() => {
    const active = worktrees.filter(w => (w.manualStatus ?? w.derivedStatus) === 'in-progress' && w.state !== 'archived').length
    const review = worktrees.filter(w => (w.manualStatus ?? w.derivedStatus) === 'needs-review').length
    const blocked = worktrees.filter(w => (w.manualStatus ?? w.derivedStatus) === 'blocked').length
    const done = worktrees.filter(w => (w.manualStatus ?? w.derivedStatus) === 'done').length
    const total = worktrees.filter(w => w.state !== 'archived').length
    return { active, review, blocked, done, total }
  }, [worktrees])

  return (
    <div className="font-mono text-xs flex items-center gap-6 text-text-dim">
      <span>TOTAL: <span className="text-text-primary">{stats.total}</span></span>
      <span>ACTIVE: <span className="text-border-accent">{stats.active}</span></span>
      {stats.review > 0 && <span>REVIEW: <span className="text-status-warning">{stats.review}</span></span>}
      {stats.blocked > 0 && <span>BLOCKED: <span className="text-status-error">{stats.blocked}</span></span>}
      {stats.done > 0 && <span>DONE: <span className="text-status-success">{stats.done}</span></span>}
    </div>
  )
}

// ============================================================================
// Empty State - Terminal Style
// ============================================================================

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8" data-testid="empty-state">
      <div className="text-center font-mono max-w-md animate-in fade-in duration-500">
        <pre className="text-text-dim text-xs mb-6 select-none">
{`
    ┌──────────────────────────────┐
    │                              │
    │   NO WORKSPACES DETECTED     │
    │                              │
    │   > Create your first        │
    │     workspace to begin       │
    │                              │
    └──────────────────────────────┘
`}
        </pre>

        <button
          onClick={onCreateClick}
          data-testid="new-workspace-button-empty"
          className={cn(
            'inline-flex items-center gap-2 px-6 py-2',
            'border border-dashed border-border-accent',
            'text-border-accent hover:bg-border-accent hover:text-white',
            'font-mono text-sm uppercase tracking-wider',
            'transition-colors duration-100'
          )}
        >
          [+] NEW WORKSPACE
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Create Modal - Terminal Style
// ============================================================================

function CreateModal({
  isOpen,
  mode,
  setMode,
  onClose,
  repos,
  onRepoSelect,
  onSelectFolder,
  branchName,
  setBranchName,
  standaloneName,
  setStandaloneName,
  onCreateWorktree,
  onCreateStandalone,
  createError,
  isCreating,
  selectedRepo,
}: {
  isOpen: boolean
  mode: CreateMode
  setMode: (mode: CreateMode) => void
  onClose: () => void
  repos: Array<{ id: string; name?: string | null; rootPath: string }> | undefined
  onRepoSelect: (id: string) => void
  onSelectFolder: () => void
  branchName: string
  setBranchName: (name: string) => void
  standaloneName: string
  setStandaloneName: (name: string) => void
  onCreateWorktree: () => void
  onCreateStandalone: () => void
  createError: string | null
  isCreating: boolean
  selectedRepo: { name?: string | null; rootPath: string } | undefined
}) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <AsciiBox title="[ NEW WORKSPACE ]" accent>
          <div className="font-mono space-y-4">
            {createError && (
              <div className="text-status-error text-xs border border-dashed border-status-error p-2">
                ERROR: {createError}
              </div>
            )}

            {/* Step 1: Choose type */}
            {mode === 'choose' && (
              <>
                <p className="text-text-muted text-xs mb-4">SELECT WORKSPACE TYPE:</p>

                <button
                  onClick={() => setMode('repo')}
                  data-testid="create-with-repo"
                  className="w-full text-left p-3 border border-dashed border-text-dim/30 hover:border-border-accent hover:text-border-accent transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-text-dim group-hover:text-border-accent">[1]</span>
                    <div>
                      <div className="text-sm text-text-primary group-hover:text-border-accent">FROM REPOSITORY</div>
                      <div className="text-xs text-text-dim">Connect git repo + create worktree</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMode('standalone')}
                  data-testid="create-standalone"
                  className="w-full text-left p-3 border border-dashed border-text-dim/30 hover:border-border-accent hover:text-border-accent transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-text-dim group-hover:text-border-accent">[2]</span>
                    <div>
                      <div className="text-sm text-text-primary group-hover:text-border-accent">STANDALONE</div>
                      <div className="text-xs text-text-dim">Create workspace, connect repo later</div>
                    </div>
                  </div>
                </button>

                <div className="flex justify-end pt-4 border-t border-dashed border-text-dim/20">
                  <button
                    onClick={onClose}
                    className="text-xs text-text-dim hover:text-text-primary transition-colors"
                  >
                    [ESC] CANCEL
                  </button>
                </div>
              </>
            )}

            {/* Step 2a: Select repo */}
            {mode === 'repo' && (
              <>
                <p className="text-text-muted text-xs mb-4">SELECT REPOSITORY:</p>

                {repos && repos.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto" data-testid="repo-list">
                    {repos.map((repo, i) => (
                      <button
                        key={repo.id}
                        onClick={() => onRepoSelect(repo.id)}
                        data-testid={`repo-button-${repo.id}`}
                        className="w-full text-left p-2 border border-dashed border-text-dim/30 hover:border-border-accent transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-text-dim text-xs">[{i + 1}]</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-text-primary group-hover:text-border-accent truncate">
                              {repo.name ?? 'unnamed'}
                            </div>
                            <div className="text-xs text-text-dim truncate">{repo.rootPath}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={onSelectFolder}
                  className="w-full p-3 border border-dashed border-border-accent/50 hover:border-border-accent text-border-accent hover:bg-border-accent/10 transition-colors text-sm"
                >
                  [+] ADD GIT REPOSITORY
                </button>

                <div className="flex justify-between pt-4 border-t border-dashed border-text-dim/20">
                  <button
                    onClick={() => setMode('choose')}
                    className="text-xs text-text-dim hover:text-text-primary transition-colors"
                  >
                    [←] BACK
                  </button>
                  <button
                    onClick={onClose}
                    className="text-xs text-text-dim hover:text-text-primary transition-colors"
                  >
                    [ESC] CANCEL
                  </button>
                </div>
              </>
            )}

            {/* Step 2b: Standalone name */}
            {mode === 'standalone' && (
              <>
                <p className="text-text-muted text-xs mb-4">ENTER WORKSPACE NAME:</p>

                <div className="flex items-center gap-2 border border-dashed border-text-dim/30 focus-within:border-border-accent p-2">
                  <span className="text-text-dim">{'>'}</span>
                  <input
                    type="text"
                    value={standaloneName}
                    onChange={e => setStandaloneName(e.target.value)}
                    placeholder="my-workspace"
                    data-testid="standalone-name-input"
                    className="flex-1 bg-transparent text-text-primary placeholder:text-text-dim/50 outline-none text-sm"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') onCreateStandalone()
                      if (e.key === 'Escape') onClose()
                    }}
                  />
                </div>

                <div className="flex justify-between pt-4 border-t border-dashed border-text-dim/20">
                  <button
                    onClick={() => setMode('choose')}
                    className="text-xs text-text-dim hover:text-text-primary transition-colors"
                  >
                    [←] BACK
                  </button>
                  <div className="flex gap-4">
                    <button
                      onClick={onClose}
                      className="text-xs text-text-dim hover:text-text-primary transition-colors"
                    >
                      [ESC] CANCEL
                    </button>
                    <button
                      onClick={onCreateStandalone}
                      disabled={!standaloneName.trim() || isCreating}
                      data-testid="create-standalone-button"
                      className="text-xs text-border-accent hover:text-white hover:bg-border-accent px-2 py-1 border border-dashed border-border-accent disabled:opacity-50 transition-colors"
                    >
                      {isCreating ? 'CREATING...' : '[ENTER] CREATE'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Branch name */}
            {mode === 'branch' && (
              <>
                <div className="text-xs text-text-dim border border-dashed border-text-dim/30 p-2 mb-4">
                  REPO: <span className="text-text-primary">{selectedRepo?.name}</span>
                  <br />
                  PATH: <span className="text-text-dim">{selectedRepo?.rootPath}</span>
                </div>

                <p className="text-text-muted text-xs mb-2">ENTER BRANCH NAME:</p>

                <div className="flex items-center gap-2 border border-dashed border-text-dim/30 focus-within:border-border-accent p-2">
                  <span className="text-text-dim">{'>'}</span>
                  <input
                    type="text"
                    value={branchName}
                    onChange={e => setBranchName(e.target.value)}
                    placeholder="feature/my-feature"
                    className="flex-1 bg-transparent text-text-primary placeholder:text-text-dim/50 outline-none text-sm"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') onCreateWorktree()
                      if (e.key === 'Escape') onClose()
                    }}
                  />
                </div>
                <p className="text-[10px] text-text-dim mt-1">
                  A git worktree will be created for isolated work
                </p>

                <div className="flex justify-between pt-4 border-t border-dashed border-text-dim/20">
                  <button
                    onClick={() => setMode('repo')}
                    data-testid="modal-back-button"
                    className="text-xs text-text-dim hover:text-text-primary transition-colors"
                  >
                    [←] BACK
                  </button>
                  <div className="flex gap-4">
                    <button
                      onClick={onClose}
                      className="text-xs text-text-dim hover:text-text-primary transition-colors"
                    >
                      [ESC] CANCEL
                    </button>
                    <button
                      onClick={onCreateWorktree}
                      disabled={!branchName.trim() || isCreating}
                      className="text-xs text-border-accent hover:text-white hover:bg-border-accent px-2 py-1 border border-dashed border-border-accent disabled:opacity-50 transition-colors"
                    >
                      {isCreating ? 'CREATING...' : '[ENTER] CREATE'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </AsciiBox>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkspaceList() {
  const navigate = useNavigate()
  const { repoId: urlRepoId } = useSearch({ from: Route.fullPath })
  const selectedWorkspaceId = useAtomValue(selectedWorkspaceIdAtom)
  const setSelectedWorkspaceId = useSetAtom(selectedWorkspaceIdAtom)
  const { data: worktrees, isLoading: loadingWorktrees, error: worktreesError } = useAllWorktrees()
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

  // Handle repoId from URL - auto-open create modal with repo pre-selected
  useEffect(() => {
    if (urlRepoId && repos?.some(r => r.id === urlRepoId)) {
      setSelectedRepoId(urlRepoId)
      setCreateMode('branch')
      setIsCreateOpen(true)
      // Clear the URL param so refreshing doesn't re-open the modal
      void navigate({ to: '/', search: {}, replace: true })
    }
  }, [urlRepoId, repos, navigate])

  // Sort worktrees: pinned first, then by updatedAt
  const sortedWorktrees = useMemo(() => {
    if (!worktrees) return []

    return [...worktrees]
      .filter(w => w.state !== 'archived')
      .sort((a, b) => {
        // Pinned first
        if (a.pinnedAt && !b.pinnedAt) return -1
        if (!a.pinnedAt && b.pinnedAt) return 1

        // Then by updatedAt
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
  }, [worktrees])

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
        workspaceId: selectedWorkspaceId ?? undefined,
      })
      closeModal()
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
      closeModal()
      // Select the new workspace in the sidebar
      setSelectedWorkspaceId(workspace.id)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace')
    }
  }

  const handleWorktreeClick = (worktree: Worktree) => {
    void navigate({ to: '/workspace/$id', params: { id: worktree.id } })
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

  const isLoading = loadingWorktrees || loadingRepos
  const selectedRepo = repos?.find(r => r.id === selectedRepoId)
  const hasWorktrees = sortedWorktrees.length > 0

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-messages">
        <KodaSpinner style="wave" label="Loading" />
      </div>
    )
  }

  if (worktreesError) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-messages font-mono">
        <div className="text-center">
          <pre className="text-status-error text-xs mb-4">
{`┌─────────────────────────────┐
│ ERROR: FAILED TO LOAD       │
└─────────────────────────────┘`}
          </pre>
          <p className="text-xs text-text-dim">
            {worktreesError instanceof Error ? worktreesError.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-messages">
      {/* Header */}
      <header className="px-6 pt-6 pb-4 border-b border-dashed border-text-dim/20">
        <div className="flex items-center justify-between gap-4">
          <div className="font-mono">
            <h1 className="text-xl text-text-primary tracking-tight">
              WORKTREES
            </h1>
            {hasWorktrees && worktrees && (
              <div className="mt-2">
                <StatsBar worktrees={worktrees} />
              </div>
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

      {/* Table Header */}
      {hasWorktrees && (
        <div className="px-6 py-2 border-b border-dashed border-text-dim/20 font-mono text-[10px] text-text-dim uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="w-4"></span>
            <span className="w-20">[STATUS]</span>
            <span className="w-16">[TYPE]</span>
            <span className="flex-1">[BRANCH]</span>
            <span className="hidden lg:block w-32">[TARGET]</span>
            <span className="w-12 text-right">[AGO]</span>
            <span className="w-4"></span>
          </div>
        </div>
      )}

      {/* Content */}
      {hasWorktrees ? (
        <div className="flex-1 overflow-y-auto" data-testid="worktree-grid">
          {sortedWorktrees.map((worktree, index) => (
            <WorktreeRow
              key={worktree.id}
              worktree={worktree}
              onClick={() => handleWorktreeClick(worktree)}
              index={index}
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
          <span>↑↓ NAVIGATE • ENTER SELECT • ESC CLOSE</span>
        </div>
      </footer>

      {/* Create Modal */}
      <CreateModal
        isOpen={isCreateOpen}
        mode={createMode}
        setMode={setCreateMode}
        onClose={closeModal}
        repos={repos}
        onRepoSelect={handleRepoSelect}
        onSelectFolder={() => void handleSelectFolder()}
        branchName={branchName}
        setBranchName={setBranchName}
        standaloneName={standaloneName}
        setStandaloneName={setStandaloneName}
        onCreateWorktree={() => void handleCreateWorktree()}
        onCreateStandalone={() => void handleCreateStandalone()}
        createError={createError}
        isCreating={createWorktree.isPending || createStandaloneWorkspace.isPending}
        selectedRepo={selectedRepo}
      />
    </div>
  )
}
