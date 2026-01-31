import { useEffect, useCallback } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import {
  currentInterviewWorkspaceIdAtom,
  currentQuestionAtom,
  interviewProgressAtom,
  isInterviewCompleteAtom,
  setAnswerAtom,
  nextQuestionAtom,
  previousQuestionAtom,
  hasValidAnswerAtom,
  getAnswerForQuestionAtom,
} from '@/store/interview'
import { QuestionCard } from './QuestionCard'
import { ProgressIndicator } from './ProgressIndicator'
import { InterviewComplete } from './InterviewComplete'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

interface InterviewModeProps {
  workspaceId: string
  onComplete?: () => void
}

/**
 * Interview mode component for gathering feature requirements
 */
export function InterviewMode({
  workspaceId,
  onComplete,
}: InterviewModeProps) {
  const setCurrentWorkspaceId = useSetAtom(currentInterviewWorkspaceIdAtom)
  const currentQuestion = useAtomValue(currentQuestionAtom)
  const progress = useAtomValue(interviewProgressAtom)
  const isComplete = useAtomValue(isInterviewCompleteAtom)
  const setAnswer = useSetAtom(setAnswerAtom)
  const nextQuestion = useSetAtom(nextQuestionAtom)
  const previousQuestion = useSetAtom(previousQuestionAtom)
  const hasValidAnswer = useAtomValue(hasValidAnswerAtom)
  const getAnswerForQuestion = useAtomValue(getAnswerForQuestionAtom)

  // Set workspace ID on mount
  useEffect(() => {
    setCurrentWorkspaceId(workspaceId)
    return () => {
      setCurrentWorkspaceId(null)
    }
  }, [workspaceId, setCurrentWorkspaceId])

  const handleAnswerChange = useCallback(
    (value: string, selectedChoices?: string[]) => {
      setAnswer(value, selectedChoices)
    },
    [setAnswer]
  )

  const handleNext = useCallback(() => {
    nextQuestion()
  }, [nextQuestion])

  const handleBack = useCallback(() => {
    previousQuestion()
  }, [previousQuestion])

  const handleComplete = useCallback(() => {
    onComplete?.()
  }, [onComplete])

  // Get current answer for the question
  const currentAnswer = currentQuestion
    ? getAnswerForQuestion(currentQuestion.id)
    : undefined

  if (isComplete) {
    return (
      <InterviewComplete
        workspaceId={workspaceId}
        onBack={handleBack}
        onDone={handleComplete}
      />
    )
  }

  const isLastQuestion = progress.current === progress.total
  const isFirstQuestion = progress.current === 1

  return (
    <div
      data-testid="interview-container"
      className="h-full flex flex-col bg-surface-messages"
    >
      {/* Header with progress */}
      <div className="border-b border-border-subtle px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-strong">
            Feature Interview
          </h2>
          <ProgressIndicator
            current={progress.current}
            total={progress.total}
            percent={progress.percent}
          />
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-surface-control rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#62b7ff] to-[#4fe3a3] transition-all duration-300"
            style={{ width: `${String(progress.percent)}%` }}
          />
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 overflow-y-auto p-6">
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            answer={currentAnswer}
            onAnswerChange={handleAnswerChange}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="border-t border-border-subtle px-6 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            data-testid="interview-back-button"
            onClick={handleBack}
            disabled={isFirstQuestion}
            className={cn(
              'btn-ghost',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </button>
          <button
            data-testid="interview-next-button"
            onClick={handleNext}
            disabled={!hasValidAnswer && currentQuestion?.required}
            className={cn(
              isLastQuestion ? 'btn-primary' : 'btn-secondary',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none'
            )}
          >
            {isLastQuestion ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Complete
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
