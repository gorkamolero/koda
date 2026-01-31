import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useWorkspaces, useSidecar } from '@/hooks/useRpc'
import { cn } from '@/lib/utils'
import type { Workspace } from '@/lib/rpc'
import {
  Plus,
  Settings,
  Folder,
  GitBranch,
  Loader2,
  AlertCircle,
  Home,
} from 'lucide-react'

/**
 * Usage bar showing session/weekly usage percentage.
 */
function UsageBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const percent = Math.min(100, Math.round((value / max) * 100))
  const isHigh = percent > 80

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-faint">{label}</span>
        <span className={cn('text-text-muted', isHigh && 'text-status-warning')}>
          {percent}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-surface-control overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isHigh
              ? 'bg-gradient-to-r from-status-warning to-status-error'
              : 'bg-gradient-to-r from-[#62b7ff] to-[#4fe3a3]'
          )}
          style={{ width: `${String(percent)}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Individual workspace card in the sidebar.
 */
function WorkspaceCard({
  workspace,
  isActive,
}: {
  workspace: Workspace
  isActive: boolean
}) {
  // Get status dot class based on workspace state
  // In a real implementation, status would come from workspace activity tracking
  const getStatusClass = () => {
    // Placeholder: always ready. Real implementation would check workspace.status
    return 'status-dot-ready'
  }

  return (
    <Link
      to="/workspace/$id"
      params={{ id: workspace.id }}
      className={cn(
        'block rounded-lg p-3 mb-1 transition-colors cursor-pointer',
        'hover:bg-surface-hover',
        isActive && 'bg-surface-active'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('status-dot', getStatusClass())} />
        <Folder className="w-4 h-4 text-text-muted flex-shrink-0" />
        <span className="text-text-primary text-sm font-medium truncate">
          {workspace.directoryName}
        </span>
      </div>
      {workspace.branch && (
        <div className="flex items-center gap-1.5 mt-1 ml-6">
          <GitBranch className="w-3 h-3 text-text-dim" />
          <span className="text-text-faint text-xs truncate">
            {workspace.branch}
          </span>
        </div>
      )}
    </Link>
  )
}

/**
 * Workspace list section.
 */
function WorkspaceList() {
  const { data: workspaces, isLoading, error } = useWorkspaces()
  const params = useParams({ strict: false })
  const activeId = (params as { id?: string }).id

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="w-8 h-8 text-status-error mx-auto mb-2" />
        <p className="text-text-muted text-sm">Failed to load workspaces</p>
      </div>
    )
  }

  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="p-4 text-center">
        <Folder className="w-8 h-8 text-text-dim mx-auto mb-2" />
        <p className="text-text-muted text-sm">No workspaces yet</p>
        <p className="text-text-faint text-xs mt-1">
          Create one to get started
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {workspaces.map((workspace) => (
        <WorkspaceCard
          key={workspace.id}
          workspace={workspace}
          isActive={workspace.id === activeId}
        />
      ))}
    </div>
  )
}

/**
 * Navigation links at the top of the sidebar.
 */
function NavLinks() {
  return (
    <div className="space-y-0.5 mb-4">
      <Link
        to="/"
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
          'text-text-muted hover:text-text-primary hover:bg-surface-hover',
          'transition-colors'
        )}
        activeProps={{
          className: 'bg-surface-active text-text-strong',
        }}
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </Link>
    </div>
  )
}

/**
 * Footer with sidecar status and usage.
 */
function SidebarFooter() {
  const { status } = useSidecar()

  return (
    <div className="px-4 py-3 border-t border-border-subtle space-y-3">
      {/* Usage bars (placeholder values) */}
      <UsageBar label="Session" value={45} max={100} />
      <UsageBar label="Weekly" value={230} max={1000} />

      {/* Sidecar status */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'status-dot',
            status?.running ? 'status-dot-ready' : 'status-dot-unknown'
          )}
        />
        <span className="text-text-faint">
          {status?.running ? 'Sidecar connected' : 'Sidecar offline'}
        </span>
      </div>
    </div>
  )
}

/**
 * Main sidebar component with CodexMonitor-style aesthetic.
 */
export function Sidebar() {
  const navigate = useNavigate()

  const handleCreateWorkspace = () => {
    // Navigate to home where workspace creation is handled
    void navigate({ to: '/' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border-subtle">
        <div>
          <h1 className="text-text-strong text-lg font-semibold">Koda</h1>
          <p className="text-text-dim text-xs">Review-First Agent IDE</p>
        </div>
        <button
          onClick={handleCreateWorkspace}
          className="btn-icon"
          data-tooltip="New workspace"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation + Workspace list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 fade-mask-y">
        <NavLinks />

        <div className="mb-2">
          <h2 className="text-text-faint text-xs font-medium uppercase tracking-wider px-3 mb-2">
            Workspaces
          </h2>
          <WorkspaceList />
        </div>
      </div>

      {/* Corner actions */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle">
        <Link
          to="/settings"
          className="btn-icon"
          data-tooltip="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>

      {/* Footer */}
      <SidebarFooter />
    </div>
  )
}
