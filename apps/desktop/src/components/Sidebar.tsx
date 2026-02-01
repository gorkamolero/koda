import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useAllWorktrees, useRepos, useSidecar } from '@/hooks/useRpc'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn } from '@/lib/utils'
import type { Worktree, Repo, WorktreeStatus } from '@/lib/rpc'
import { useState, useMemo, useRef } from 'react'
import {
  Plus,
  Settings,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Check,
  AlertCircle,
  HelpCircle,
  Archive,
  FolderPlus,
  Pin,
  MessageCircle,
  FolderOpen,
  Trash2,
  ExternalLink,
  Copy,
  PinOff,
  ArchiveRestore,
} from 'lucide-react'
import { KodaSpinner } from '@/components/KodaSpinner'

// ============================================================================
// Shared Components
// ============================================================================

interface ExpandChevronProps {
  isExpanded: boolean
  className?: string
}

function ExpandChevron({ isExpanded, className = 'w-4 h-4 text-text-dim' }: ExpandChevronProps): React.ReactElement {
  const Icon = isExpanded ? ChevronDown : ChevronRight
  return <Icon className={className} />
}

// ============================================================================
// Usage Bar
// ============================================================================

interface UsageBarProps {
  label: string
  value: number
  max: number
}

function UsageBar({ label, value, max }: UsageBarProps): React.ReactElement {
  const percent = Math.min(100, Math.round((value / max) * 100))
  const isHigh = percent > 80

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-faint">{label}</span>
        <span className={cn('text-text-muted', isHigh && 'text-orange-400')}>
          {percent}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-surface-inset overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isHigh
              ? 'bg-gradient-to-r from-orange-500 to-red-500'
              : 'bg-gradient-to-r from-blue-500 to-emerald-500'
          )}
          style={{ width: `${String(percent)}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Status Indicators
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
// Dropdown Menu Component
// ============================================================================

interface DropdownMenuProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  align?: 'left' | 'right'
}

function DropdownMenu({ isOpen, onClose, children, align = 'right' }: DropdownMenuProps): React.ReactElement | null {
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
      className={cn(
        'absolute z-50 mt-1 py-1 min-w-[160px] rounded-md',
        'bg-surface-overlay border border-border-subtle shadow-lg',
        align === 'right' ? 'right-0' : 'left-0'
      )}
    >
      {children}
    </div>
  )
}

interface MenuItemProps {
  icon?: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  destructive?: boolean
}

function MenuItem({ icon, children, onClick, destructive }: MenuItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left',
        'hover:bg-surface-hover transition-colors',
        destructive ? 'text-red-400 hover:text-red-300' : 'text-text-primary'
      )}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  )
}

function MenuSeparator(): React.ReactElement {
  return <div className="my-1 border-t border-border-subtle" />
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
      <MenuItem
        icon={<Plus className="w-4 h-4" />}
        onClick={() => {
          onClose()
          // TODO: Navigate to new workspace with repo pre-selected
          void navigate({ to: '/' })
        }}
      >
        New workspace
      </MenuItem>
      <MenuItem
        icon={<FolderOpen className="w-4 h-4" />}
        onClick={() => {
          onClose()
          // TODO: Open in Finder/Explorer
          console.log('Open in Finder:', repo.rootPath)
        }}
      >
        Open in Finder
      </MenuItem>
      <MenuItem
        icon={<ExternalLink className="w-4 h-4" />}
        onClick={() => {
          onClose()
          // TODO: Open in editor
          console.log('Open in editor:', repo.rootPath)
        }}
      >
        Open in Editor
      </MenuItem>
      <MenuItem
        icon={<Copy className="w-4 h-4" />}
        onClick={() => {
          onClose()
          void navigator.clipboard.writeText(repo.rootPath)
        }}
      >
        Copy path
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={<Trash2 className="w-4 h-4" />}
        onClick={() => {
          onClose()
          // TODO: Remove repository
          console.log('Remove repo:', repo.id)
        }}
        destructive
      >
        Remove repository
      </MenuItem>
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
      className="fixed z-50 py-1 min-w-[180px] rounded-md bg-surface-overlay border border-border-subtle shadow-lg"
      style={{ top: position.y, left: position.x }}
    >
      <MenuItem
        icon={isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        onClick={() => {
          onClose()
          // TODO: Toggle pin status
          console.log(isPinned ? 'Unpin:' : 'Pin:', workspace.id)
        }}
      >
        {isPinned ? 'Unpin' : 'Pin to top'}
      </MenuItem>
      <MenuItem
        icon={<Copy className="w-4 h-4" />}
        onClick={() => {
          onClose()
          void navigator.clipboard.writeText(workspace.branch ?? '')
        }}
      >
        Copy branch name
      </MenuItem>
      <MenuItem
        icon={<FolderOpen className="w-4 h-4" />}
        onClick={() => {
          onClose()
          // TODO: Open in Finder
          console.log('Open in Finder:', workspace.worktreePath)
        }}
      >
        Open in Finder
      </MenuItem>
      <MenuItem
        icon={<ExternalLink className="w-4 h-4" />}
        onClick={() => {
          onClose()
          // TODO: Open in editor
          console.log('Open in editor:', workspace.worktreePath)
        }}
      >
        Open in Editor
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
        onClick={() => {
          onClose()
          // TODO: Toggle archive status
          console.log(isArchived ? 'Unarchive:' : 'Archive:', workspace.id)
        }}
        destructive={!isArchived}
      >
        {isArchived ? 'Restore from archive' : 'Archive'}
      </MenuItem>
      {isArchived && (
        <MenuItem
          icon={<Trash2 className="w-4 h-4" />}
          onClick={() => {
            onClose()
            // TODO: Delete workspace permanently
            console.log('Delete:', workspace.id)
          }}
          destructive
        >
          Delete permanently
        </MenuItem>
      )}
    </div>
  )
}

// ============================================================================
// Workspace Row
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
  const status = workspace.manualStatus ?? workspace.derivedStatus
  const { icon, colorClass } = getStatusConfig(status)
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
          'group flex items-start gap-2 px-3 py-2 rounded-md transition-colors',
          'hover:bg-surface-hover',
          isActive && 'bg-surface-active'
        )}
        onContextMenu={handleContextMenu}
      >
        {/* Status icon */}
        <div className={cn('mt-1 flex-shrink-0 flex items-center justify-center w-4', colorClass)}>
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {showPinIndicator && (
                <Pin className="w-3 h-3 text-blue-400 flex-shrink-0" />
              )}
              <span className="text-text-primary text-sm font-medium truncate">
                {workspace.branch ?? 'unnamed'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {unreadCount > 0 && (
                <div className="flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  <MessageCircle className="w-3 h-3" />
                  <span>{String(unreadCount)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-faint">
            <span className="truncate">{workspace.worktreePath?.split('/').pop() ?? workspace.branch}</span>
            {timeAgo && (
              <>
                <span>·</span>
                <span>{timeAgo}</span>
              </>
            )}
          </div>
        </div>

        {/* Archive action (visible on hover) */}
        <button
          className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'p-1 rounded hover:bg-surface-control text-text-muted hover:text-text-primary',
            'flex items-center gap-1 text-xs'
          )}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // TODO: Implement archive/restore
            console.log(isArchived ? 'Restore:' : 'Archive:', workspace.id)
          }}
          title={isArchived ? 'Restore' : 'Archive'}
        >
          {isArchived ? (
            <>
              <ArchiveRestore className="w-3.5 h-3.5" />
              <span>Restore</span>
            </>
          ) : (
            <>
              <Archive className="w-3.5 h-3.5" />
              <span>Archive</span>
            </>
          )}
        </button>
      </Link>

      {/* Context menu */}
      {contextMenu && (
        <WorkspaceContextMenu
          workspace={workspace}
          position={contextMenu}
          onClose={() => { setContextMenu(null) }}
        />
      )}
    </>
  )
}

// ============================================================================
// Repo Group
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
  const initial = (repoName[0] ?? 'R').toUpperCase()

  return (
    <div className="mb-3">
      {/* Repo header */}
      <div className="flex items-center gap-1 group">
        <button
          onClick={() => { setIsExpanded(!isExpanded) }}
          className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
        >
          {/* Avatar */}
          <div className="w-6 h-6 rounded bg-surface-control flex items-center justify-center text-xs font-semibold text-text-muted">
            {initial}
          </div>

          {/* Name */}
          <span className="text-text-primary text-sm font-medium truncate flex-1 text-left">
            {repoName}
          </span>

          <ExpandChevron isExpanded={isExpanded} className="w-4 h-4 text-text-dim flex-shrink-0" />
        </button>

        {/* Actions (visible on hover) */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity relative">
          <button
            className="p-1 rounded hover:bg-surface-control text-text-muted hover:text-text-primary"
            title="More actions"
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-surface-control text-text-muted hover:text-text-primary"
            title="New workspace"
            onClick={(e) => {
              e.stopPropagation()
              // Navigate to home with repo pre-selected for new workspace
              void navigate({ to: '/', search: { repoId: repo.id } })
            }}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Dropdown menu */}
          {showDropdown && (
            <RepoActionsDropdown repo={repo} onClose={() => { setShowDropdown(false) }} />
          )}
        </div>
      </div>

      {/* Workspaces */}
      {isExpanded && (
        <div className="ml-2 mt-1">
          {workspaces.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-faint italic">No workspaces</div>
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
// Sidebar Header
// ============================================================================

function SidebarHeader(): React.ReactElement {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
      <div className="flex items-center gap-2">
        {/* Workspaces icon */}
        <svg
          className="w-5 h-5 text-text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span className="text-text-primary font-semibold">Workspaces</span>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          onClick={() => { void navigate({ to: '/' }) }}
          title="Back"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          title="Forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Sidebar Footer
// ============================================================================

function SidebarFooter(): React.ReactElement {
  const { status } = useSidecar()
  const navigate = useNavigate()

  return (
    <div className="border-t border-border-subtle">
      {/* Usage stats (kept from original) */}
      <div className="px-4 py-3 space-y-2 border-b border-border-subtle">
        <UsageBar label="Session" value={45} max={100} />
        <UsageBar label="Weekly" value={230} max={1000} />
      </div>

      {/* Add repository button */}
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        onClick={() => { void navigate({ to: '/' }) }}
      >
        <FolderPlus className="w-4 h-4" />
        <span className="text-sm">Add repository</span>
      </button>

      {/* Bottom icons */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          {/* Sidecar status dot */}
          <span
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              status?.running ? 'bg-green-500' : 'bg-gray-500'
            )}
            title={status?.running ? 'Connected' : 'Disconnected'}
          />
          <span className="text-xs text-text-faint">
            {status?.running ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <Link
            to="/settings"
            className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Pinned Workspaces Section
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
    <div className="mb-3">
      <button
        onClick={() => { setIsExpanded(!isExpanded) }}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
      >
        <Pin className="w-4 h-4 text-blue-400" />
        <span className="text-text-primary text-sm font-medium flex-1 text-left">Pinned</span>
        <span className="text-xs text-text-faint">{workspaces.length}</span>
        <ExpandChevron isExpanded={isExpanded} />
      </button>
      {isExpanded && (
        <div className="ml-2 mt-1">
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
// Archived Workspaces Section
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
    <div className="mt-4 pt-4 border-t border-border-subtle">
      <button
        onClick={() => { setIsExpanded(!isExpanded) }}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
      >
        <Archive className="w-4 h-4 text-text-dim" />
        <span className="text-text-muted text-sm font-medium flex-1 text-left">Archived</span>
        <span className="text-xs text-text-faint">{workspaces.length}</span>
        <ExpandChevron isExpanded={isExpanded} />
      </button>
      {isExpanded && (
        <div className="ml-2 mt-1">
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

function WorkspaceList(): React.ReactElement {
  const { data: workspaces, isLoading: loadingWorkspaces } = useAllWorktrees()
  const { data: repos, isLoading: loadingRepos } = useRepos()
  const params = useParams({ strict: false })
  const activeId = (params as { id?: string }).id

  // Separate pinned, active, and archived workspaces
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

    // Initialize groups for all repos
    for (const repo of repos) {
      groups.set(repo.id, { repo, workspaces: [] })
    }

    // Categorize workspaces
    for (const ws of workspaces) {
      if (ws.state === 'archived') {
        archived.push(ws)
      } else if (ws.pinnedAt) {
        pinned.push(ws)
      } else if (ws.repoId && groups.has(ws.repoId)) {
        groups.get(ws.repoId)?.workspaces.push(ws)
      }
    }

    // Sort pinned by pinnedAt (most recently pinned first)
    pinned.sort((a, b) => {
      const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
      const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
      return bTime - aTime
    })

    // Sort archived by updatedAt (most recently archived first)
    archived.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bTime - aTime
    })

    // Sort workspaces within each group by updatedAt (most recent first)
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
        <KodaSpinner style="matrix" />
      </div>
    )
  }

  const hasNoWorkspaces = groupedWorkspaces.size === 0 && pinnedWorkspaces.length === 0

  if (hasNoWorkspaces) {
    return (
      <div className="px-4 py-8 text-center">
        <FolderPlus className="w-10 h-10 text-text-dim mx-auto mb-3" />
        <p className="text-text-muted text-sm mb-1">No repositories yet</p>
        <p className="text-text-faint text-xs">Add a repository to get started</p>
      </div>
    )
  }

  return (
    <div className="px-2">
      {/* Pinned workspaces at top */}
      <PinnedWorkspacesSection workspaces={pinnedWorkspaces} activeWorkspaceId={activeId} />

      {/* Regular workspaces grouped by repo */}
      {Array.from(groupedWorkspaces.values()).map(({ repo, workspaces: repoWorkspaces }) => (
        <RepoGroup
          key={repo.id}
          repo={repo}
          workspaces={repoWorkspaces}
          activeWorkspaceId={activeId}
        />
      ))}

      {/* Archived workspaces at bottom */}
      <ArchivedWorkspacesSection workspaces={archivedWorkspaces} activeWorkspaceId={activeId} />
    </div>
  )
}

// ============================================================================
// Main Sidebar
// ============================================================================

export function Sidebar(): React.ReactElement {
  return (
    <div className="flex flex-col h-full bg-surface-base">
      <SidebarHeader />

      <div className="flex-1 overflow-y-auto py-2">
        <WorkspaceList />
      </div>

      <SidebarFooter />
    </div>
  )
}
