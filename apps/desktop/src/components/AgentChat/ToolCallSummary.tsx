import { Button } from '@koda/ui'
import { memo, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ContentBlock, ToolUseContentBlock, ToolResultContentBlock } from '@/store/chat'
import { ChevronDown, ChevronRight } from 'lucide-react'

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
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled'
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
    } else if (tool.status === 'cancelled') {
      status = 'cancelled'
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

function getStatusIndicator(status: ToolSummaryItem['status']): { symbol: string; color: string } {
  switch (status) {
    case 'success':
      return { symbol: '✓', color: 'text-[--git-green]' }
    case 'error':
      return { symbol: '✗', color: 'text-status-error' }
    case 'running':
      return { symbol: '◉', color: 'text-status-warning' }
    case 'cancelled':
      return { symbol: 'Stopped', color: 'text-text-muted' }
    case 'pending':
    default:
      return { symbol: '○', color: 'text-text-faint' }
  }
}

// ============================================================================
// ToolCallSummary Component - Terminal Aesthetic
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
  const stoppedCount = toolItems.filter(t => t.status === 'cancelled').length

  // Terminal-style summary
  const statusParts: string[] = []
  if (completedCount > 0) statusParts.push(`${completedCount}✓`)
  if (runningCount > 0) statusParts.push(`${runningCount}◉`)
  if (errorCount > 0) statusParts.push(`${errorCount}✗`)
  if (stoppedCount > 0) statusParts.push(`${stoppedCount} stopped`)

  return (
    <div className={cn('font-mono text-xs', className)}>
      {/* Collapsed header */}
      <Button variant="unstyled"
        onClick={() => { setIsExpanded(!isExpanded) }}
        className="h-auto justify-start rounded-none w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-surface-hover transition-colors border border-dashed border-border-subtle"
      >
        {isExpanded ? (
          <ChevronDown className="size-3 text-text-faint" />
        ) : (
          <ChevronRight className="size-3 text-text-faint" />
        )}

        <span className="text-text-muted">
          [TOOLS:{toolItems.length}]
        </span>

        {statusParts.length > 0 && (
          <span className="text-text-faint">
            ({statusParts.join(' ')})
          </span>
        )}
      </Button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border border-t-0 border-dashed border-border-subtle">
          {toolItems.map((tool, idx) => {
            const { symbol, color } = getStatusIndicator(tool.status)
            return (
              <div
                key={tool.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5",
                  idx < toolItems.length - 1 && "border-b border-dashed border-border-subtle"
                )}
              >
                <span className={color}>[{symbol}]</span>
                <span className="text-text-primary">{tool.name}</span>
                {tool.durationMs && (
                  <span className="text-text-faint ml-auto">
                    {formatDuration(tool.durationMs)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
