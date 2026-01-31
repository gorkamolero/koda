import { cn } from '@/lib/utils'
import { Map, CheckCircle2, Circle, Loader2 } from 'lucide-react'

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
 * Conductor-style plan mode indicator.
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

  return (
    <div className="mx-4 mb-3 p-3 rounded-lg bg-[--plan-border]/10 border border-[--plan-border]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-[--plan-border]" />
          <span className="text-sm font-medium text-text-primary">Plan Mode</span>
        </div>
        {onExitPlanMode && (
          <button
            onClick={onExitPlanMode}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Exit
          </button>
        )}
      </div>

      {/* Plan title */}
      <h3 className="text-sm text-text-strong mb-3">{planTitle}</h3>

      {/* Progress bar */}
      {steps.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span>{completedSteps} of {steps.length} steps</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 bg-surface-control rounded-full overflow-hidden">
            <div
              className="h-full bg-[--plan-border] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps list */}
      {steps.length > 0 && (
        <div className="space-y-1.5">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-2 text-xs",
                index === currentStepIndex && "font-medium"
              )}
            >
              {/* Status icon */}
              {step.status === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-status-success flex-shrink-0 mt-0.5" />
              ) : step.status === 'in_progress' ? (
                <Loader2 className="w-3.5 h-3.5 text-[--plan-border] animate-spin flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-text-dim flex-shrink-0 mt-0.5" />
              )}

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <span className={cn(
                  step.status === 'completed' && "text-text-muted",
                  step.status === 'in_progress' && "text-text-primary",
                  step.status === 'pending' && "text-text-faint"
                )}>
                  {step.title}
                </span>
                {step.description && step.status === 'in_progress' && (
                  <p className="text-text-faint mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
