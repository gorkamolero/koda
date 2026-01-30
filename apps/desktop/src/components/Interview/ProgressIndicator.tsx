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
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <span className="font-medium text-primary">{current}</span>
      <span>/</span>
      <span>{total}</span>
      <span className="text-xs">({percent}%)</span>
    </div>
  )
}
