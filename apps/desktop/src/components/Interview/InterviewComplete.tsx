import { useAtomValue } from 'jotai'
import { generatedSpecAtom, generatedFixPlanAtom } from '@/store/interview'
import { SpecBuilder } from './SpecBuilder'
import { CheckCircle } from 'lucide-react'

interface InterviewCompleteProps {
  workspaceId: string
  onBack: () => void
  onDone: () => void
}

/**
 * Interview completion screen with spec preview and confirmation
 */
export function InterviewComplete({
  workspaceId,
  onBack,
  onDone,
}: InterviewCompleteProps) {
  const generatedSpec = useAtomValue(generatedSpecAtom)
  const generatedFixPlan = useAtomValue(generatedFixPlanAtom)

  return (
    <div data-testid="interview-complete" className="h-full flex flex-col bg-surface-messages">
      {/* Header */}
      <div className="border-b border-border-subtle px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-status-success/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-status-success" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-strong">
              Interview Complete
            </h2>
            <p className="text-sm text-text-muted">
              Review your feature specification before saving
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <SpecBuilder
          workspaceId={workspaceId}
          initialSpec={generatedSpec ?? ''}
          initialFixPlan={generatedFixPlan ?? ''}
          onBack={onBack}
          onDone={onDone}
        />
      </div>
    </div>
  )
}
