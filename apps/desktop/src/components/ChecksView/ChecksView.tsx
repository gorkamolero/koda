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
import { useChecks } from '@/hooks/useRpc'
import type { GhCheckStatus } from '@/lib/rpc'

interface ChecksViewProps {
  workspaceId: string
}

/**
 * Status icon component
 */
function StatusIcon({ status }: { status: GhCheckStatus }) {
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
 * Shows status of automated checks from GitHub Actions.
 */
export function ChecksView({ workspaceId }: ChecksViewProps) {
  const { data, isLoading, refetch, isRefetching } = useChecks(workspaceId)
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set())

  const checks = data?.checks ?? []
  const prUrl = data?.prUrl
  const commitSha = data?.commitSha

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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading checks...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-messages" data-testid="checks-view-container">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-topbar" data-testid="checks-view-header">
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
        <div className="flex items-center gap-2">
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded hover:bg-surface-hover transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View PR
            </a>
          )}
          <button
            onClick={() => void refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Commit info */}
      {commitSha && (
        <div className="px-4 py-2 text-xs text-text-faint border-b border-border-subtle/50">
          Checks for commit <code className="font-mono">{commitSha.slice(0, 7)}</code>
        </div>
      )}

      {/* Checks list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-2">
          {checks.map((check) => {
            const isExpanded = expandedChecks.has(check.id)

            return (
              <div
                key={check.id}
                data-testid={`check-item-${check.id}`}
                data-status={check.status}
                className="border border-border-subtle rounded-lg bg-surface-control/30 overflow-hidden"
              >
                {/* Check header */}
                <button
                  onClick={() => { toggleCheck(check.id); }}
                  data-testid={`check-button-${check.id}`}
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
                      onClick={(e) => { e.stopPropagation(); }}
                      className="p-1 text-text-muted hover:text-text-primary"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-border-subtle/50">
                    <p className="text-xs text-text-muted">{check.description ?? `Status: ${check.status}`}</p>
                    {check.status === 'failure' && (
                      <div className="mt-2 p-2 rounded bg-status-error/10 text-xs text-status-error font-mono">
                        Check failed. {check.url ? 'Click the link to see logs.' : ''}
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
            <p className="text-sm text-text-muted">No checks found</p>
            <p className="text-xs text-text-faint mt-1">
              {prUrl
                ? 'No CI/CD checks have run for this PR yet'
                : 'Push changes or create a PR to trigger CI/CD checks'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
