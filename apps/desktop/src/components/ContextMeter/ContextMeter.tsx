import { Meter } from '@koda/ui'
import { useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import {
  totalTokensAtom,
  contextLimitAtom,
  inputValueAtom,
  estimateTokenCount,
} from '@/store/chat'
import { AlertTriangle } from 'lucide-react'

/**
 * Visual context usage meter
 * Shows current token usage relative to the model's context limit
 */
export function ContextMeter() {
  const totalTokens = useAtomValue(totalTokensAtom)
  const contextLimit = useAtomValue(contextLimitAtom)
  const inputValue = useAtomValue(inputValueAtom)

  // Include pending input in the displayed count
  const pendingTokens = estimateTokenCount(inputValue)
  const displayTokens = totalTokens + pendingTokens
  const displayPercent = Math.min(100, Math.round((displayTokens / contextLimit) * 100))

  // Thresholds for visual warnings
  const isWarning = displayPercent >= 70
  const isCritical = displayPercent >= 90

  return (
    <Meter data-testid="context-meter" label="Context usage" value={displayTokens} max={contextLimit} variant="continuous" valueText={`${formatTokenCount(displayTokens)} / ${formatTokenCount(contextLimit)}`} valueDisplay={
      <div className="flex items-center gap-1.5 text-xs">
        {isCritical && (
          <AlertTriangle className="w-3.5 h-3.5 text-status-error" />
        )}
        <span
          className={cn(
            'font-mono',
            isCritical
              ? 'text-status-error'
              : isWarning
                ? 'text-status-warning'
                : 'text-text-muted'
          )}
        >
          {formatTokenCount(displayTokens)}
        </span>
        <span className="text-text-dim">/</span>
        <span className="text-text-dim">{formatTokenCount(contextLimit)}</span>
      </div>
    } />
  )
}

/**
 * Format token count for display
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
