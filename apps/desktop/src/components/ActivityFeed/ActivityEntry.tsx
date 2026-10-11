import { Button } from '@koda/ui'
import { FileEdit, CheckCircle, AlertCircle, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Activity, ActivityType } from '@/lib/rpc'

interface ActivityEntryProps {
  activity: Activity
  onClick: () => void
}

const TYPE_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  file_change: FileEdit,
  agent_complete: CheckCircle,
  agent_error: AlertCircle,
  checkpoint: Bookmark,
}

const TYPE_COLORS: Record<ActivityType, string> = {
  file_change: 'text-text-accent',
  agent_complete: 'text-[--git-green]',
  agent_error: 'text-status-error',
  checkpoint: 'text-status-warning',
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp * 1000 // timestamp is in seconds
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 60) return 'now'
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m`
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h`
  return `${Math.floor(diffSecs / 86400)}d`
}

/**
 * Single activity entry in the feed.
 * Shows icon, title, time, and handles navigation on click.
 */
export function ActivityEntry({ activity, onClick }: ActivityEntryProps) {
  const Icon = TYPE_ICONS[activity.type]
  const colorClass = TYPE_COLORS[activity.type]
  const isError = activity.type === 'agent_error'

  return (
    <Button variant="unstyled"
      data-testid={`activity-entry-${activity.type}`}
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors',
        isError && 'error destructive bg-status-error/5',
        !activity.read && 'bg-surface-active/30'
      )}
    >
      <Icon className={cn('size-3 mt-0.5 flex-shrink-0', colorClass)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('truncate', activity.read ? 'text-text-muted' : 'text-text-primary')}>
            {activity.title}
          </span>
          <span className="text-2xs text-text-faint flex-shrink-0">
            {formatTimeAgo(activity.createdAt)}
          </span>
        </div>
        {activity.description && (
          <p className="text-2xs text-text-faint truncate mt-0.5">
            {activity.description}
          </p>
        )}
      </div>
    </Button>
  )
}
