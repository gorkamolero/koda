import { useState, useEffect, useCallback } from 'react'
import type { InterviewQuestion, InterviewAnswer } from '@/store/interview'

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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h3
          data-testid="interview-question"
          className="text-xl font-semibold text-primary mb-2"
        >
          {question.question}
          {question.required && (
            <span className="text-destructive ml-1">*</span>
          )}
        </h3>
        {question.description && (
          <p className="text-muted-foreground">{question.description}</p>
        )}
      </div>

      {question.type === 'text' && (
        <div>
          <textarea
            data-testid="interview-text-input"
            value={textValue}
            onChange={handleTextChange}
            placeholder={question.placeholder}
            className="w-full min-h-[120px] rounded-md border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
          />
        </div>
      )}

      {question.type === 'multiple-choice' && question.choices && (
        <div data-testid="interview-choices" className="space-y-3">
          {question.choices.map((choice) => {
            const isSelected = selectedChoices.includes(choice)
            return (
              <button
                key={choice}
                data-testid="interview-choice-option"
                data-selected={isSelected}
                onClick={() => { handleChoiceToggle(choice) }}
                className={`
                  w-full text-left px-4 py-3 rounded-md border transition-colors
                  ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:border-primary/50 hover:bg-accent'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}
                  `}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium">{choice}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
