import { useAtomValue } from 'jotai'
import {
  totalTokensAtom,
  contextLimitAtom,
  inputValueAtom,
  estimateTokenCount,
} from '@/store/chat'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface ContextCategory {
  name: string
  percent: number
  symbol: string
}

/**
 * Format token count for display (e.g., 157.6K)
 */
function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

/**
 * Simulated context breakdown stats
 * In a real implementation, these would come from the agent session
 */
function getContextCategories(usedPercent: number): ContextCategory[] {
  const ratios = [
    { name: 'Messages', ratio: 0.447, symbol: '█' },
    { name: 'Autocompact', ratio: 0.165, symbol: '▓' },
    { name: 'System tools', ratio: 0.055, symbol: '▒' },
    { name: 'Skills', ratio: 0.029, symbol: '░' },
    { name: 'System prompt', ratio: 0.018, symbol: '▪' },
    { name: 'Memory files', ratio: 0.006, symbol: '·' },
    { name: 'MCP tools', ratio: 0.005, symbol: '·' },
    { name: 'Custom agents', ratio: 0.002, symbol: '·' },
  ]

  return ratios.map((r) => ({
    name: r.name,
    percent: Number((usedPercent * r.ratio * 100).toFixed(1)),
    symbol: r.symbol,
  }))
}

interface ContextStatsPopoverProps {
  className?: string
}

/**
 * Context stats popover showing detailed breakdown of context usage
 * Terminal aesthetic with ASCII progress bar
 */
export function ContextStatsPopover({ className }: ContextStatsPopoverProps) {
  const totalTokens = useAtomValue(totalTokensAtom)
  const contextLimit = useAtomValue(contextLimitAtom)
  const inputValue = useAtomValue(inputValueAtom)

  // Include pending input in the displayed count
  const pendingTokens = estimateTokenCount(inputValue)
  const displayTokens = totalTokens + pendingTokens
  const usedPercent = displayTokens / contextLimit

  const categories = getContextCategories(usedPercent)

  // ASCII progress bar
  const barWidth = 20
  const filledChars = Math.round(usedPercent * barWidth)
  const progressBar = '█'.repeat(Math.min(filledChars, barWidth)) + '░'.repeat(Math.max(0, barWidth - filledChars))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-xs font-mono',
            'text-text-muted hover:text-text-accent transition-colors',
            className
          )}
          title="View context"
        >
          <span className="text-text-faint">[</span>
          <span>CTX:</span>
          <span className={cn(
            usedPercent > 0.8 ? 'text-status-error' :
            usedPercent > 0.6 ? 'text-status-warning' :
            'text-text-muted'
          )}>
            {Math.round(usedPercent * 100)}%
          </span>
          <span className="text-text-faint">]</span>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0 bg-[#0a0a0a] border border-dashed border-border-strong font-mono" 
        align="start" 
        sideOffset={8}
      >
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-dashed border-border-subtle text-xs">
          <span className="text-text-faint">┌─ </span>
          <span className="text-text-accent">CONTEXT USAGE</span>
          <span className="text-text-faint"> {'─'.repeat(12)}┐</span>
        </div>

        {/* Progress section */}
        <div className="px-3 py-2 border-b border-dashed border-border-subtle">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-faint">│</span>
            <span className="text-text-muted">
              {formatTokenCount(displayTokens)} / {formatTokenCount(contextLimit)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-faint">│</span>
            <span className={cn(
              usedPercent > 0.8 ? 'text-status-error' :
              usedPercent > 0.6 ? 'text-status-warning' :
              'text-text-accent'
            )}>
              {progressBar}
            </span>
            <span className="text-text-faint">{Math.round(usedPercent * 100)}%</span>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="px-3 py-2 space-y-1 text-xs">
          {categories.map((category) => (
            <div key={category.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-text-faint">│</span>
                <span className="text-text-accent">{category.symbol}</span>
                <span className="text-text-muted">{category.name}</span>
              </div>
              <span className="text-text-faint">
                {category.percent > 0 ? `${String(category.percent)}%` : '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-1 text-xs text-text-faint">
          └{'─'.repeat(32)}┘
        </div>
      </PopoverContent>
    </Popover>
  )
}
