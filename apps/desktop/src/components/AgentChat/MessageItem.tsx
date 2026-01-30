import { memo } from 'react'
import type { ChatMessage } from '@/store/chat'

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
      className={`
        px-4 py-3
        ${isUser ? 'bg-secondary/50' : isSystem ? 'bg-accent/30' : 'bg-background'}
        ${isError ? 'border-l-2 border-red-500' : ''}
      `}
    >
      <div className="flex items-start gap-3 max-w-4xl mx-auto">
        {/* Avatar */}
        <div
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
            ${isUser ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}
          `}
        >
          {isUser ? 'U' : isSystem ? 'S' : 'A'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">
              {isUser ? 'You' : isSystem ? 'System' : 'Agent'}
            </span>
            {message.model && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {message.model}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>

          <div
            className={`
              text-sm text-foreground whitespace-pre-wrap break-words
              ${isStreaming ? 'animate-pulse' : ''}
            `}
          >
            {message.content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-primary animate-blink" />
            )}
          </div>

          {message.tokenCount !== undefined && message.tokenCount > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              ~{message.tokenCount.toLocaleString()} tokens
            </div>
          )}

          {isError && (
            <div className="mt-2 text-xs text-red-500">
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
