import { NavItem, StatusDot, type Status } from '@koda/ui'
import { cn } from '@/lib/utils'
import type { Session, SessionStatus } from '@/lib/rpc'
import {
  MessageSquare,
  Loader2,
  Check,
  AlertCircle,
  Pause,
  Archive,
  Sparkles,
  Globe,
} from 'lucide-react'

// ============================================================================
// Status Configuration
// ============================================================================

function getStatusConfig(status?: SessionStatus): {
  icon: React.ReactNode
  colorClass: string
  label: string
} {
  switch (status) {
    case 'running':
      return {
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        colorClass: 'text-status-unread',
        label: 'Running',
      }
    case 'paused':
      return {
        icon: <Pause className="w-3.5 h-3.5" />,
        colorClass: 'text-status-warning',
        label: 'Paused',
      }
    case 'completed':
      return {
        icon: <Check className="w-3.5 h-3.5" />,
        colorClass: 'text-status-success',
        label: 'Completed',
      }
    case 'error':
      return {
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        colorClass: 'text-status-error',
        label: 'Error',
      }
    case 'cancelled':
      return {
        icon: <Archive className="w-3.5 h-3.5" />,
        colorClass: 'text-text-dim',
        label: 'Cancelled',
      }
    case 'compacting':
      return {
        icon: <Sparkles className="w-3.5 h-3.5 animate-pulse" />,
        colorClass: 'text-status-reviewing',
        label: 'Compacting',
      }
    case 'idle':
    default:
      return {
        icon: <MessageSquare className="w-3.5 h-3.5" />,
        colorClass: 'text-text-muted',
        label: 'Idle',
      }
  }
}

// ============================================================================
// Time Ago Helper
// ============================================================================

function formatTimeAgo(date: string | null | undefined): string {
  if (!date) return ''

  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${String(diffMins)}m`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${String(diffHours)}h`

  const diffDays = Math.floor(diffHours / 24)
  return `${String(diffDays)}d`
}

// ============================================================================
// Context Usage Meter
// ============================================================================

function ContextUsageMeter({ percent }: { percent: number }) {
  const isHigh = percent > 80
  const isCritical = percent > 95

  return (
    <div className="w-12 h-1 rounded-full bg-surface-inset overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          isCritical
            ? 'bg-status-error'
            : isHigh
              ? 'bg-status-warning'
              : 'bg-status-unread'
        )}
        style={{ width: `${String(Math.min(100, percent))}%` }}
      />
    </div>
  )
}

// ============================================================================
// SessionButton Component
// ============================================================================

export interface SessionButtonProps {
  session: Session
  isActive: boolean
  onClick: () => void
  /** Whether this session is hosted on a remote machine */
  isRemote?: boolean
  /** Short identifier for the remote machine (e.g., first 6 chars of machineId) */
  remoteMachineId?: string
}

export function SessionButton({
  session,
  isActive,
  onClick,
  isRemote = false,
  remoteMachineId,
}: SessionButtonProps) {
  const { icon, colorClass, label } = getStatusConfig(session.status)
  const statusTone: Status = session.status === 'running' ? 'processing' : session.status === 'error' ? 'error' : session.status === 'completed' ? 'success' : session.status === 'compacting' ? 'reviewing' : session.status === 'paused' ? 'warning' : 'unknown'
  const timeAgo = formatTimeAgo(session.updatedAt ?? session.createdAt)
  const contextPercent = session.contextUsedPercent
    ? parseFloat(session.contextUsedPercent)
    : 0
  const unreadCount = session.unreadCount ?? 0

  // Generate a display title
  const displayTitle = session.title ?? `Session ${session.id.slice(0, 8)}`

  // Model display (short form)
  const modelDisplay = session.model
    ? session.model.replace('claude-', '').replace('-latest', '').slice(0, 8)
    : session.agentType ?? 'claude'

  return (
    <NavItem label={displayTitle}
      onClick={onClick}
      buttonClassName={cn(
        'group flex items-start gap-2.5 w-full px-3 py-2.5 rounded-md transition-colors text-left',
        'hover:bg-surface-hover',
        isActive && 'bg-surface-active',
        isRemote && 'opacity-80 border border-dashed border-border'
      )}
    >
      {/* Status icon */}
      <div className={cn('mt-0.5 flex-shrink-0', colorClass)}>
        {icon}<StatusDot status={statusTone} label={label} className="sr-only" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-text-primary text-sm font-medium truncate">
              {displayTitle}
            </span>
            {isRemote && (
              <span
                className="flex items-center gap-0.5 text-2xs font-medium px-1 py-0.5 rounded bg-status-reviewing/20 text-status-reviewing flex-shrink-0"
                title={`Remote session on ${remoteMachineId ?? 'another machine'}`}
              >
                <Globe className="w-2.5 h-2.5" />
                {remoteMachineId?.slice(0, 6) ?? 'remote'}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-status-unread/20 text-status-unread flex-shrink-0">
              {String(unreadCount)}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-faint truncate">
            {modelDisplay}
          </span>
          {timeAgo && (
            <>
              <span className="text-text-dim">·</span>
              <span className="text-xs text-text-faint">{timeAgo}</span>
            </>
          )}
          {contextPercent > 0 && (
            <>
              <span className="text-text-dim">·</span>
              <ContextUsageMeter percent={contextPercent} />
            </>
          )}
        </div>

        {/* Compacting indicator */}
        {session.isCompacting && (
          <div className="flex items-center gap-1 mt-1 text-xs text-status-reviewing">
            <Sparkles className="w-3 h-3" />
            <span>Compacting context...</span>
          </div>
        )}
      </div>
    </NavItem>
  )
}
