import { Activity, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePulse } from '@/hooks/usePulse'

interface PulseButtonProps {
  worktreeId: string
  repoRootPath: string
  className?: string
}

/**
 * Toggle button for pulse sync.
 * Shows sync count when active, loading spinner during transitions.
 */
export function PulseButton({
  worktreeId,
  repoRootPath,
  className,
}: PulseButtonProps) {
  const { isActive, isLoading, start, stop, status } = usePulse(
    worktreeId,
    repoRootPath
  )

  const handleClick = () => {
    if (isActive) {
      stop()
    } else {
      start()
    }
  }

  // Determine button label
  let label = 'Pulse'
  if (isLoading) {
    if (status?.status === 'starting') {
      label = 'Starting...'
    } else if (status?.status === 'stopping') {
      label = 'Stopping...'
    } else {
      label = 'Loading...'
    }
  } else if (isActive) {
    const syncCount = status?.syncCount ?? 0
    label = syncCount > 0 ? `Pulse (${syncCount})` : 'Pulse'
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
        isLoading && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={isActive ? 'Stop pulse' : 'Start pulse'}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Activity className={cn('w-4 h-4', isActive && 'animate-pulse')} />
      )}
      <span>{label}</span>
    </button>
  )
}
