import { useRef, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAtomValue } from 'jotai'
import { messagesAtom } from '@/store/chat'
import { MessageItem } from './MessageItem'
import { ScrollMinimap } from './ScrollMinimap'

/**
 * Terminal-style virtualized message list
 * ┌─ MESSAGES ───────────────────────────┐
 * │ > user input here                    │
 * │                                      │
 * │ ┌─ KODA ──────────────────────────┐  │
 * │ │ Response text here...           │  │
 * │ └─────────────────────────────────┘  │
 * └──────────────────────────────────────┘
 */
export function MessageList() {
  const messages = useAtomValue(messagesAtom)
  const parentRef = useRef<HTMLDivElement>(null)
  const scrollToBottomRef = useRef(true)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 100, []),
    overscan: 5,
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
        className="h-full w-full flex flex-col items-center justify-center font-mono bg-[#000000]"
      >
        <pre className="text-xs text-text-faint leading-tight">
{`┌────────────────────────────────────┐
│                                    │
│      `}<span className="text-text-accent">KODA TERMINAL</span>{` v0.1.0          │
│                                    │
│  ██╗  ██╗ ██████╗ ██████╗  █████╗  │
│  ██║ ██╔╝██╔═══██╗██╔══██╗██╔══██╗ │
│  █████╔╝ ██║   ██║██║  ██║███████║ │
│  ██╔═██╗ ██║   ██║██║  ██║██╔══██║ │
│  ██║  ██╗╚██████╔╝██████╔╝██║  ██║ │
│  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝ │
│                                    │
│  Ready for input...                │
│                                    │
└────────────────────────────────────┘`}
        </pre>
        <div className="mt-4 text-xs text-text-muted">
          Type a message or use /commands
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div
        ref={parentRef}
        data-testid="message-list"
        data-virtualized="true"
        className="h-full overflow-auto font-mono bg-[#000000]"
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
                <MessageItem message={message} turnIndex={virtualItem.index} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Scroll minimap */}
      <ScrollMinimap containerRef={parentRef} />
    </div>
  )
}
