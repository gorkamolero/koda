import { memo, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ContentBlock, ToolUseContentBlock, ToolResultContentBlock } from '@/store/chat'
import { ChevronDown, ChevronRight, Check, Loader2, AlertCircle, Clock } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface ToolCallSummaryProps {
  contentBlocks: ContentBlock[]
  className?: string
}

interface ToolSummaryItem {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  durationMs?: number
  hasResult: boolean
}

// ============================================================================
// Helpers
// ============================================================================

function getToolItems(blocks: ContentBlock[]): ToolSummaryItem[] {
  const toolUses = blocks.filter(
    (b): b is ToolUseContentBlock => b.type === 'tool_use'
  )

  return toolUses.map(tool => {
    const result = blocks.find(
      (b): b is ToolResultContentBlock =>
        b.type === 'tool_result' && b.toolUseId === tool.id
    )

    let status: ToolSummaryItem['status'] = 'pending'
    if (result?.isError || result?.error) {
      status = 'error'
    } else if (result) {
      status = 'success'
    } else if (tool.status === 'running') {
      status = 'running'
    }

    return {
      id: tool.id,
      name: tool.name,
      status,
      durationMs: tool.durationMs,
      hasResult: !!result,
    }
  })
}

function formatDuration(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${String(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getStatusIcon(status: ToolSummaryItem['status']) {
  switch (status) {
    case 'success':
      return <Check className="w-3.5 h-3.5 text-status-success" />
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-status-error" />
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-status-warning animate-spin" />
    case 'pending':
    default:
      return <Clock className="w-3.5 h-3.5 text-text-dim" />
  }
}

// ============================================================================
// ToolCallSummary Component
// ============================================================================

export const ToolCallSummary = memo(function ToolCallSummary({
  contentBlocks,
  className,
}: ToolCallSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toolItems = useMemo(() => getToolItems(contentBlocks), [contentBlocks])

  // Don't render if no tool calls
  if (toolItems.length === 0) return null

  const completedCount = toolItems.filter(t => t.status === 'success').length
  const errorCount = toolItems.filter(t => t.status === 'error').length
  const runningCount = toolItems.filter(t => t.status === 'running').length

  // Summary text
  let summaryText = `${String(toolItems.length)} tool call${toolItems.length !== 1 ? 's' : ''}`
  if (completedCount > 0 || errorCount > 0 || runningCount > 0) {
    const parts: string[] = []
    if (completedCount > 0) parts.push(`${String(completedCount)} completed`)
    if (runningCount > 0) parts.push(`${String(runningCount)} running`)
    if (errorCount > 0) parts.push(`${String(errorCount)} failed`)
    summaryText += ` • ${parts.join(', ')}`
  }

  return (
    <div className={cn('rounded-lg border border-border-subtle bg-surface-card', className)}>
      {/* Collapsed header */}
      <button
        onClick={() => { setIsExpanded(!isExpanded) }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted" />
        )}

        {/* Status indicators */}
        <div className="flex items-center gap-1">
          {runningCount > 0 && (
            <Loader2 className="w-3.5 h-3.5 text-status-warning animate-spin" />
          )}
          {completedCount > 0 && errorCount === 0 && runningCount === 0 && (
            <Check className="w-3.5 h-3.5 text-status-success" />
          )}
          {errorCount > 0 && (
            <AlertCircle className="w-3.5 h-3.5 text-status-error" />
          )}
        </div>

        <span className="text-sm text-text-muted">{summaryText}</span>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border-subtle">
          {toolItems.map(tool => (
            <div
              key={tool.id}
              className="flex items-center gap-3 px-3 py-2 text-sm border-b border-border-subtle last:border-b-0"
            >
              {getStatusIcon(tool.status)}
              <span className="font-mono text-text-primary">{tool.name}</span>
              {tool.durationMs && (
                <span className="text-text-dim text-xs ml-auto">
                  {formatDuration(tool.durationMs)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
