import { useParams, Link } from '@tanstack/react-router'
import { useWorktree } from '@/hooks/useRpc'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { Worktree } from '@/lib/rpc'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  GitBranch,
  MoreHorizontal,
  ExternalLink,
  RefreshCw,
  Settings,
  Loader2,
} from 'lucide-react'
import { useState, useRef } from 'react'

// Static menu items - hoisted outside component to avoid recreation
const MORE_ACTIONS_MENU_ITEMS = [
  { icon: ExternalLink, label: 'Open in VS Code', action: () => { console.log('Open in VS Code') } },
  { icon: RefreshCw, label: 'Sync with remote', action: () => { console.log('Sync') } },
  { icon: Settings, label: 'Workspace settings', action: () => { console.log('Settings') } },
]

interface MainHeaderProps {
  /** Override the title (for non-workspace pages) */
  title?: string
  /** Additional actions to show in the header */
  actions?: React.ReactNode
}

/**
 * Branch selector dropdown.
 */
function BranchSelector({ branch }: { branch: string }): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useClickOutside(dropdownRef, {
    onClickOutside: () => { setIsOpen(false) },
    onEscape: () => { setIsOpen(false) },
    enabled: isOpen,
  })

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen) }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm',
          'text-text-muted hover:text-text-primary hover:bg-surface-hover',
          'transition-colors'
        )}
      >
        <GitBranch className="w-3.5 h-3.5" />
        <span className="max-w-[150px] truncate">{branch}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 glass-popover rounded-lg border border-border-strong shadow-xl py-1 z-50 animate-fade-in">
          <div className="px-3 py-2 text-xs text-text-faint border-b border-border-subtle">
            Current branch
          </div>
          <div className="px-3 py-2 text-sm text-text-primary flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-text-muted" />
            {branch}
          </div>
          {/* Branch switching would go here in a full implementation */}
        </div>
      )}
    </div>
  )
}

/**
 * More actions dropdown menu.
 */
function MoreActionsMenu(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useClickOutside(dropdownRef, {
    onClickOutside: () => { setIsOpen(false) },
    onEscape: () => { setIsOpen(false) },
    enabled: isOpen,
  })

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen) }}
        className="btn-icon"
        data-tooltip="More actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 glass-popover rounded-lg border border-border-strong shadow-xl py-1 z-50 animate-fade-in">
          {MORE_ACTIONS_MENU_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.action()
                setIsOpen(false)
              }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                'text-text-muted hover:text-text-primary hover:bg-surface-hover',
                'transition-colors'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Breadcrumb navigation showing current location.
 */
function Breadcrumb({ worktree, title }: { worktree?: Worktree; title?: string }): React.ReactElement {
  const displayName = worktree?.worktreePath?.split('/').pop() ?? worktree?.branch
  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        to="/"
        className="text-text-muted hover:text-text-primary transition-colors"
      >
        Home
      </Link>

      {(worktree || title) && (
        <>
          <ChevronRight className="w-4 h-4 text-text-dim" />
          <span className="text-text-primary font-medium truncate max-w-[200px]">
            {displayName || title}
          </span>
        </>
      )}
    </nav>
  )
}

/**
 * Main header component for the content area.
 * Shows workspace info, branch selector, and actions.
 */
export function MainHeader({ title, actions }: MainHeaderProps): React.ReactElement {
  const params = useParams({ strict: false })
  const workspaceId = (params as { id?: string }).id
  const { data: worktree, isLoading } = useWorktree(workspaceId ?? '')

  // If we're not in a workspace and no title, don't render
  if (!workspaceId && !title) {
    return (
      <header className="flex items-center justify-between px-4 h-full border-b border-border-subtle">
        <Breadcrumb title="Home" />
      </header>
    )
  }

  if (isLoading && workspaceId) {
    return (
      <header className="flex items-center justify-center h-full border-b border-border-subtle">
        <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
      </header>
    )
  }

  return (
    <header className="flex items-center justify-between px-4 h-full border-b border-border-subtle">
      {/* Left side: Breadcrumb + Branch */}
      <div className="flex items-center gap-4">
        <Breadcrumb worktree={worktree} title={title} />

        {worktree?.branch ? (
          <>
            <div className="h-4 w-px bg-border-subtle" />
            <BranchSelector branch={worktree.branch} />
          </>
        ) : null}
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2">
        {actions}
        {workspaceId && <MoreActionsMenu />}
      </div>
    </header>
  )
}
