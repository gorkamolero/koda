import { useRef, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAtomValue } from 'jotai'
import { messagesAtom } from '@/store/chat'
import { MessageItem } from './MessageItem'
import { MessageCircle } from 'lucide-react'

/**
 * Virtualized message list for efficient rendering of large chat histories
 * Uses @tanstack/react-virtual for optimal performance
 */
export function MessageList() {
  const messages = useAtomValue(messagesAtom)
  const parentRef = useRef<HTMLDivElement>(null)
  const scrollToBottomRef = useRef(true)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 100, []), // Estimated row height
    overscan: 5, // Render 5 extra items above/below viewport
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollToBottomRef.current && messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
    }
  }, [messages.length, virtualizer])

  // Track scroll position to determine if we should auto-scroll
  const handleScroll = useCallback(() => {
    if (!parentRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    scrollToBottomRef.current = isNearBottom
  }, [])

  if (messages.length === 0) {
    return (
      <div
        data-testid="message-list"
        data-virtualized="true"
        className="h-full flex flex-col items-center justify-center bg-surface-messages"
      >
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-surface-card-strong flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-text-dim" />
          </div>
          <h3 className="text-text-muted text-sm font-medium mb-1">No messages yet</h3>
          <p className="text-text-faint text-xs max-w-[200px]">
            Start a conversation with the agent to begin
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      data-testid="message-list"
      data-virtualized="true"
      className="h-full overflow-auto bg-surface-messages fade-mask-y"
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${String(virtualizer.getTotalSize())}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const message = messages[virtualItem.index]
          if (!message) return null
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${String(virtualItem.start)}px)`,
              }}
            >
              <MessageItem message={message} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
