import { useEffect, useCallback } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
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

  return (
    <div
      data-testid="interview-container"
      className="h-full flex flex-col bg-background"
    >
      {/* Header with progress */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">
            Feature Interview
          </h2>
          <ProgressIndicator
            current={progress.current}
            total={progress.total}
            percent={progress.percent}
          />
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
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
      <div className="border-t border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            data-testid="interview-back-button"
            onClick={handleBack}
            disabled={progress.current === 1}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Back
          </button>
          <button
            data-testid="interview-next-button"
            onClick={handleNext}
            disabled={!hasValidAnswer && currentQuestion?.required}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {progress.current === progress.total ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
