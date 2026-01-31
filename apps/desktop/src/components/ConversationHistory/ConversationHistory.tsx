import { useState, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import { messagesAtom, type ChatMessage } from '@/store/chat'
import {
  ChevronDown,
  ChevronRight,
  Bot,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface ConversationHistoryProps {
  className?: string
}

/**
 * Conversation turn - groups user message with assistant response
 */
interface ConversationTurn {
  id: string
  userMessage: ChatMessage | null
  assistantMessage: ChatMessage | null
  timestamp: number
  summary: string
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * Extract summary from message content
 */
function extractSummary(message: ChatMessage): string {
  const content = message.content
  // Get first line or first 50 chars
  const firstLine = content.split('\n')[0] ?? content
  if (firstLine.length > 60) {
    return `${firstLine.slice(0, 57)}...`
  }
  return firstLine
}

/**
 * Conductor-style conversation history navigator.
 * Shows turn-by-turn history with expandable details.
 */
export function ConversationHistory({ className }: ConversationHistoryProps) {
  const messages = useAtomValue(messagesAtom)
  const [expandedTurns, setExpandedTurns] = useState<Set<string>>(new Set())

  // Group messages into turns (user + assistant pairs)
  const turns = useMemo(() => {
    const result: ConversationTurn[] = []
    let currentUserMessage: ChatMessage | null = null

    for (const message of messages) {
      if (message.role === 'user') {
        // If we had a user message without response, add it as incomplete turn
        if (currentUserMessage) {
          result.push({
            id: currentUserMessage.id,
            userMessage: currentUserMessage,
            assistantMessage: null,
            timestamp: currentUserMessage.timestamp,
            summary: extractSummary(currentUserMessage),
          })
        }
        currentUserMessage = message
      } else if (message.role === 'assistant' && currentUserMessage) {
        // Complete turn with user + assistant
        result.push({
          id: currentUserMessage.id,
          userMessage: currentUserMessage,
          assistantMessage: message,
          timestamp: currentUserMessage.timestamp,
          summary: extractSummary(currentUserMessage),
        })
        currentUserMessage = null
      }
    }

    // Add any pending user message
    if (currentUserMessage) {
      result.push({
        id: currentUserMessage.id,
        userMessage: currentUserMessage,
        assistantMessage: null,
        timestamp: currentUserMessage.timestamp,
        summary: extractSummary(currentUserMessage),
      })
    }

    return result.reverse() // Most recent first
  }, [messages])

  const toggleTurn = (turnId: string) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev)
      if (next.has(turnId)) {
        next.delete(turnId)
      } else {
        next.add(turnId)
      }
      return next
    })
  }

  if (turns.length === 0) {
    return (
      <div className={cn('flex flex-col h-full bg-surface-sidebar', className)} data-testid="conversation-history">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle" data-testid="conversation-history-header">
          <Clock className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">History</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-faint text-sm">
          No conversation yet
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full bg-surface-sidebar', className)} data-testid="conversation-history">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle" data-testid="conversation-history-header">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">History</span>
        </div>
        <span className="text-xs text-text-faint">{turns.length} turns</span>
      </div>

      {/* Turn list */}
      <div className="flex-1 overflow-y-auto">
        {turns.map((turn, index) => {
          const isExpanded = expandedTurns.has(turn.id)
          const isLatest = index === 0
          const status = turn.assistantMessage?.status

          return (
            <div
              key={turn.id}
              className={cn(
                'border-b border-border-subtle/50',
                isLatest && 'bg-surface-hover/30'
              )}
            >
              {/* Turn header */}
              <button
                onClick={() => toggleTurn(turn.id)}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-surface-hover/50 transition-colors"
              >
                {/* Expand icon */}
                <span className="mt-0.5 text-text-dim">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </span>

                {/* Turn info */}
                <div className="flex-1 min-w-0">
                  {/* Summary */}
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-text-muted flex-shrink-0" />
                    <span className="text-xs text-text-primary truncate">
                      {turn.summary}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-text-faint">
                      {formatRelativeTime(turn.timestamp)}
                    </span>
                    {status && (
                      <>
                        <span className="text-text-dim">•</span>
                        {status === 'complete' && (
                          <CheckCircle2 className="w-3 h-3 text-status-success" />
                        )}
                        {status === 'streaming' && (
                          <Loader2 className="w-3 h-3 text-text-accent animate-spin" />
                        )}
                        {status === 'error' && (
                          <AlertCircle className="w-3 h-3 text-status-error" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {/* User message */}
                  {turn.userMessage && (
                    <div className="flex gap-2">
                      <User className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-text-faint mb-0.5">You</div>
                        <div className="text-xs text-text-primary whitespace-pre-wrap break-words bg-surface-control/50 rounded px-2 py-1.5">
                          {turn.userMessage.content}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assistant message */}
                  {turn.assistantMessage && (
                    <div className="flex gap-2">
                      <Bot className="w-4 h-4 text-text-accent flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-text-faint mb-0.5">Assistant</div>
                        <div className="text-xs text-text-muted whitespace-pre-wrap break-words bg-surface-control/30 rounded px-2 py-1.5 max-h-32 overflow-y-auto">
                          {turn.assistantMessage.content.slice(0, 500)}
                          {turn.assistantMessage.content.length > 500 && '...'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending indicator */}
                  {!turn.assistantMessage && (
                    <div className="flex items-center gap-2 text-xs text-text-faint">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Waiting for response...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
