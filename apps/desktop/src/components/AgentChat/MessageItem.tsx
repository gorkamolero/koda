import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/store/chat'
import { Bot, Terminal } from 'lucide-react'

interface MessageItemProps {
  message: ChatMessage
}

/**
 * Single message item in the chat list
 * Renders user, assistant, or system messages with appropriate styling
 */
export const MessageItem = memo(function MessageItem({
  message,
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'

  return (
    <div
      data-testid={`message-${message.id}`}
      data-role={message.role}
      data-status={message.status}
      className={cn(
        'px-4 py-4',
        isUser && 'flex justify-end',
        isSystem && 'flex justify-center'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl',
          isUser && 'bg-surface-bubble-user px-4 py-3',
          isSystem && 'bg-surface-card px-4 py-2 text-center',
          !isUser && !isSystem && 'flex gap-3',
          isError && 'border-l-2 border-status-error pl-3'
        )}
      >
        {/* Assistant messages have avatar outside bubble */}
        {!isUser && !isSystem && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-card-strong flex items-center justify-center">
            <Bot className="w-4 h-4 text-text-muted" />
          </div>
        )}

        {/* Content wrapper */}
        <div className={cn(!isUser && !isSystem && 'flex-1 min-w-0')}>
          {/* Header row - only for assistant messages */}
          {!isUser && !isSystem && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-medium text-text-primary">Agent</span>
              {message.model && (
                <span className="text-xs text-text-dim bg-surface-control px-1.5 py-0.5 rounded">
                  {message.model}
                </span>
              )}
              <span className="text-xs text-text-dim">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
          )}

          {/* System message icon */}
          {isSystem && (
            <div className="flex items-center justify-center gap-2 mb-1">
              <Terminal className="w-3.5 h-3.5 text-text-dim" />
              <span className="text-xs font-medium text-text-dim uppercase tracking-wider">
                System
              </span>
            </div>
          )}

          {/* Message content */}
          <div
            className={cn(
              'text-sm whitespace-pre-wrap break-words',
              isUser && 'text-text-strong',
              isSystem && 'text-text-muted text-xs',
              !isUser && !isSystem && 'text-text-primary',
              isStreaming && 'shimmer'
            )}
          >
            {message.content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-text-accent rounded-sm animate-pulse" />
            )}
          </div>

          {/* User message timestamp */}
          {isUser && (
            <div className="mt-1 text-xs text-text-faint opacity-70 text-right">
              {formatTimestamp(message.timestamp)}
            </div>
          )}

          {/* Token count */}
          {message.tokenCount !== undefined && message.tokenCount > 0 && !isUser && (
            <div className="mt-1.5 text-xs text-text-dim">
              ~{message.tokenCount.toLocaleString()} tokens
            </div>
          )}

          {/* Error message */}
          {isError && (
            <div className="mt-2 text-xs text-status-error flex items-center gap-1.5">
              <span className="status-dot bg-status-error" />
              Failed to generate response
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
