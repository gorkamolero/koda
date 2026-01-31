import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface ChecksViewProps {
  workspaceId: string
}

/**
 * Check status types
 */
type CheckStatus = 'pending' | 'running' | 'success' | 'failure' | 'skipped'

/**
 * CI/CD Check interface
 */
interface Check {
  id: string
  name: string
  status: CheckStatus
  description?: string
  duration?: string
  url?: string
}

/**
 * Mock checks data - would be replaced with real CI/CD integration
 */
const MOCK_CHECKS: Check[] = [
  {
    id: 'typecheck',
    name: 'TypeScript',
    status: 'success',
    description: 'Type checking passed',
    duration: '12s',
  },
  {
    id: 'lint',
    name: 'ESLint',
    status: 'success',
    description: 'No linting errors',
    duration: '8s',
  },
  {
    id: 'test',
    name: 'Tests',
    status: 'pending',
    description: 'Waiting to run',
  },
  {
    id: 'build',
    name: 'Build',
    status: 'pending',
    description: 'Waiting for tests',
  },
]

/**
 * Status icon component
 */
function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-status-success" />
    case 'failure':
      return <XCircle className="w-4 h-4 text-status-error" />
    case 'running':
      return <Loader2 className="w-4 h-4 text-text-accent animate-spin" />
    case 'pending':
      return <Clock className="w-4 h-4 text-text-faint" />
    case 'skipped':
      return <Clock className="w-4 h-4 text-text-dim" />
    default:
      return <Clock className="w-4 h-4 text-text-faint" />
  }
}

/**
 * Conductor-style CI/CD Checks view.
 * Shows status of automated checks (TypeScript, Lint, Tests, Build).
 */
export function ChecksView({ workspaceId }: ChecksViewProps) {
  void workspaceId // Will be used for real CI/CD integration
  const [checks] = useState<Check[]>(MOCK_CHECKS)
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set())

  const successCount = checks.filter((c) => c.status === 'success').length
  const failureCount = checks.filter((c) => c.status === 'failure').length
  const pendingCount = checks.filter(
    (c) => c.status === 'pending' || c.status === 'running'
  ).length

  const toggleCheck = (checkId: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev)
      if (next.has(checkId)) {
        next.delete(checkId)
      } else {
        next.add(checkId)
      }
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-surface-messages">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-topbar">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-text-primary">CI/CD Checks</h2>

          {/* Status summary */}
          <div className="flex items-center gap-2 text-xs">
            {successCount > 0 && (
              <span className="flex items-center gap-1 text-status-success">
                <CheckCircle2 className="w-3 h-3" />
                {successCount} passed
              </span>
            )}
            {failureCount > 0 && (
              <span className="flex items-center gap-1 text-status-error">
                <XCircle className="w-3 h-3" />
                {failureCount} failed
              </span>
            )}
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 text-text-faint">
                <Clock className="w-3 h-3" />
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <button className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded hover:bg-surface-hover transition-colors">
          <RefreshCw className="w-3 h-3" />
          Re-run all
        </button>
      </div>

      {/* Checks list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-2">
          {checks.map((check) => {
            const isExpanded = expandedChecks.has(check.id)

            return (
              <div
                key={check.id}
                className="border border-border-subtle rounded-lg bg-surface-control/30 overflow-hidden"
              >
                {/* Check header */}
                <button
                  onClick={() => toggleCheck(check.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/50 transition-colors"
                >
                  {/* Expand icon */}
                  <span className="text-text-dim">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>

                  {/* Status icon */}
                  <StatusIcon status={check.status} />

                  {/* Name */}
                  <span className="flex-1 text-left text-sm font-medium text-text-primary">
                    {check.name}
                  </span>

                  {/* Duration */}
                  {check.duration && (
                    <span className="text-xs text-text-faint">{check.duration}</span>
                  )}

                  {/* External link */}
                  {check.url && (
                    <a
                      href={check.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-text-muted hover:text-text-primary"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-border-subtle/50">
                    <p className="text-xs text-text-muted">{check.description}</p>
                    {check.status === 'failure' && (
                      <div className="mt-2 p-2 rounded bg-status-error/10 text-xs text-status-error font-mono">
                        Error: Check failed. See logs for details.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {checks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CheckCircle2 className="w-12 h-12 text-text-dim mb-4" />
            <p className="text-sm text-text-muted">No checks configured</p>
            <p className="text-xs text-text-faint mt-1">
              Configure CI/CD to see check status here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
