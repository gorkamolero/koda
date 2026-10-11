import { Button } from '@koda/ui'
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
            className="h-full rounded-full bg-gradient-to-r from-[var(--meter-start)] to-[var(--meter-end)] transition-all duration-300"
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
          <Button variant="unstyled"
            data-testid="interview-back-button"
            onClick={handleBack}
            disabled={isFirstQuestion}
            className={cn(
              'px-4 py-2 rounded-lg font-semibold text-sm bg-transparent text-text-muted border border-border-strong hover:text-text-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-normal',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button variant="unstyled"
            data-testid="interview-next-button"
            onClick={handleNext}
            disabled={!hasValidAnswer && currentQuestion?.required}
            className={cn(
              isLastQuestion ? 'px-4 py-2 rounded-md font-medium text-sm text-inverse bg-[var(--accent-terracotta)] hover:brightness-110 transition-all duration-normal' : 'px-4 py-2 rounded-lg font-semibold text-sm text-text-primary bg-surface-card-strong hover:bg-surface-control-hover transition-colors duration-normal',
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
          </Button>
        </div>
      </div>
    </div>
  )
}
