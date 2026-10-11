import { Button } from '@koda/ui'
import { Activity } from 'lucide-react'
import { useUnreadCount } from '@/hooks/useActivity'
import { cn } from '@/lib/utils'

interface ActivityFeedTabProps {
  workspaceId: string
  isActive: boolean
  onClick: () => void
}

/**
 * Tab button for the activity feed.
 * Shows unread badge when there are new items.
 */
export function ActivityFeedTab({ workspaceId, isActive, onClick }: ActivityFeedTabProps) {
  const { data } = useUnreadCount(workspaceId)
  const unreadCount = data?.count ?? 0

  return (
    <Button variant="unstyled"
      data-testid="activity-feed-tab"
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-1.5 px-2 py-1 text-xs font-mono transition-colors',
        isActive
          ? 'text-text-accent bg-surface-active'
          : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
      )}
    >
      <Activity className="size-3" />
      <span>[ACTIVITY]</span>
      
      {unreadCount > 0 && (
        <span
          data-testid="unread-badge"
          className="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center px-1 text-2xs font-bold bg-status-error text-inverse rounded-full"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  )
}
