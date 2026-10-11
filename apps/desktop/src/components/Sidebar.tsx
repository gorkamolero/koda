import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useWorkspaces, useWorkspaceRepos, useWorktreesByWorkspace, useSidecar } from '@/hooks/useRpc'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn } from '@/lib/utils'
import type { Worktree, WorktreeStatus, WorkspaceRepo } from '@/lib/rpc'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { selectedWorkspaceIdAtom, setWorkspaceContainersAtom } from '@/store/workspace'
import { Button, NavItem, Spinner, StatusBadge, StatusDot } from '@koda/ui'
import { AddRepoModal, CreateWorkspaceModal } from './WorkspaceDialogs'
import { AgentOverviewButton, AgentOverviewPanel } from '@/components/AgentOverview'
import { SharedWorkspacesSection } from '@/components/WorkspaceSharing'

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
      className="absolute right-0 z-50 mt-1 min-w-45 font-mono text-xs bg-surface-card border border-dashed border-text-dim/30"
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
    <Button variant="unstyled"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-4 w-full px-3 py-1.5 text-left',
        'hover:bg-surface-hover transition-colors',
        destructive ? 'text-status-error hover:text-status-error' : 'text-text-primary hover:text-border-accent'
      )}
    >
      <span>{label}</span>
      {shortcut && <span className="text-text-dim">{shortcut}</span>}
    </Button>
  )
}

function MenuSeparator(): React.ReactElement {
  return <div className="border-t border-dashed border-text-dim/20" />
}

// ============================================================================
// Workspace Selector Dropdown
// ============================================================================

function WorkspaceSelector({ onCreateWorkspace }: { onCreateWorkspace: () => void }): React.ReactElement {
  const { data: workspaces, isLoading } = useWorkspaces()
  const [selectedId, setSelectedId] = useAtom(selectedWorkspaceIdAtom)
  const setWorkspaceContainers = useSetAtom(setWorkspaceContainersAtom)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Sync workspaces to store and handle stale selections
  useEffect(() => {
    if (workspaces) {
      setWorkspaceContainers(workspaces)

      if (workspaces.length === 0) {
        // No workspaces exist - clear any stale selection
        if (selectedId) {
          setSelectedId(null)
        }
      } else {
        // Auto-select first workspace if none selected or selection is stale
        const selectedExists = workspaces.some(w => w.id === selectedId)
        const firstWorkspace = workspaces[0]
        if ((!selectedId || !selectedExists) && firstWorkspace) {
          setSelectedId(firstWorkspace.id)
        }
      }
    }
  }, [workspaces, selectedId, setSelectedId, setWorkspaceContainers])

  useClickOutside(menuRef, {
    onClickOutside: () => setIsOpen(false),
    onEscape: () => setIsOpen(false),
    enabled: isOpen,
  })

  const selectedWorkspace = workspaces?.find(w => w.id === selectedId)

  if (isLoading) {
    return (
      <div className="px-3 py-2 font-mono text-xs text-text-dim">
        Loading...
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="unstyled"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 font-mono text-xs hover:bg-surface-hover transition-colors"
      >
        <span className="text-border-accent">[▼]</span>
        <span className="flex-1 text-left truncate text-text-primary">
          {selectedWorkspace?.name ?? 'Select Workspace'}
        </span>
      </Button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-surface-card border border-dashed border-text-dim/30 max-h-48 overflow-y-auto">
          {workspaces?.map(ws => (
            <Button variant="unstyled"
              key={ws.id}
              onClick={() => {
                setSelectedId(ws.id)
                setIsOpen(false)
              }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-1.5 text-left font-mono text-xs',
                'hover:bg-surface-hover transition-colors',
                ws.id === selectedId ? 'text-border-accent bg-surface-hover' : 'text-text-primary'
              )}
            >
              <span>{ws.id === selectedId ? '▸' : '·'}</span>
              <span className="truncate">{ws.name}</span>
            </Button>
          ))}
          <MenuSeparator />
          <Button variant="unstyled"
            onClick={() => {
              setIsOpen(false)
              onCreateWorkspace()
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left font-mono text-xs text-text-dim hover:text-border-accent hover:bg-surface-hover transition-colors"
          >
            [+] NEW WORKSPACE
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Worktree Row - Terminal Style
// ============================================================================

function WorktreeRow({
  worktree,
  workspaceId,
  isActive,
  isMain = false,
}: {
  worktree: Worktree
  workspaceId: string
  isActive: boolean
  isMain?: boolean
}): React.ReactElement {
  const status = worktree.manualStatus ?? worktree.derivedStatus ?? 'in-progress'
  const statusLabel = STATUS_LABELS[status]
  const statusColor = getStatusColor(status)
  const timeAgo = formatTimeAgo(worktree.updatedAt)
  const unreadCount = worktree.unread ?? 0
  const isArchived = worktree.state === 'archived'
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <NavItem label={worktree.branch ?? 'unnamed'} asChild className="bg-transparent" buttonClassName="rounded-none p-0">
      <Link
        to="/workspace/$workspaceId/$worktreeId"
        params={{ workspaceId, worktreeId: worktree.id }}
        className={cn('rounded-none',
          'group flex items-center gap-2 px-2 py-1.5 font-mono text-xs',
          'border-l-2 border-transparent',
          'hover:bg-surface-hover hover:border-l-border-accent/50',
          'transition-colors duration-75',
          isActive && 'bg-surface-hover border-l-border-accent',
          isArchived && 'opacity-40'
        )}
        onContextMenu={handleContextMenu}
      >
        {/* Main indicator */}
        <span className={cn('w-3', isMain ? 'text-border-accent' : 'text-text-dim/30')}>
          {isMain ? '★' : '·'}
        </span>

        {/* Status */}
        <StatusBadge status={status === 'done' ? 'success' : status === 'blocked' ? 'error' : status === 'needs-review' ? 'warning' : 'processing'} showDot={false} className={cn('w-12 text-xs border-0 rounded-none p-0 bg-transparent font-bold', statusColor)}>[{statusLabel}]</StatusBadge>

        {/* Branch name */}
        <span className={cn(
          'flex-1 truncate',
          'text-text-primary group-hover:text-border-accent',
          isActive && 'text-border-accent'
        )}>
          {worktree.branch ?? 'unnamed'}
        </span>

        {/* Unread count */}
        {unreadCount > 0 && (
          <span className="px-1 bg-border-accent text-text-inverse text-micro font-bold">
            {unreadCount}
          </span>
        )}

        {/* Time */}
        <span className="w-8 text-right text-text-dim tabular-nums">
          {timeAgo}
        </span>
      </Link>
      </NavItem>

      {/* Context menu */}
      {contextMenu && (
        <WorktreeContextMenu
          worktree={worktree}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

// ============================================================================
// Worktree Context Menu
// ============================================================================

function WorktreeContextMenu({
  worktree,
  position,
  onClose,
}: {
  worktree: Worktree
  position: { x: number; y: number }
  onClose: () => void
}): React.ReactElement {
  const menuRef = useRef<HTMLDivElement>(null)
  const isPinned = Boolean(worktree.pinnedAt)
  const isArchived = worktree.state === 'archived'

  useClickOutside(menuRef, {
    onClickOutside: onClose,
    onEscape: onClose,
  })

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-45 font-mono text-xs bg-surface-card border border-dashed border-text-dim/30"
      style={{ top: position.y, left: position.x }}
    >
      <div className="py-1">
        <MenuItem
          label={isPinned ? '[⊘] UNPIN' : '[⊕] PIN TO TOP'}
          onClick={() => {
            onClose()
            console.log(isPinned ? 'Unpin:' : 'Pin:', worktree.id)
          }}
        />
        <MenuItem
          label="[⎘] COPY BRANCH"
          onClick={() => {
            onClose()
            void navigator.clipboard.writeText(worktree.branch ?? '')
          }}
        />
        <MenuItem
          label="[↗] OPEN IN FINDER"
          onClick={() => {
            onClose()
            console.log('Open in Finder:', worktree.worktreePath)
          }}
        />
        <MenuItem
          label="[⌘] OPEN IN EDITOR"
          onClick={() => {
            onClose()
            console.log('Open in editor:', worktree.worktreePath)
          }}
        />
        <MenuSeparator />
        <MenuItem
          label={isArchived ? '[↺] RESTORE' : '[⌫] ARCHIVE'}
          onClick={() => {
            onClose()
            console.log(isArchived ? 'Unarchive:' : 'Archive:', worktree.id)
          }}
          destructive={!isArchived}
        />
        {isArchived && (
          <MenuItem
            label="[×] DELETE"
            onClick={() => {
              onClose()
              console.log('Delete:', worktree.id)
            }}
            destructive
          />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Repo Group - Shows repo with its worktrees
// ============================================================================

function RepoGroup({
  repo,
  worktrees,
  workspaceId,
  activeWorktreeId,
  defaultBranch,
}: {
  repo: WorkspaceRepo
  worktrees: Worktree[]
  workspaceId: string
  activeWorktreeId?: string
  defaultBranch?: string
}): React.ReactElement {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const repoName = repo.repoName ?? repo.repoRootPath?.split('/').pop() ?? 'Repository'
  const mainBranch = defaultBranch ?? 'main'

  // Find the main worktree (matches default branch)
  const mainWorktree = worktrees.find(wt => wt.branch === mainBranch)

  // Other worktrees (excluding main)
  const otherWorktrees = worktrees.filter(wt => wt.branch !== mainBranch)

  // Sort other worktrees by updatedAt
  const sortedWorktrees = [...otherWorktrees].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    return bTime - aTime
  })

  return (
    <div className="mb-2">
      {/* Repo header */}
      <div className="flex items-center group">
        <NavItem label={repoName} className="flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
          buttonClassName="rounded-none flex items-center gap-2 flex-1 px-2 py-1 font-mono text-xs hover:bg-surface-hover transition-colors"
        >
          <span className="text-text-dim">{isExpanded ? '▼' : '▶'}</span>
          <span className="text-text-primary uppercase tracking-wide truncate flex-1 text-left">
            {repoName}
          </span>
          <span className="text-text-dim">({worktrees.length})</span>
        </NavItem>

        {/* Actions (visible on hover) */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity relative">
          <Button variant="unstyled"
            className="px-1 py-0.5 text-text-dim hover:text-border-accent font-mono text-2xs"
            title="More actions"
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}
          >
            [···]
          </Button>
          <Button variant="unstyled"
            className="px-1 py-0.5 text-text-dim hover:text-border-accent font-mono text-2xs"
            title="New worktree"
            onClick={(e) => {
              e.stopPropagation()
              void navigate({ to: '/', search: { repoId: repo.repoId } })
            }}
          >
            [+]
          </Button>

          {showDropdown && (
            <RepoActionsDropdown
              repoId={repo.repoId}
              repoPath={repo.repoRootPath ?? ''}
              onClose={() => setShowDropdown(false)}
            />
          )}
        </div>
      </div>

      {/* Worktrees */}
      {isExpanded && (
        <div className="border-l border-dashed border-text-dim/20 ml-3">
          {/* Main worktree first */}
          {mainWorktree && (
            <WorktreeRow
              worktree={mainWorktree}
              workspaceId={workspaceId}
              isActive={mainWorktree.id === activeWorktreeId}
              isMain
            />
          )}
          {/* Other worktrees */}
          {sortedWorktrees.map((wt) => (
            <WorktreeRow
              key={wt.id}
              worktree={wt}
              workspaceId={workspaceId}
              isActive={wt.id === activeWorktreeId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Repo Actions Dropdown
// ============================================================================

function RepoActionsDropdown({
  repoId,
  repoPath,
  onClose,
}: {
  repoId: string
  repoPath: string
  onClose: () => void
}): React.ReactElement {
  const navigate = useNavigate()

  return (
    <DropdownMenu isOpen onClose={onClose}>
      <div className="py-1">
        <MenuItem
          label="[+] NEW WORKTREE"
          onClick={() => {
            onClose()
            void navigate({ to: '/', search: { repoId } })
          }}
        />
        <MenuItem
          label="[↗] OPEN IN FINDER"
          onClick={() => {
            onClose()
            console.log('Open in Finder:', repoPath)
          }}
        />
        <MenuItem
          label="[⌘] OPEN IN EDITOR"
          onClick={() => {
            onClose()
            console.log('Open in editor:', repoPath)
          }}
        />
        <MenuItem
          label="[⎘] COPY PATH"
          onClick={() => {
            onClose()
            void navigator.clipboard.writeText(repoPath)
          }}
        />
        <MenuSeparator />
        <MenuItem
          label="[×] DETACH REPO"
          onClick={() => {
            onClose()
            console.log('Detach repo:', repoId)
          }}
          destructive
        />
      </div>
    </DropdownMenu>
  )
}

// ============================================================================
// Sidebar Header - Terminal Style
// ============================================================================

function SidebarHeader({ onCreateWorkspace }: { onCreateWorkspace: () => void }): React.ReactElement {
  const navigate = useNavigate()
  const [isAgentOverviewOpen, setIsAgentOverviewOpen] = useState(false)
  const agentOverviewRef = useRef<HTMLDivElement>(null)

  useClickOutside(agentOverviewRef, {
    onClickOutside: () => setIsAgentOverviewOpen(false),
    onEscape: () => setIsAgentOverviewOpen(false),
    enabled: isAgentOverviewOpen,
  })

  return (
    <div className="border-b border-dashed border-text-dim/20">
      {/* Row 1: Traffic lights space + nav */}
      <div
        className="flex items-center justify-between pl-window-controls pr-2 h-10"
        data-tauri-drag-region
      >
        <div className="flex-1" data-tauri-drag-region />
        <div className="flex items-center gap-1 font-mono text-2xs">
          {/* Agent Overview */}
          <div ref={agentOverviewRef} className="relative">
            <AgentOverviewButton
              onClick={() => setIsAgentOverviewOpen(!isAgentOverviewOpen)}
              isOpen={isAgentOverviewOpen}
            />
            {isAgentOverviewOpen && (
              <AgentOverviewPanel onClose={() => setIsAgentOverviewOpen(false)} />
            )}
          </div>
          <Button variant="unstyled"
            className="px-1 text-text-dim hover:text-border-accent transition-colors"
            onClick={() => void navigate({ to: '/' })}
            title="Back"
          >
            [←]
          </Button>
          <Button variant="unstyled"
            className="px-1 text-text-dim hover:text-border-accent transition-colors"
            title="Forward"
          >
            [→]
          </Button>
        </div>
      </div>

      {/* Row 2: Workspace selector */}
      <div className="px-1 py-1 border-t border-dashed border-text-dim/20">
        <div className="text-2xs text-text-dim font-mono px-2 mb-1">
          ┌─ WORKSPACE ───────────────────
        </div>
        <WorkspaceSelector onCreateWorkspace={onCreateWorkspace} />
      </div>
    </div>
  )
}

// ============================================================================
// Sidebar Footer - Terminal Style
// ============================================================================

function SidebarFooter({ onAddRepo, hasWorkspace }: { onAddRepo: () => void; hasWorkspace: boolean }): React.ReactElement {
  const { status } = useSidecar()

  return (
    <div className="font-mono">
      {/* Quick actions - only show when workspace is selected */}
      {hasWorkspace && (
        <div className="px-2 py-1 space-y-0.5 border-t border-dashed border-text-dim/20">
          <Button variant="unstyled"
            className="flex items-center gap-2 w-full px-2 py-1 text-xs text-text-dim hover:text-border-accent hover:bg-surface-hover transition-colors"
            onClick={onAddRepo}
          >
            [+] ADD REPO TO WORKSPACE
          </Button>
        </div>
      )}

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-dashed border-text-dim/20 text-2xs">
        <div className="flex items-center gap-2">
          <StatusDot status={status?.running ? 'success' : 'unknown'} />
          <span className="text-text-dim uppercase">
            {status?.running ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="unstyled"
            className="text-text-dim hover:text-border-accent transition-colors"
            title="Help"
          >
            [?]
          </Button>
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
      <div className="px-3 py-1 text-2xs text-text-dim/50">
        └─────────────────────────────┘
      </div>
    </div>
  )
}

// ============================================================================
// Workspace Content - Repos and Worktrees
// ============================================================================

function WorkspaceContent({ onAddRepo, onCreateWorkspace }: { onAddRepo: () => void; onCreateWorkspace: () => void }): React.ReactElement {
  const selectedWorkspaceId = useAtomValue(selectedWorkspaceIdAtom)
  const params = useParams({ strict: false })
  const activeWorktreeId = (params as { worktreeId?: string }).worktreeId

  // Fetch repos attached to this workspace
  const { data: workspaceRepos, isLoading: loadingRepos } = useWorkspaceRepos(selectedWorkspaceId ?? '')

  // Fetch worktrees for this workspace
  const { data: worktrees, isLoading: loadingWorktrees } = useWorktreesByWorkspace(selectedWorkspaceId ?? '')

  // Group worktrees by repo
  const worktreesByRepo = useMemo(() => {
    if (!worktrees) return new Map<string, Worktree[]>()
    const grouped = new Map<string, Worktree[]>()
    for (const wt of worktrees) {
      const existing = grouped.get(wt.repoId) ?? []
      grouped.set(wt.repoId, [...existing, wt])
    }
    return grouped
  }, [worktrees])

  if (!selectedWorkspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono">
        <div className="text-center">
          <pre className="text-2xs text-text-dim mb-4">
{`┌──────────────────┐
│  NO WORKSPACE    │
│                  │
│  Create one to   │
│  get started     │
└──────────────────┘`}
          </pre>
          <Button variant="unstyled"
            onClick={onCreateWorkspace}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2',
              'border border-dashed border-border-accent',
              'text-border-accent hover:bg-border-accent hover:text-text-inverse',
              'font-mono text-xs uppercase tracking-wider',
              'transition-colors duration-100'
            )}
          >
            [+] NEW WORKSPACE
          </Button>
        </div>
      </div>
    )
  }

  if (loadingRepos || loadingWorktrees) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner variant="scan" showLabel={false} />
      </div>
    )
  }

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono">
        <div className="text-center">
          <pre className="text-2xs text-text-dim mb-4">
{`┌──────────────────┐
│  NO REPOS YET    │
│                  │
│  Add a repo to   │
│  this workspace  │
└──────────────────┘`}
          </pre>
          <Button variant="unstyled"
            onClick={onAddRepo}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2',
              'border border-dashed border-border-accent',
              'text-border-accent hover:bg-border-accent hover:text-text-inverse',
              'font-mono text-xs uppercase tracking-wider',
              'transition-colors duration-100'
            )}
          >
            [+] ADD REPO
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-1">
      {/* Section header */}
      <div className="px-2 py-1.5 text-2xs text-text-dim font-mono">
        ├─ REPOS ─────────────────────
      </div>

      {workspaceRepos.map((wsRepo) => (
        <RepoGroup
          key={wsRepo.id}
          repo={wsRepo}
          worktrees={worktreesByRepo.get(wsRepo.repoId) ?? []}
          workspaceId={selectedWorkspaceId}
          activeWorktreeId={activeWorktreeId}
          defaultBranch={wsRepo.repoDefaultBranch ?? 'main'}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Main Sidebar
// ============================================================================

export function Sidebar(): React.ReactElement {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useAtom(selectedWorkspaceIdAtom)
  const [isAddRepoOpen, setIsAddRepoOpen] = useState(false)
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)

  const handleOpenAddRepo = () => {
    if (selectedWorkspaceId) {
      setIsAddRepoOpen(true)
    }
  }

  const handleCreateWorkspace = () => {
    setIsCreateWorkspaceOpen(true)
  }

  const handleWorkspaceCreated = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId)
  }

  return (
    <div className="flex flex-col h-full bg-surface-sidebar">
      <SidebarHeader onCreateWorkspace={handleCreateWorkspace} />

      <div className="flex-1 overflow-y-auto py-1 flex flex-col">
        <WorkspaceContent onAddRepo={handleOpenAddRepo} onCreateWorkspace={handleCreateWorkspace} />
        <SharedWorkspacesSection />
      </div>

      <SidebarFooter onAddRepo={handleOpenAddRepo} hasWorkspace={!!selectedWorkspaceId} />

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        onCreated={workspace => handleWorkspaceCreated(workspace.id)}
        createLabel="[+] CREATE WORKSPACE" nameLabel="WORKSPACE NAME:"
      />

      {/* Add Repo Modal */}
      {selectedWorkspaceId && (
        <AddRepoModal
          isOpen={isAddRepoOpen}
          onClose={() => setIsAddRepoOpen(false)}
          workspaceId={selectedWorkspaceId}
        />
      )}
    </div>
  )
}
