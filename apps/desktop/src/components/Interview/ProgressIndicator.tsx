import { cn } from '@/lib/utils'

interface ProgressIndicatorProps {
  current: number
  total: number
  percent: number
}

/**
 * Progress indicator showing current step and total steps
 */
export function ProgressIndicator({
  current,
  total,
  percent,
}: ProgressIndicatorProps) {
  return (
    <div
      data-testid="interview-progress"
      className="flex items-center gap-3"
    >
      {/* Step counter */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="font-semibold text-text-strong">{current}</span>
        <span className="text-text-dim">/</span>
        <span className="text-text-muted">{total}</span>
      </div>

      {/* Percent badge */}
      <span
        className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          percent === 100
            ? 'bg-status-success/20 text-status-success'
            : 'bg-surface-control text-text-faint'
        )}
      >
        {percent}%
      </span>
    </div>
  )
}
