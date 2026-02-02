import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useAllWorktrees, useRepos, useSidecar } from '@/hooks/useRpc'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn } from '@/lib/utils'
import type { Worktree, Repo, WorktreeStatus } from '@/lib/rpc'
import { useState, useMemo, useRef } from 'react'
import { KodaSpinner } from '@/components/KodaSpinner'

// ============================================================================
// Terminal-style Status Labels
// ============================================================================

const STATUS_LABELS: Record<WorktreeStatus, string> = {
  'in-progress': 'ACTV',
  done: 'DONE',
  blocked: 'BLKD',
  'needs-review': 'REVW',
}

function getStatusColor(status?: WorktreeStatus | null): string {
  if (status === 'done') return 'text-status-success'
  if (status === 'blocked') return 'text-status-error'
  if (status === 'needs-review') return 'text-status-warning'
  return 'text-border-accent'
}

// ============================================================================
// Time Formatting - Terminal Style
// ============================================================================

function formatTimeAgo(date: string | null | undefined): string {
  if (!date) return '--'

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
// ASCII Progress Bar
// ============================================================================

interface UsageBarProps {
  label: string
  value: number
  max: number
}

function UsageBar({ label, value, max }: UsageBarProps): React.ReactElement {
  const percent = Math.min(100, Math.round((value / max) * 100))
  const filled = Math.round(percent / 10)
  const empty = 10 - filled
  const isHigh = percent > 80

  return (
    <div className="font-mono text-[10px] flex items-center gap-2">
      <span className="text-text-dim w-14 uppercase">{label}</span>
      <span className={cn('tracking-tighter', isHigh ? 'text-status-warning' : 'text-border-accent')}>
        [{`${'█'.repeat(filled)}${'░'.repeat(empty)}`}]
      </span>
      <span className={cn('w-8 text-right tabular-nums', isHigh ? 'text-status-warning' : 'text-text-dim')}>
        {percent}%
      </span>
    </div>
  )
}

// ============================================================================
// Terminal Dropdown Menu
// ============================================================================

interface DropdownMenuProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

function DropdownMenu({ isOpen, onClose, children }: DropdownMenuProps): React.ReactElement | null {
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside(menuRef, {
    onClickOutside: onClose,
    onEscape: onClose,
    enabled: isOpen,
  })

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="absolute right-0 z-50 mt-1 min-w-[180px] font-mono text-xs bg-surface-card border border-dashed border-text-dim/30"
    >
      {children}
    </div>
  )
}

interface MenuItemProps {
  label: string
  shortcut?: string
  onClick: () => void
  destructive?: boolean
}

function MenuItem({ label, shortcut, onClick, destructive }: MenuItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-4 w-full px-3 py-1.5 text-left',
        'hover:bg-surface-hover transition-colors',
        destructive ? 'text-status-error hover:text-status-error' : 'text-text-primary hover:text-border-accent'
      )}
    >
      <span>{label}</span>
      {shortcut && <span className="text-text-dim">{shortcut}</span>}
    </button>
  )
}

function MenuSeparator(): React.ReactElement {
  return <div className="border-t border-dashed border-text-dim/20" />
}

// ============================================================================
// Repo Actions Dropdown
// ============================================================================

function RepoActionsDropdown({
  repo,
  onClose,
}: {
  repo: Repo
  onClose: () => void
}): React.ReactElement {
  const navigate = useNavigate()

  return (
    <DropdownMenu isOpen onClose={onClose}>
      <div className="py-1">
        <MenuItem
          label="[+] NEW WORKSPACE"
          onClick={() => {
            onClose()
            void navigate({ to: '/' })
          }}
        />
        <MenuItem
          label="[↗] OPEN IN FINDER"
          onClick={() => {
            onClose()
            console.log('Open in Finder:', repo.rootPath)
          }}
        />
        <MenuItem
          label="[⌘] OPEN IN EDITOR"
          onClick={() => {
            onClose()
            console.log('Open in editor:', repo.rootPath)
          }}
        />
        <MenuItem
          label="[⎘] COPY PATH"
          onClick={() => {
            onClose()
            void navigator.clipboard.writeText(repo.rootPath)
          }}
        />
        <MenuSeparator />
        <MenuItem
          label="[×] REMOVE REPO"
          onClick={() => {
            onClose()
            console.log('Remove repo:', repo.id)
          }}
          destructive
        />
      </div>
    </DropdownMenu>
  )
}

// ============================================================================
// Workspace Context Menu
// ============================================================================

function WorkspaceContextMenu({
  workspace,
  position,
  onClose,
}: {
  workspace: Worktree
  position: { x: number; y: number }
  onClose: () => void
}): React.ReactElement {
  const menuRef = useRef<HTMLDivElement>(null)
  const isPinned = Boolean(workspace.pinnedAt)
  const isArchived = workspace.state === 'archived'

  useClickOutside(menuRef, {
    onClickOutside: onClose,
    onEscape: onClose,
  })

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] font-mono text-xs bg-surface-card border border-dashed border-text-dim/30"
      style={{ top: position.y, left: position.x }}
    >
      <div className="py-1">
        <MenuItem
          label={isPinned ? '[⊘] UNPIN' : '[⊕] PIN TO TOP'}
          onClick={() => {
            onClose()
            console.log(isPinned ? 'Unpin:' : 'Pin:', workspace.id)
          }}
        />
        <MenuItem
          label="[⎘] COPY BRANCH"
          onClick={() => {
            onClose()
            void navigator.clipboard.writeText(workspace.branch ?? '')
          }}
        />
        <MenuItem
          label="[↗] OPEN IN FINDER"
          onClick={() => {
            onClose()
            console.log('Open in Finder:', workspace.worktreePath)
          }}
        />
        <MenuItem
          label="[⌘] OPEN IN EDITOR"
          onClick={() => {
            onClose()
            console.log('Open in editor:', workspace.worktreePath)
          }}
        />
        <MenuSeparator />
        <MenuItem
          label={isArchived ? '[↺] RESTORE' : '[⌫] ARCHIVE'}
          onClick={() => {
            onClose()
            console.log(isArchived ? 'Unarchive:' : 'Archive:', workspace.id)
          }}
          destructive={!isArchived}
        />
        {isArchived && (
          <MenuItem
            label="[×] DELETE"
            onClick={() => {
              onClose()
              console.log('Delete:', workspace.id)
            }}
            destructive
          />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Workspace Row - Terminal Style
// ============================================================================

function WorkspaceRow({
  workspace,
  isActive,
  showPinIndicator = false,
}: {
  workspace: Worktree
  isActive: boolean
  showPinIndicator?: boolean
}): React.ReactElement {
  const status = workspace.manualStatus ?? workspace.derivedStatus ?? 'in-progress'
  const statusLabel = STATUS_LABELS[status]
  const statusColor = getStatusColor(status)
  const timeAgo = formatTimeAgo(workspace.updatedAt)
  const unreadCount = workspace.unread ?? 0
  const isArchived = workspace.state === 'archived'
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <Link
        to="/workspace/$id"
        params={{ id: workspace.id }}
        className={cn(
          'group flex items-center gap-2 px-2 py-1.5 font-mono text-xs',
          'border-l-2 border-transparent',
          'hover:bg-surface-hover hover:border-l-border-accent/50',
          'transition-colors duration-75',
          isActive && 'bg-surface-hover border-l-border-accent',
          isArchived && 'opacity-40'
        )}
        onContextMenu={handleContextMenu}
      >
        {/* Pin indicator */}
        <span className={cn('w-3', showPinIndicator ? 'text-border-accent' : 'text-text-dim/30')}>
          {showPinIndicator ? '▸' : '·'}
        </span>

        {/* Status */}
        <span className={cn('w-12 font-bold', statusColor)}>
          [{statusLabel}]
        </span>

        {/* Branch name */}
        <span className={cn(
          'flex-1 truncate',
          'text-text-primary group-hover:text-border-accent',
          isActive && 'text-border-accent'
        )}>
          {workspace.branch ?? 'unnamed'}
        </span>

        {/* Unread count */}
        {unreadCount > 0 && (
          <span className="px-1 bg-border-accent text-white text-[9px] font-bold">
            {unreadCount}
          </span>
        )}

        {/* Time */}
        <span className="w-8 text-right text-text-dim tabular-nums">
          {timeAgo}
        </span>
      </Link>

      {/* Context menu */}
      {contextMenu && (
        <WorkspaceContextMenu
          workspace={workspace}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

// ============================================================================
// Repo Group - Terminal Style
// ============================================================================

function RepoGroup({
  repo,
  workspaces,
  activeWorkspaceId,
}: {
  repo: Repo
  workspaces: Worktree[]
  activeWorkspaceId?: string
}): React.ReactElement {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const repoName = repo.name ?? repo.rootPath.split('/').pop() ?? 'Repository'

  return (
    <div className="mb-2">
      {/* Repo header */}
      <div className="flex items-center group">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 px-2 py-1 font-mono text-xs hover:bg-surface-hover transition-colors"
        >
          <span className="text-text-dim">{isExpanded ? '▼' : '▶'}</span>
          <span className="text-text-primary uppercase tracking-wide truncate flex-1 text-left">
            {repoName}
          </span>
          <span className="text-text-dim">({workspaces.length})</span>
        </button>

        {/* Actions (visible on hover) */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity relative">
          <button
            className="px-1 py-0.5 text-text-dim hover:text-border-accent font-mono text-[10px]"
            title="More actions"
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}
          >
            [···]
          </button>
          <button
            className="px-1 py-0.5 text-text-dim hover:text-border-accent font-mono text-[10px]"
            title="New workspace"
            onClick={(e) => {
              e.stopPropagation()
              void navigate({ to: '/', search: { repoId: repo.id } })
            }}
          >
            [+]
          </button>

          {showDropdown && (
            <RepoActionsDropdown repo={repo} onClose={() => setShowDropdown(false)} />
          )}
        </div>
      </div>

      {/* Workspaces */}
      {isExpanded && (
        <div className="border-l border-dashed border-text-dim/20 ml-3">
          {workspaces.length === 0 ? (
            <div className="px-3 py-2 text-[10px] text-text-dim font-mono italic">
              -- NO WORKSPACES --
            </div>
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
// Sidebar Header - Terminal Style
// ============================================================================

function SidebarHeader(): React.ReactElement {
  const navigate = useNavigate()

  return (
    <div className="border-b border-dashed border-text-dim/20">
      {/* Row 1: Traffic lights space + nav */}
      <div
        className="flex items-center justify-between pl-[70px] pr-2 h-10"
        data-tauri-drag-region
      >
        <div className="flex-1" data-tauri-drag-region />
        <div className="flex items-center font-mono text-[10px]">
          <button
            className="px-1 text-text-dim hover:text-border-accent transition-colors"
            onClick={() => void navigate({ to: '/' })}
            title="Back"
          >
            [←]
          </button>
          <button
            className="px-1 text-text-dim hover:text-border-accent transition-colors"
            title="Forward"
          >
            [→]
          </button>
        </div>
      </div>

      {/* Row 2: Title */}
      <div className="px-3 py-2 font-mono">
        <div className="text-xs text-text-dim">┌─ WORKSPACES ─────────────────</div>
      </div>
    </div>
  )
}

// ============================================================================
// Sidebar Footer - Terminal Style
// ============================================================================

function SidebarFooter(): React.ReactElement {
  const { status } = useSidecar()
  const navigate = useNavigate()

  return (
    <div className="border-t border-dashed border-text-dim/20 font-mono">
      {/* Usage stats */}
      <div className="px-3 py-2 space-y-1 border-b border-dashed border-text-dim/20">
        <UsageBar label="SESSION" value={45} max={100} />
        <UsageBar label="WEEKLY" value={230} max={1000} />
      </div>

      {/* Add repository button */}
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-dim hover:text-border-accent hover:bg-surface-hover transition-colors"
        onClick={() => void navigate({ to: '/' })}
      >
        [+] ADD REPOSITORY
      </button>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-dashed border-text-dim/20 text-[10px]">
        <div className="flex items-center gap-2">
          <span className={cn(
            status?.running ? 'text-status-success' : 'text-text-dim'
          )}>
            {status?.running ? '●' : '○'}
          </span>
          <span className="text-text-dim uppercase">
            {status?.running ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-text-dim hover:text-border-accent transition-colors"
            title="Help"
          >
            [?]
          </button>
          <Link
            to="/settings"
            className="text-text-dim hover:text-border-accent transition-colors"
            title="Settings"
          >
            [⚙]
          </Link>
        </div>
      </div>

      {/* ASCII footer decoration */}
      <div className="px-3 py-1 text-[10px] text-text-dim/50">
        └─────────────────────────────┘
      </div>
    </div>
  )
}

// ============================================================================
// Pinned Workspaces Section - Terminal Style
// ============================================================================

function PinnedWorkspacesSection({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: Worktree[]
  activeWorkspaceId?: string
}): React.ReactElement | null {
  const [isExpanded, setIsExpanded] = useState(true)

  if (workspaces.length === 0) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-2 py-1 font-mono text-xs hover:bg-surface-hover transition-colors"
      >
        <span className="text-border-accent">{isExpanded ? '▼' : '▶'}</span>
        <span className="text-border-accent uppercase tracking-wide flex-1 text-left">[PINNED]</span>
        <span className="text-text-dim">({workspaces.length})</span>
      </button>
      {isExpanded && (
        <div className="border-l border-dashed border-border-accent/30 ml-3">
          {workspaces.map((ws) => (
            <WorkspaceRow
              key={ws.id}
              workspace={ws}
              isActive={ws.id === activeWorkspaceId}
              showPinIndicator
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Archived Workspaces Section - Terminal Style
// ============================================================================

function ArchivedWorkspacesSection({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: Worktree[]
  activeWorkspaceId?: string
}): React.ReactElement | null {
  const [isExpanded, setIsExpanded] = useState(false)

  if (workspaces.length === 0) return null

  return (
    <div className="mt-2 pt-2 border-t border-dashed border-text-dim/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-2 py-1 font-mono text-xs hover:bg-surface-hover transition-colors"
      >
        <span className="text-text-dim">{isExpanded ? '▼' : '▶'}</span>
        <span className="text-text-dim uppercase tracking-wide flex-1 text-left">[ARCHIVED]</span>
        <span className="text-text-dim">({workspaces.length})</span>
      </button>
      {isExpanded && (
        <div className="border-l border-dashed border-text-dim/20 ml-3">
          {workspaces.map((ws) => (
            <WorkspaceRow
              key={ws.id}
              workspace={ws}
              isActive={ws.id === activeWorkspaceId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Workspace List (grouped by repo)
// ============================================================================

function WorkspaceListContent(): React.ReactElement {
  const { data: workspaces, isLoading: loadingWorkspaces } = useAllWorktrees()
  const { data: repos, isLoading: loadingRepos } = useRepos()
  const params = useParams({ strict: false })
  const activeId = (params as { id?: string }).id

  const { pinnedWorkspaces, archivedWorkspaces, groupedWorkspaces } = useMemo(() => {
    if (!workspaces || !repos) {
      return {
        pinnedWorkspaces: [] as Worktree[],
        archivedWorkspaces: [] as Worktree[],
        groupedWorkspaces: new Map<string, { repo: Repo; workspaces: Worktree[] }>(),
      }
    }

    const pinned: Worktree[] = []
    const archived: Worktree[] = []
    const groups = new Map<string, { repo: Repo; workspaces: Worktree[] }>()

    for (const repo of repos) {
      groups.set(repo.id, { repo, workspaces: [] })
    }

    for (const ws of workspaces) {
      if (ws.state === 'archived') {
        archived.push(ws)
      } else if (ws.pinnedAt) {
        pinned.push(ws)
      } else if (ws.repoId && groups.has(ws.repoId)) {
        groups.get(ws.repoId)?.workspaces.push(ws)
      }
    }

    // Sort pinned by pinnedAt
    pinned.sort((a, b) => {
      const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
      const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
      return bTime - aTime
    })

    // Sort archived by updatedAt
    archived.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bTime - aTime
    })

    // Sort workspaces within groups
    for (const group of groups.values()) {
      group.workspaces.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
    }

    return { pinnedWorkspaces: pinned, archivedWorkspaces: archived, groupedWorkspaces: groups }
  }, [workspaces, repos])

  if (loadingWorkspaces || loadingRepos) {
    return (
      <div className="flex items-center justify-center py-8">
        <KodaSpinner style="scan" />
      </div>
    )
  }

  const hasNoWorkspaces = groupedWorkspaces.size === 0 && pinnedWorkspaces.length === 0

  if (hasNoWorkspaces) {
    return (
      <div className="px-3 py-8 text-center font-mono">
        <pre className="text-[10px] text-text-dim mb-4">
{`┌──────────────────┐
│  NO REPOS YET    │
│                  │
│  Add a repo to   │
│  get started     │
└──────────────────┘`}
        </pre>
      </div>
    )
  }

  return (
    <div className="px-1">
      <PinnedWorkspacesSection workspaces={pinnedWorkspaces} activeWorkspaceId={activeId} />

      {Array.from(groupedWorkspaces.values()).map(({ repo, workspaces: repoWorkspaces }) => (
        <RepoGroup
          key={repo.id}
          repo={repo}
          workspaces={repoWorkspaces}
          activeWorkspaceId={activeId}
        />
      ))}

      <ArchivedWorkspacesSection workspaces={archivedWorkspaces} activeWorkspaceId={activeId} />
    </div>
  )
}

// ============================================================================
// Main Sidebar
// ============================================================================

export function Sidebar(): React.ReactElement {
  return (
    <div className="flex flex-col h-full bg-surface-sidebar">
      <SidebarHeader />

      <div className="flex-1 overflow-y-auto py-1">
        <WorkspaceListContent />
      </div>

      <SidebarFooter />
    </div>
  )
}
