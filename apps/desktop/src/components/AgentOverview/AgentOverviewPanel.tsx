import { Button } from '@koda/ui'
import { useNavigate } from '@tanstack/react-router'
import { X, Circle } from 'lucide-react'
import { useWorkspacesWithStatus } from '@/hooks/useActivity'
import { cn } from '@/lib/utils'
import type { AgentStatus } from '@/lib/rpc'

interface AgentOverviewPanelProps {
  onClose: () => void
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'text-text-faint',
  thinking: 'text-status-warning animate-pulse',
  writing: 'text-[--git-green] animate-pulse',
  error: 'text-status-error',
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  thinking: 'Thinking...',
  writing: 'Writing...',
  error: 'Error',
}

/**
 * Panel showing all workspaces and their agent status.
 * Click a workspace to navigate to it.
 */
export function AgentOverviewPanel({ onClose }: AgentOverviewPanelProps) {
  const navigate = useNavigate()
  const { data: workspaces, isLoading } = useWorkspacesWithStatus()

  const handleWorkspaceClick = (workspaceId: string) => {
    void navigate({ to: '/workspace/$workspaceId/$worktreeId', params: { workspaceId, worktreeId: workspaceId } })
    onClose()
  }

  return (
    <div
      data-testid="agent-overview-panel"
      className="absolute top-full left-0 mt-1 z-50 min-w-[var(--sidebar-width)] max-w-100 bg-[var(--black-soft)] border border-dashed border-border-subtle font-mono text-xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dashed border-border-subtle">
        <span className="text-text-accent">┌─ AGENT OVERVIEW ─────┐</span>
        <Button variant="unstyled"
          onClick={onClose}
          className="text-text-faint hover:text-text-primary transition-colors"
        >
          <X className="size-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="max-h-100 overflow-y-auto">
        {isLoading && (
          <div className="px-3 py-4 text-center text-text-faint">
            Loading...
          </div>
        )}

        {!isLoading && (!workspaces || workspaces.length === 0) && (
          <div className="px-3 py-4 text-center text-text-faint">
            No workspaces found
          </div>
        )}

        {workspaces && workspaces.length > 0 && (
          <div className="py-1">
            {workspaces.map((ws) => (
              <Button variant="unstyled"
                key={ws.id}
                data-testid={`agent-workspace-${ws.id}`}
                onClick={() => handleWorkspaceClick(ws.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Circle className={cn('size-2 flex-shrink-0', STATUS_COLORS[ws.status])} />
                  <span className="truncate text-text-primary">{ws.name}</span>
                </div>
                <span
                  data-testid="agent-status"
                  className={cn('text-2xs uppercase', STATUS_COLORS[ws.status])}
                >
                  {STATUS_LABELS[ws.status]}
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 text-text-faint border-t border-dashed border-border-subtle">
        └{'─'.repeat(22)}┘
      </div>
    </div>
  )
}
