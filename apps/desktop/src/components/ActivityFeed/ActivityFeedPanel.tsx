import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useActivity, useMarkRead } from '@/hooks/useActivity'
import { ActivityEntry } from './ActivityEntry'
import type { Activity } from '@/lib/rpc'

interface ActivityFeedPanelProps {
  workspaceId: string
  worktreeId?: string
}

/**
 * Panel showing activity feed for a workspace.
 * Automatically marks items as read when opened.
 */
export function ActivityFeedPanel({ workspaceId, worktreeId }: ActivityFeedPanelProps) {
  const navigate = useNavigate()
  const { data: activities, isLoading } = useActivity(workspaceId)
  const markRead = useMarkRead()

  // Mark all as read when panel opens
  useEffect(() => {
    if (activities && activities.length > 0) {
      const unreadIds = activities.filter(a => !a.read).map(a => a.id)
      if (unreadIds.length > 0) {
        markRead.mutate({ workspaceId, ids: unreadIds })
      }
    }
  }, [activities, workspaceId, markRead])

  const handleEntryClick = (activity: Activity) => {
    if (activity.navigateTo) {
      // Navigate to the specified view
      const { view } = activity.navigateTo
      if (view === 'diff' && worktreeId) {
        void navigate({
          to: '/workspace/$workspaceId/$worktreeId',
          params: { workspaceId, worktreeId },
        })
      }
    }
  }

  return (
    <div
      data-testid="activity-feed-panel"
      className="h-full flex flex-col bg-[#0a0a0a] font-mono text-xs"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-dashed border-border-subtle">
        <span className="text-text-faint">┌─ <span className="text-text-accent">ACTIVITY</span> {'─'.repeat(14)}┐</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-3 py-4 text-center text-text-faint">
            Loading...
          </div>
        )}

        {!isLoading && (!activities || activities.length === 0) && (
          <div className="px-3 py-4 text-center text-text-faint">
            │ No activity yet
          </div>
        )}

        {activities && activities.length > 0 && (
          <div className="py-1">
            {activities.map((activity) => (
              <ActivityEntry
                key={activity.id}
                activity={activity}
                onClick={() => handleEntryClick(activity)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 text-text-faint border-t border-dashed border-border-subtle">
        └{'─'.repeat(24)}┘
      </div>
    </div>
  )
}
