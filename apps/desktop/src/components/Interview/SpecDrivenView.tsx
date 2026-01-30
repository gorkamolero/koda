import { useState } from 'react'
import { InterviewMode } from './InterviewMode'

interface SpecDrivenViewProps {
  workspaceId: string
  mockMode?: boolean
  specContent?: string | null
  onStartInterview?: () => void
}

/**
 * View for spec-driven workspace mode
 * Shows interview button or current spec content
 */
export function SpecDrivenView({
  workspaceId,
  mockMode = false,
  specContent,
}: SpecDrivenViewProps) {
  const [isInterviewing, setIsInterviewing] = useState(false)

  if (isInterviewing) {
    return (
      <InterviewMode
        workspaceId={workspaceId}
        mockMode={mockMode}
        onComplete={() => { setIsInterviewing(false) }}
      />
    )
  }

  if (specContent) {
    return (
      <div data-testid="spec-section" className="h-full flex flex-col">
        {/* Spec content header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-primary">Feature Specification</h3>
          <button
            data-testid="start-interview-button"
            onClick={() => { setIsInterviewing(true) }}
            className="text-sm text-primary hover:underline"
          >
            Start New Interview
          </button>
        </div>

        {/* Spec content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            data-testid="spec-preview"
            className="font-mono text-sm whitespace-pre-wrap bg-secondary/20 rounded-lg p-4"
          >
            {specContent}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md p-6">
        <svg
          className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="text-lg font-medium text-primary mb-2">
          No Specification Yet
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Start an interview to define your feature specification. The agent
          will ask you questions to understand what you want to build.
        </p>
        <button
          data-testid="start-interview-button"
          onClick={() => { setIsInterviewing(true) }}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 transition-colors"
        >
          Start Interview
        </button>
      </div>
    </div>
  )
}
