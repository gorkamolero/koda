import { cn } from '@/lib/utils'

interface PlanStep {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  description?: string
}

interface PlanModeIndicatorProps {
  isActive: boolean
  planTitle?: string
  steps?: PlanStep[]
  currentStepIndex?: number
  onExitPlanMode?: () => void
}

/**
 * Terminal-style plan mode indicator.
 * Shows when Claude is in plan mode with step progress.
 */
export function PlanModeIndicator({
  isActive,
  planTitle = 'Planning...',
  steps = [],
  currentStepIndex = 0,
  onExitPlanMode,
}: PlanModeIndicatorProps) {
  if (!isActive) return null

  const completedSteps = steps.filter(s => s.status === 'completed').length
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0

  // ASCII progress bar
  const barWidth = 20
  const filledChars = Math.round((progress / 100) * barWidth)
  const progressBar = '█'.repeat(filledChars) + '░'.repeat(barWidth - filledChars)

  return (
    <div className="mx-4 mb-3 font-mono text-xs border border-dashed border-[--plan-border] bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-dashed border-[--plan-border]/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-text-faint">┌─</span>
          <span className="text-[--plan-border]">[PLAN MODE]</span>
        </div>
        {onExitPlanMode && (
          <button
            onClick={onExitPlanMode}
            className="text-text-muted hover:text-text-accent transition-colors"
          >
            [EXIT]
          </button>
        )}
      </div>

      {/* Plan title */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-text-faint">│</span>
          <span className="text-text-primary">{planTitle}</span>
        </div>
      </div>

      {/* Progress bar */}
      {steps.length > 0 && (
        <div className="px-3 py-2 border-t border-dashed border-[--plan-border]/30">
          <div className="flex items-center gap-2">
            <span className="text-text-faint">│</span>
            <span className="text-[--plan-border]">{progressBar}</span>
            <span className="text-text-muted">{completedSteps}/{steps.length}</span>
            <span className="text-text-faint">({Math.round(progress)}%)</span>
          </div>
        </div>
      )}

      {/* Steps list */}
      {steps.length > 0 && (
        <div className="px-3 py-2 border-t border-dashed border-[--plan-border]/30">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-2 py-0.5",
                index === currentStepIndex && "text-text-primary"
              )}
            >
              <span className="text-text-faint">│</span>
              {/* Status indicator */}
              <span className={cn(
                step.status === 'completed' && 'text-[--git-green]',
                step.status === 'in_progress' && 'text-[--plan-border]',
                step.status === 'pending' && 'text-text-dim',
                step.status === 'skipped' && 'text-text-faint'
              )}>
                {step.status === 'completed' && '[✓]'}
                {step.status === 'in_progress' && '[◉]'}
                {step.status === 'pending' && '[ ]'}
                {step.status === 'skipped' && '[─]'}
              </span>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <span className={cn(
                  step.status === 'completed' && "text-text-muted",
                  step.status === 'in_progress' && "text-text-primary",
                  step.status === 'pending' && "text-text-faint",
                  step.status === 'skipped' && "text-text-faint line-through"
                )}>
                  {step.title}
                </span>
                {step.description && step.status === 'in_progress' && (
                  <p className="text-text-faint mt-0.5">  └─ {step.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-1 text-text-faint">
        └{'─'.repeat(40)}┘
      </div>
    </div>
  )
}
