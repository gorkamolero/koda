import { Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorktreeStatus } from '@/lib/rpc'

interface WorktreeStatusBadgeProps {
  status: WorktreeStatus | null | undefined
}

const STATUS_CONFIG: Record<WorktreeStatus, { icon: React.ReactNode; color: string }> = {
  done: { icon: <Check className="w-3 h-3" />, color: 'text-status-success bg-status-success/10' },
  blocked: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-status-warning bg-status-warning/10' },
  'needs-review': { icon: <AlertCircle className="w-3 h-3" />, color: 'text-status-warning bg-status-warning/10' },
  'in-progress': { icon: null, color: 'text-status-unread bg-status-unread/10' },
}

/**
 * Displays a status badge for a worktree.
 * Shows the status with an appropriate icon and color.
 */
export function WorktreeStatusBadge({ status }: WorktreeStatusBadgeProps): React.ReactNode {
  if (!status) return null

  const config = STATUS_CONFIG[status]
  if (!config) return null

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', config.color)}>
      {config.icon}
      {status}
    </span>
  )
}
