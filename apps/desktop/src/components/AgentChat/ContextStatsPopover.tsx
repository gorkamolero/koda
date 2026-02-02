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
import { BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContextCategory {
  name: string
  percent: number
  color: string
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
  // Distribute the used percentage across categories
  // These ratios are based on typical Claude Code sessions
  const ratios = [
    { name: 'Messages', ratio: 0.447, color: 'bg-status-unread' },
    { name: 'Autocompact buffer', ratio: 0.165, color: 'bg-border-accent' },
    { name: 'System tools', ratio: 0.055, color: 'bg-status-success' },
    { name: 'Skills', ratio: 0.029, color: 'bg-status-warning' },
    { name: 'System prompt', ratio: 0.018, color: 'bg-status-error' },
    { name: 'Memory files', ratio: 0.006, color: 'bg-status-reviewing' },
    { name: 'MCP tools', ratio: 0.005, color: 'bg-status-reviewing' },
    { name: 'Custom agents', ratio: 0.002, color: 'bg-text-muted' },
  ]

  return ratios.map((r) => ({
    name: r.name,
    percent: Number((usedPercent * r.ratio * 100).toFixed(1)),
    color: r.color,
  }))
}

interface ContextStatsPopoverProps {
  className?: string
}

/**
 * Context stats popover showing detailed breakdown of context usage
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-center size-7 text-muted-foreground hover:text-foreground rounded transition-colors',
            className
          )}
          title="View context"
        >
          <BarChart2 className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" sideOffset={8}>
        {/* Header with total context */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Context</span>
            <span className="text-xs text-muted-foreground">
              {formatTokenCount(displayTokens)}/{formatTokenCount(contextLimit)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
              style={{ width: `${String(Math.min(usedPercent * 100, 100))}%` }}
            />
          </div>
        </div>

        {/* Category breakdown */}
        <div className="p-3 space-y-2">
          {categories.map((category) => (
            <div key={category.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', category.color)} />
                <span className="text-xs text-muted-foreground">{category.name}</span>
              </div>
              <span className="text-xs font-mono text-foreground">
                {category.percent > 0 ? `${String(category.percent)}%` : '—'}
              </span>
            </div>
          ))}
        </div>

      </PopoverContent>
    </Popover>
  )
}
