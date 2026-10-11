import { Button, Textarea, QuestionCard as UIQuestionCard } from '@koda/ui'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { InterviewQuestion, InterviewAnswer } from '@/store/interview'
import { Check } from 'lucide-react'

interface QuestionCardProps {
  question: InterviewQuestion
  answer?: InterviewAnswer
  onAnswerChange: (value: string, selectedChoices?: string[]) => void
}

/**
 * Card component for displaying and answering interview questions
 */
export function QuestionCard({
  question,
  answer,
  onAnswerChange,
}: QuestionCardProps) {
  const [textValue, setTextValue] = useState(answer?.value ?? '')
  const [selectedChoices, setSelectedChoices] = useState<string[]>(
    answer?.selectedChoices ?? []
  )

  // Sync state when answer prop changes (e.g., when navigating back)
  useEffect(() => {
    setTextValue(answer?.value ?? '')
    setSelectedChoices(answer?.selectedChoices ?? [])
  }, [answer, question.id])

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setTextValue(value)
      onAnswerChange(value)
    },
    [onAnswerChange]
  )

  const handleChoiceToggle = useCallback(
    (choice: string) => {
      const newChoices = selectedChoices.includes(choice)
        ? selectedChoices.filter((c) => c !== choice)
        : [...selectedChoices, choice]

      setSelectedChoices(newChoices)
      onAnswerChange(newChoices.join(', '), newChoices)
    },
    [selectedChoices, onAnswerChange]
  )

  return (
    <UIQuestionCard appearance="interview" aria-label={question.question} hideActions heading={<>
      <div className="mb-6">
        <h3
          data-testid="interview-question"
          className="text-xl font-semibold text-text-strong mb-2"
        >
          {question.question}
          {question.required && (
            <span className="text-status-error ml-1">*</span>
          )}
        </h3>
        {question.description && (
          <p className="text-text-muted">{question.description}</p>
        )}
      </div>
      </>}>

      {question.type === 'text' && (
        <div>
          <Textarea
            data-testid="interview-text-input"
            value={textValue}
            onChange={handleTextChange}
            placeholder={question.placeholder}
            className={cn(
              'w-full min-h-30 rounded-xl',
              'bg-surface-control border border-border-subtle',
              'px-4 py-3 text-sm text-text-primary',
              'placeholder:text-text-dim',
              'focus:outline-none focus:border-border-accent focus:ring-1 focus:ring-border-accent-soft',
              'resize-y transition-colors'
            )}
          />
        </div>
      )}

      {question.type === 'multiple-choice' && question.choices && (
        <div data-testid="interview-choices" className="space-y-3">
          {question.choices.map((choice) => {
            const isSelected = selectedChoices.includes(choice)
            return (
              <Button variant="unstyled"
                key={choice}
                data-testid="interview-choice-option"
                data-selected={isSelected}
                onClick={() => { handleChoiceToggle(choice) }}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl border transition-all',
                  isSelected
                    ? 'border-border-accent bg-surface-active text-text-strong'
                    : 'border-border-subtle bg-surface-card hover:border-border-accent/50 hover:bg-surface-hover'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                      isSelected
                        ? 'border-border-accent bg-gradient-to-br from-[var(--meter-start)] to-[var(--meter-end)]'
                        : 'border-text-dim'
                    )}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-[var(--choice-check)]" strokeWidth={3} />
                    )}
                  </div>
                  <span className="text-sm font-medium">{choice}</span>
                </div>
              </Button>
            )
          })}
        </div>
      )}
    </UIQuestionCard>
  )
}
