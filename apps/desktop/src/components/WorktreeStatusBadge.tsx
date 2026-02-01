import { Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorktreeStatus } from '@/lib/rpc'

interface WorktreeStatusBadgeProps {
  status: WorktreeStatus | null | undefined
}

const STATUS_CONFIG: Record<WorktreeStatus, { icon: React.ReactNode; color: string }> = {
  done: { icon: <Check className="w-3 h-3" />, color: 'text-green-500 bg-green-500/10' },
  blocked: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-orange-500 bg-orange-500/10' },
  'needs-review': { icon: <AlertCircle className="w-3 h-3" />, color: 'text-yellow-500 bg-yellow-500/10' },
  'in-progress': { icon: null, color: 'text-blue-500 bg-blue-500/10' },
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
