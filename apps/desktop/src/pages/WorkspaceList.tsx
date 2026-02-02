import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { useAllWorktrees, useRepos, useCreateRepo, useCreateWorktree, useCreateStandaloneWorkspace } from '@/hooks/useRpc'
import type { Worktree, WorktreeStatus, WorktreeType } from '@/lib/rpc'
import { cn } from '@/lib/utils'
import {
  Archive,
  ArchiveRestore,
  Check,
  AlertCircle,
  GitBranch,
  Clock,
  MessageSquare,
  Pin,
  Sparkles,
  Bot,
  FileText,
  Zap,
  ArrowRight,
  Plus,
  FolderGit2,
  MessagesSquare,
} from 'lucide-react'
import { KodaAsciiLogo, KodaSpinner } from '@/components/KodaSpinner'

type CreateMode = 'choose' | 'repo' | 'branch' | 'standalone'

// ============================================================================
// Workspace Type Configuration
// ============================================================================

interface TypeConfig {
  icon: React.ReactNode
  label: string
  color: string
  bgColor: string
}

const WORKSPACE_TYPE_CONFIG: Record<WorktreeType, TypeConfig> = {
  standard: {
    icon: <GitBranch className="w-3.5 h-3.5" />,
    label: 'Standard',
    color: 'text-text-muted',
    bgColor: 'bg-surface-hover',
  },
  'spec-driven': {
    icon: <FileText className="w-3.5 h-3.5" />,
    label: 'Spec-Driven',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
  ralph: {
    icon: <Bot className="w-3.5 h-3.5" />,
    label: 'Ralph',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  openprose: {
    icon: <Sparkles className="w-3.5 h-3.5" />,
    label: 'OpenProse',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
}

// ============================================================================
// Status Configuration
// ============================================================================

interface StatusConfig {
  icon: React.ReactNode
  label: string
  accentColor: string
  bgGlow: string
}

const STATUS_CONFIG: Record<WorktreeStatus, StatusConfig> = {
  'in-progress': {
    icon: <Zap className="w-3.5 h-3.5" />,
    label: 'In Progress',
    accentColor: 'border-l-blue-500',
    bgGlow: 'hover:shadow-blue-500/5',
  },
  done: {
    icon: <Check className="w-3.5 h-3.5" />,
    label: 'Done',
    accentColor: 'border-l-emerald-500',
    bgGlow: 'hover:shadow-emerald-500/5',
  },
  blocked: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    label: 'Blocked',
    accentColor: 'border-l-red-500',
    bgGlow: 'hover:shadow-red-500/5',
  },
  'needs-review': {
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    label: 'Needs Review',
    accentColor: 'border-l-amber-500',
    bgGlow: 'hover:shadow-amber-500/5',
  },
}

// ============================================================================
// Time Formatting
// ============================================================================

function formatTimeAgo(date: string | null | undefined): string {
  if (!date) return ''

  const diffMs = Date.now() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 4) return `${diffWeeks}w ago`

  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(date: string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ============================================================================
// Workspace Card - Premium Design
// ============================================================================

interface WorkspaceCardProps {
  workspace: Worktree
  onClick: () => void
  index: number
  isPinned?: boolean
}

function WorkspaceCard({ workspace, onClick, index, isPinned }: WorkspaceCardProps) {
  const status = workspace.manualStatus ?? workspace.derivedStatus ?? 'in-progress'
  const statusConfig = STATUS_CONFIG[status]
  const typeConfig = WORKSPACE_TYPE_CONFIG[workspace.worktreeType ?? 'standard']
  const isArchived = workspace.state === 'archived'
  const displayName = workspace.branch ?? workspace.worktreePath?.split('/').pop() ?? 'unnamed'
  const timeAgo = formatTimeAgo(workspace.updatedAt)
  const hasUnread = (workspace.unread ?? 0) > 0

  return (
    <button
      data-testid="workspace-card"
      onClick={onClick}
      style={{ animationDelay: `${index * 50}ms` }}
      className={cn(
        'group relative text-left w-full',
        'rounded-xl border-l-[3px] transition-all duration-300',
        'bg-gradient-to-br from-surface-card to-surface-card/80',
        'border border-border-subtle border-l-0',
        'hover:border-border-strong hover:shadow-xl',
        'animate-in fade-in slide-in-from-bottom-2',
        statusConfig.accentColor,
        statusConfig.bgGlow,
        isArchived && 'opacity-50 grayscale-[30%]',
        isPinned && 'ring-1 ring-border-accent/30'
      )}
    >
      {/* Pinned indicator */}
      {isPinned && (
        <div className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-surface-card border border-border-accent">
          <Pin className="w-3 h-3 text-border-accent" />
        </div>
      )}

      {/* Unread badge */}
      {hasUnread && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-border-accent text-white text-[10px] font-bold">
          {workspace.unread}
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Header: Name + Type Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-border-accent transition-colors">
              {displayName}
            </h3>
            {workspace.intendedTargetBranch && (
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-text-faint">
                <ArrowRight className="w-3 h-3" />
                <span className="truncate">{workspace.intendedTargetBranch}</span>
              </div>
            )}
          </div>
          <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium', typeConfig.bgColor, typeConfig.color)}>
            {typeConfig.icon}
            <span className="hidden sm:inline">{typeConfig.label}</span>
          </div>
        </div>

        {/* Status Row */}
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-1.5 text-xs', status === 'done' ? 'text-emerald-400' : status === 'blocked' ? 'text-red-400' : status === 'needs-review' ? 'text-amber-400' : 'text-blue-400')}>
            {statusConfig.icon}
            <span className="font-medium">{statusConfig.label}</span>
          </div>
          {timeAgo && (
            <div className="flex items-center gap-1 text-[11px] text-text-faint">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </div>
          )}
        </div>

        {/* Notes preview */}
        {workspace.notes && (
          <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
            {workspace.notes}
          </p>
        )}

        {/* Footer: Meta info */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
          <div className="flex items-center gap-2 text-[10px] text-text-faint">
            {workspace.createdAt && (
              <span>Created {formatDate(workspace.createdAt)}</span>
            )}
          </div>

          {/* Archive button */}
          <div
            className={cn(
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary'
            )}
            onClick={(e) => {
              e.stopPropagation()
              console.log(isArchived ? 'Restore:' : 'Archive:', workspace.id)
            }}
            role="button"
            tabIndex={0}
            title={isArchived ? 'Restore' : 'Archive'}
          >
            {isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>
    </button>
  )
}

// ============================================================================
// Featured/Pinned Workspace Card - Larger Format
// ============================================================================

function FeaturedWorkspaceCard({ workspace, onClick, index }: WorkspaceCardProps) {
  const status = workspace.manualStatus ?? workspace.derivedStatus ?? 'in-progress'
  const statusConfig = STATUS_CONFIG[status]
  const typeConfig = WORKSPACE_TYPE_CONFIG[workspace.worktreeType ?? 'standard']
  const displayName = workspace.branch ?? workspace.worktreePath?.split('/').pop() ?? 'unnamed'
  const timeAgo = formatTimeAgo(workspace.updatedAt)
  const hasUnread = (workspace.unread ?? 0) > 0

  return (
    <button
      data-testid="workspace-card-featured"
      onClick={onClick}
      style={{ animationDelay: `${index * 50}ms` }}
      className={cn(
        'group relative text-left w-full col-span-2',
        'rounded-2xl border-l-4 transition-all duration-300',
        'bg-gradient-to-br from-surface-card via-surface-card to-surface-hover/30',
        'border border-border-subtle border-l-0',
        'hover:border-border-accent hover:shadow-2xl hover:shadow-border-accent/10',
        'animate-in fade-in slide-in-from-bottom-3',
        statusConfig.accentColor
      )}
    >
      {/* Pinned glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-border-accent/5 to-transparent pointer-events-none" />

      {/* Pinned indicator */}
      <div className="absolute -top-2 -right-2 p-1.5 rounded-full bg-border-accent shadow-lg">
        <Pin className="w-4 h-4 text-white" />
      </div>

      {/* Unread badge */}
      {hasUnread && (
        <div className="absolute top-4 right-12 flex items-center gap-1 px-2.5 py-1 rounded-full bg-border-accent text-white text-xs font-bold shadow-lg">
          <MessagesSquare className="w-3.5 h-3.5" />
          {workspace.unread} new
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium mb-2', typeConfig.bgColor, typeConfig.color)}>
              {typeConfig.icon}
              {typeConfig.label}
            </div>
            <h3 className="text-lg font-bold text-text-primary truncate group-hover:text-border-accent transition-colors">
              {displayName}
            </h3>
            {workspace.intendedTargetBranch && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-text-muted">
                <ArrowRight className="w-3.5 h-3.5" />
                <span>targeting <span className="font-mono text-text-primary">{workspace.intendedTargetBranch}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Status + Time */}
        <div className="flex items-center gap-4">
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium', status === 'done' ? 'bg-emerald-500/10 text-emerald-400' : status === 'blocked' ? 'bg-red-500/10 text-red-400' : status === 'needs-review' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400')}>
            {statusConfig.icon}
            {statusConfig.label}
          </div>
          {timeAgo && (
            <div className="flex items-center gap-1.5 text-sm text-text-muted">
              <Clock className="w-4 h-4" />
              Updated {timeAgo}
            </div>
          )}
        </div>

        {/* Notes */}
        {workspace.notes && (
          <p className="text-sm text-text-muted line-clamp-2 leading-relaxed">
            {workspace.notes}
          </p>
        )}

        {/* CTA */}
        <div className="flex items-center gap-2 pt-2 text-sm text-border-accent font-medium group-hover:gap-3 transition-all">
          <span>Continue working</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  )
}

// ============================================================================
// Stats Summary
// ============================================================================

function WorkspaceStats({ workspaces }: { workspaces: Worktree[] }) {
  const stats = useMemo(() => {
    const inProgress = workspaces.filter(w => (w.manualStatus ?? w.derivedStatus) === 'in-progress').length
    const needsReview = workspaces.filter(w => (w.manualStatus ?? w.derivedStatus) === 'needs-review').length
    const done = workspaces.filter(w => (w.manualStatus ?? w.derivedStatus) === 'done').length
    const blocked = workspaces.filter(w => (w.manualStatus ?? w.derivedStatus) === 'blocked').length
    const totalUnread = workspaces.reduce((acc, w) => acc + (w.unread ?? 0), 0)
    return { inProgress, needsReview, done, blocked, totalUnread, total: workspaces.length }
  }, [workspaces])

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-text-faint">Total:</span>
        <span className="font-semibold text-text-primary">{stats.total}</span>
      </div>
      {stats.inProgress > 0 && (
        <div className="flex items-center gap-1.5 text-blue-400">
          <Zap className="w-4 h-4" />
          <span className="font-medium">{stats.inProgress}</span>
          <span className="text-text-faint">active</span>
        </div>
      )}
      {stats.needsReview > 0 && (
        <div className="flex items-center gap-1.5 text-amber-400">
          <MessageSquare className="w-4 h-4" />
          <span className="font-medium">{stats.needsReview}</span>
          <span className="text-text-faint">review</span>
        </div>
      )}
      {stats.blocked > 0 && (
        <div className="flex items-center gap-1.5 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">{stats.blocked}</span>
          <span className="text-text-faint">blocked</span>
        </div>
      )}
      {stats.totalUnread > 0 && (
        <div className="flex items-center gap-1.5 text-border-accent">
          <MessagesSquare className="w-4 h-4" />
          <span className="font-medium">{stats.totalUnread}</span>
          <span className="text-text-faint">unread</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Empty State - Premium Design
// ============================================================================

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8" data-testid="empty-state">
      <div className="text-center max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* ASCII Art Logo */}
        <div className="mb-8 opacity-30">
          <KodaAsciiLogo animated={false} size="medium" />
        </div>

        <h2 className="text-2xl font-bold text-text-primary mb-3">
          Welcome to KODA
        </h2>
        <p className="text-text-muted mb-8 leading-relaxed">
          Create your first workspace to start building with AI-powered development.
          Each workspace is an isolated environment for focused work.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onCreateClick}
            data-testid="new-workspace-button-empty"
            className={cn(
              'group flex items-center gap-3 px-6 py-3 rounded-xl',
              'bg-border-accent text-white font-medium',
              'hover:bg-border-accent/90 hover:shadow-lg hover:shadow-border-accent/25',
              'transition-all duration-200'
            )}
          >
            <Plus className="w-5 h-5" />
            Create Workspace
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Feature hints */}
        <div className="mt-12 grid grid-cols-3 gap-6 text-left">
          {[
            { icon: <GitBranch className="w-5 h-5" />, title: 'Git Worktrees', desc: 'Isolated branches for parallel work' },
            { icon: <Bot className="w-5 h-5" />, title: 'AI Agents', desc: 'Let agents handle the heavy lifting' },
            { icon: <FileText className="w-5 h-5" />, title: 'Spec-Driven', desc: 'Define specs, let AI implement' },
          ].map((feature, i) => (
            <div key={i} className="p-4 rounded-lg bg-surface-card/50 border border-border-subtle">
              <div className="text-border-accent mb-2">{feature.icon}</div>
              <h4 className="text-sm font-medium text-text-primary mb-1">{feature.title}</h4>
              <p className="text-xs text-text-faint">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

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

  // Separate pinned and regular workspaces
  const { pinnedWorkspaces, regularWorkspaces } = useMemo(() => {
    if (!workspaces) return { pinnedWorkspaces: [], regularWorkspaces: [] }

    const pinned = workspaces.filter(w => w.pinnedAt && w.state !== 'archived')
    const regular = workspaces.filter(w => !w.pinnedAt && w.state !== 'archived')

    // Sort by updatedAt
    const sortByDate = (a: Worktree, b: Worktree) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bTime - aTime
    }

    return {
      pinnedWorkspaces: pinned.sort(sortByDate),
      regularWorkspaces: regular.sort(sortByDate),
    }
  }, [workspaces])

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
  const hasWorkspaces = workspaces && workspaces.length > 0
  const hasRepos = repos && repos.length > 0

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-messages">
        <KodaSpinner style="wave" label="Loading workspaces" />
      </div>
    )
  }

  if (workspacesError) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-messages">
        <div className="text-center max-w-md p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Failed to load workspaces</h2>
          <p className="text-sm text-text-muted">
            {workspacesError instanceof Error ? workspacesError.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-messages">
      {/* Header */}
      <header className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">
              Workspaces
            </h1>
            {hasWorkspaces && workspaces && <WorkspaceStats workspaces={workspaces} />}
            {!hasWorkspaces && (
              <p className="text-text-muted">Isolated environments for focused AI-powered development</p>
            )}
          </div>
          <button
            onClick={() => { setIsCreateOpen(true) }}
            data-testid="new-workspace-button"
            className={cn(
              'group flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'bg-surface-card border border-border-subtle',
              'hover:border-border-accent hover:bg-surface-hover',
              'text-sm font-medium text-text-primary',
              'transition-all duration-200'
            )}
          >
            <Plus className="w-4 h-4 text-border-accent" />
            New Workspace
          </button>
        </div>
      </header>

      {/* Content */}
      {hasWorkspaces ? (
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {/* Pinned Workspaces */}
          {pinnedWorkspaces.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-text-faint uppercase tracking-wider mb-4 flex items-center gap-2">
                <Pin className="w-3.5 h-3.5" />
                Pinned
              </h2>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2" data-testid="pinned-workspace-grid">
                {pinnedWorkspaces.map((workspace, index) => (
                  <FeaturedWorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    onClick={() => { handleWorkspaceClick(workspace) }}
                    index={index}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recent Workspaces */}
          {regularWorkspaces.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-text-faint uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Recent
              </h2>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" data-testid="workspace-grid">
                {regularWorkspaces.map((workspace, index) => (
                  <WorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    onClick={() => { handleWorkspaceClick(workspace) }}
                    index={index}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <EmptyState onCreateClick={() => { setIsCreateOpen(true) }} />
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-surface-card border border-border-subtle rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            onClick={(e) => { e.stopPropagation() }}
          >
            {/* Step 1: Choose workspace type */}
            {createMode === 'choose' && (
              <>
                <h2 className="text-xl font-bold text-text-primary mb-2">New Workspace</h2>
                <p className="text-sm text-text-muted mb-6">
                  Choose how to create your workspace.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => { setCreateMode('repo') }}
                    data-testid="create-with-repo"
                    className="w-full text-left p-4 border border-border-subtle rounded-xl hover:border-border-accent hover:bg-surface-hover transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                        <FolderGit2 className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-text-primary mb-0.5">From Repository</div>
                        <div className="text-xs text-text-faint">Connect a git repo and create a worktree branch</div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-text-dim group-hover:text-border-accent group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>

                  <button
                    onClick={() => { setCreateMode('standalone') }}
                    data-testid="create-standalone"
                    className="w-full text-left p-4 border border-border-subtle rounded-xl hover:border-border-accent hover:bg-surface-hover transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-text-primary mb-0.5">Standalone</div>
                        <div className="text-xs text-text-faint">Create workspace first, connect repository later</div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-text-dim group-hover:text-border-accent group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Step 2a: Select repository */}
            {createMode === 'repo' && (
              <>
                <h2 className="text-xl font-bold text-text-primary mb-2">Select Repository</h2>

                {createError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {createError}
                  </div>
                )}

                <p className="text-sm text-text-muted mb-6">
                  Choose a git repository to create a new workspace branch.
                </p>

                {/* Existing repos */}
                {hasRepos && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-text-faint uppercase tracking-wider mb-2">Recent Repositories</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto" data-testid="repo-list">
                      {repos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => { handleRepoSelect(repo.id) }}
                          data-testid={`repo-button-${repo.id}`}
                          className="w-full text-left p-3 border border-border-subtle rounded-lg hover:border-border-accent hover:bg-surface-hover transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <FolderGit2 className="w-5 h-5 text-text-dim group-hover:text-border-accent transition-colors" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-text-primary truncate">{repo.name}</div>
                              <div className="text-xs text-text-faint truncate">{repo.rootPath}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new repo */}
                <button
                  onClick={() => void handleSelectFolder()}
                  disabled={createRepo.isPending}
                  className="w-full p-4 border-2 border-dashed border-border-subtle rounded-xl hover:border-border-accent hover:bg-surface-hover transition-all flex items-center justify-center gap-2 text-text-muted hover:text-text-primary"
                >
                  <Plus className="w-5 h-5" />
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
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Step 2b: Standalone workspace name */}
            {createMode === 'standalone' && (
              <>
                <h2 className="text-xl font-bold text-text-primary mb-2">Standalone Workspace</h2>

                {createError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {createError}
                  </div>
                )}

                <p className="text-sm text-text-muted mb-6">
                  Create a workspace without a repository. You can connect one later.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-faint uppercase tracking-wider mb-2">Workspace Name</label>
                    <input
                      type="text"
                      value={standaloneName}
                      onChange={(e) => { setStandaloneName(e.target.value) }}
                      placeholder="My Workspace"
                      data-testid="standalone-name-input"
                      className="w-full px-4 py-3 border border-border-subtle rounded-xl bg-surface-inset text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-border-accent focus:border-transparent transition-all"
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
                      className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleCreateStandalone()}
                      disabled={!standaloneName.trim() || createStandaloneWorkspace.isPending}
                      data-testid="create-standalone-button"
                      className={cn(
                        'px-5 py-2 text-sm font-medium rounded-xl transition-all',
                        'bg-border-accent text-white',
                        'hover:bg-border-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {createStandaloneWorkspace.isPending ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Branch name (for repo-based) */}
            {createMode === 'branch' && (
              <>
                <h2 className="text-xl font-bold text-text-primary mb-2">Create Branch</h2>

                {createError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {createError}
                  </div>
                )}

                <div className="mb-6 p-3 rounded-xl bg-surface-hover border border-border-subtle">
                  <div className="flex items-center gap-3">
                    <FolderGit2 className="w-5 h-5 text-border-accent" />
                    <div>
                      <div className="text-sm font-medium text-text-primary">{selectedRepo?.name}</div>
                      <div className="text-xs text-text-faint truncate">{selectedRepo?.rootPath}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-faint uppercase tracking-wider mb-2">Branch Name</label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => { setBranchName(e.target.value) }}
                      placeholder="feature/my-feature"
                      className="w-full px-4 py-3 border border-border-subtle rounded-xl bg-surface-inset text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-border-accent focus:border-transparent transition-all font-mono"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleCreateWorktree()
                        if (e.key === 'Escape') closeModal()
                      }}
                    />
                    <p className="text-xs text-text-faint mt-2">
                      A git worktree will be created for isolated work
                    </p>
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => { setCreateMode('repo') }}
                    data-testid="modal-back-button"
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                  >
                    Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleCreateWorktree()}
                      disabled={!branchName.trim() || createWorktree.isPending}
                      className={cn(
                        'px-5 py-2 text-sm font-medium rounded-xl transition-all',
                        'bg-border-accent text-white',
                        'hover:bg-border-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
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
    </div>
  )
}
