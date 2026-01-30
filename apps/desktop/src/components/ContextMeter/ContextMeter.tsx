import { useAtomValue } from 'jotai'
import {
  totalTokensAtom,
  contextLimitAtom,
  contextUsagePercentAtom,
  inputValueAtom,
  estimateTokenCount,
} from '@/store/chat'

/**
 * Visual context usage meter
 * Shows current token usage relative to the model's context limit
 */
export function ContextMeter() {
  const totalTokens = useAtomValue(totalTokensAtom)
  const contextLimit = useAtomValue(contextLimitAtom)
  const usagePercent = useAtomValue(contextUsagePercentAtom)
  const inputValue = useAtomValue(inputValueAtom)

  // Include pending input in the displayed count
  const pendingTokens = estimateTokenCount(inputValue)
  const displayTokens = totalTokens + pendingTokens

  // Determine color based on usage
  const getUsageColor = (percent: number): string => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getUsageTextColor = (percent: number): string => {
    if (percent >= 90) return 'text-red-500'
    if (percent >= 70) return 'text-yellow-500'
    return 'text-muted-foreground'
  }

  return (
    <div
      data-testid="context-meter"
      className="flex items-center gap-3"
    >
      {/* Progress bar */}
      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out ${getUsageColor(usagePercent)}`}
          style={{
            width: `${String(usagePercent)}%`,
            // Use GPU-accelerated transform for smooth animation
            transform: 'translateZ(0)',
          }}
        />
      </div>

      {/* Token count */}
      <div className={`text-xs ${getUsageTextColor(usagePercent)}`}>
        <span className="font-mono">{formatTokenCount(displayTokens)}</span>
        <span className="text-muted-foreground"> / {formatTokenCount(contextLimit)}</span>
      </div>
    </div>
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
