import { useAtomValue } from 'jotai'
import { generatedSpecAtom, generatedFixPlanAtom } from '@/store/interview'
import { SpecBuilder } from './SpecBuilder'

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
    <div data-testid="interview-complete" className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-primary">
          Interview Complete
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your feature specification before saving
        </p>
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
