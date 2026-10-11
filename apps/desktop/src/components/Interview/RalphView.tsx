import { Button } from '@koda/ui'
import { useState } from 'react'
import { useWorkspace } from '@/hooks/useRpc'
import { InterviewMode } from './InterviewMode'

interface RalphViewProps {
  workspaceId: string
}

/**
 * View for Ralph autonomous agent mode
 * Shows both spec and fix plan sections
 */
export function RalphView({ workspaceId }: RalphViewProps) {
  const [isInterviewing, setIsInterviewing] = useState(false)
  const { data: workspace } = useWorkspace(workspaceId)

  // Get spec and fix plan content from workspace if available
  const specContent = (workspace as { specContent?: string })?.specContent
  const fixPlanContent = (workspace as { fixPlanContent?: string })?.fixPlanContent

  if (isInterviewing) {
    return (
      <InterviewMode
        workspaceId={workspaceId}
        onComplete={() => { setIsInterviewing(false) }}
      />
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
        <div>
          <h2 className="text-lg font-semibold text-primary">Ralph Mode</h2>
          <p className="text-sm text-muted-foreground">
            Autonomous agent with spec-driven workflow
          </p>
        </div>
        <Button variant="unstyled"
          data-testid="start-interview-button"
          onClick={() => { setIsInterviewing(true) }}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 transition-colors"
        >
          New Interview
        </Button>
      </div>

      {/* Content split view */}
      <div className="flex-1 overflow-hidden flex">
        {/* Spec section */}
        <div
          data-testid="spec-section"
          className="flex-1 border-r border-border flex flex-col"
        >
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="font-medium text-sm text-primary">
              Feature Specification
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {specContent ? (
              <div
                data-testid="spec-preview"
                className="font-mono text-sm whitespace-pre-wrap"
              >
                {specContent}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                  No specification yet. Start an interview to define one.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Fix plan section */}
        <div
          data-testid="fix-plan-section"
          className="flex-1 flex flex-col"
        >
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="font-medium text-sm text-primary">Fix Plan</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {fixPlanContent ? (
              <div className="font-mono text-sm whitespace-pre-wrap">
                <FixPlanRenderer content={fixPlanContent} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                  Fix plan will be generated from the specification.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders fix plan content with checkbox styling
 */
function FixPlanRenderer({ content }: { content: string }) {
  // Parse tasks from markdown-style checkboxes
  const lines = content.split('\n')

  return (
    <div data-testid="fix-plan-preview" className="space-y-1">
      {lines.map((line, index) => {
        const taskMatch = line.match(/^\[( |x)\]\s*(.+)$/)

        if (taskMatch) {
          const isChecked = taskMatch[1] === 'x'
          const taskText = taskMatch[2] ?? ''

          return (
            <div
              key={`task-${index.toString()}-${taskText.slice(0, 20)}`}
              className="flex items-start gap-2"
            >
              <div
                className={`
                  w-4 h-4 mt-0.5 rounded border flex items-center justify-center flex-shrink-0
                  ${
                    isChecked
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground'
                  }
                `}
              >
                {isChecked && (
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
              <span
                className={isChecked ? 'line-through text-muted-foreground' : ''}
              >
                {taskText}
              </span>
            </div>
          )
        }

        // Handle headers
        if (line.startsWith('#')) {
          const level = line.match(/^#+/)?.[0].length ?? 1
          const text = line.replace(/^#+\s*/, '')
          const className =
            level === 1
              ? 'text-lg font-bold mt-4 mb-2'
              : level === 2
                ? 'text-base font-semibold mt-3 mb-1'
                : 'text-sm font-medium mt-2'

          return (
            <div key={`header-${index.toString()}-${text.slice(0, 20)}`} className={className}>
              {text}
            </div>
          )
        }

        // Regular text
        if (line.trim()) {
          return (
            <div key={`line-${index.toString()}-${line.slice(0, 20)}`} className="text-sm">
              {line}
            </div>
          )
        }

        return <div key={`empty-${index.toString()}`} className="h-2" />
      })}
    </div>
  )
}
