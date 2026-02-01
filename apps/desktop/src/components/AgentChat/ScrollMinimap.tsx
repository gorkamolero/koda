import { memo, useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import { messagesAtom, type ChatMessage } from '@/store/chat'

// ============================================================================
// Types
// ============================================================================

interface ScrollMinimapProps {
  containerRef: React.RefObject<HTMLDivElement>
  className?: string
}

interface MinimapSegment {
  id: string
  type: 'user' | 'assistant' | 'thinking' | 'tool' | 'system'
  startPercent: number
  heightPercent: number
}

// ============================================================================
// Helpers
// ============================================================================

function getSegmentColor(type: MinimapSegment['type']): string {
  switch (type) {
    case 'user':
      return 'bg-blue-500'
    case 'thinking':
      return 'bg-purple-500'
    case 'tool':
      return 'bg-green-500'
    case 'assistant':
      return 'bg-text-muted'
    case 'system':
      return 'bg-yellow-500/50'
    default:
      return 'bg-text-dim'
  }
}

function getMessageType(message: ChatMessage): MinimapSegment['type'] {
  if (message.role === 'user') return 'user'
  if (message.role === 'system') return 'system'

  // Check for thinking or tool blocks
  if (message.contentBlocks) {
    const hasThinking = message.contentBlocks.some(b => b.type === 'thinking')
    const hasTools = message.contentBlocks.some(b => b.type === 'tool_use')

    if (hasThinking) return 'thinking'
    if (hasTools) return 'tool'
  }

  return 'assistant'
}

function estimateContentLength(message: ChatMessage): number {
  let length = message.content.length

  if (message.contentBlocks) {
    for (const block of message.contentBlocks) {
      if (block.type === 'thinking') {
        length += block.content.length
      } else if (block.type === 'tool_use') {
        length += 500 // Fixed estimate for tool blocks
      }
    }
  }

  return Math.max(length, 100) // Minimum height
}

// ============================================================================
// ScrollMinimap Component
// ============================================================================

export const ScrollMinimap = memo(function ScrollMinimap({
  containerRef,
  className,
}: ScrollMinimapProps) {
  const messages = useAtomValue(messagesAtom)
  const [scrollInfo, setScrollInfo] = useState({
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 0,
  })
  const minimapRef = useRef<HTMLDivElement>(null)

  // Update scroll info
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScrollInfo = () => {
      setScrollInfo({
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
      })
    }

    updateScrollInfo()
    container.addEventListener('scroll', updateScrollInfo)

    // Also update on resize
    const resizeObserver = new ResizeObserver(updateScrollInfo)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', updateScrollInfo)
      resizeObserver.disconnect()
    }
  }, [containerRef])

  // Calculate segments
  const segments = useMemo((): MinimapSegment[] => {
    if (messages.length === 0) return []

    // Calculate total content length
    const totalLength = messages.reduce(
      (sum, msg) => sum + estimateContentLength(msg),
      0
    )

    let currentPercent = 0
    const result: MinimapSegment[] = []

    for (const message of messages) {
      const length = estimateContentLength(message)
      const heightPercent = (length / totalLength) * 100

      result.push({
        id: message.id,
        type: getMessageType(message),
        startPercent: currentPercent,
        heightPercent: Math.max(heightPercent, 1), // Minimum 1%
      })

      currentPercent += heightPercent
    }

    return result
  }, [messages])

  // Calculate viewport indicator
  const viewportInfo = useMemo(() => {
    const { scrollTop, scrollHeight, clientHeight } = scrollInfo
    if (scrollHeight <= clientHeight) {
      return { top: 0, height: 100 }
    }

    const topPercent = (scrollTop / scrollHeight) * 100
    const heightPercent = (clientHeight / scrollHeight) * 100

    return {
      top: topPercent,
      height: Math.max(heightPercent, 5), // Minimum 5%
    }
  }, [scrollInfo])

  // Handle click to scroll
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current
      const minimap = minimapRef.current
      if (!container || !minimap) return

      const rect = minimap.getBoundingClientRect()
      const clickPercent = ((e.clientY - rect.top) / rect.height) * 100

      const targetScroll =
        (clickPercent / 100) * container.scrollHeight -
        container.clientHeight / 2

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      })
    },
    [containerRef]
  )

  // Don't render if no messages or content fits in view
  if (messages.length === 0 || scrollInfo.scrollHeight <= scrollInfo.clientHeight) {
    return null
  }

  return (
    <div
      ref={minimapRef}
      onClick={handleClick}
      className={cn(
        'absolute right-1 top-2 bottom-2 w-2 rounded-full',
        'bg-surface-card/50 cursor-pointer',
        'hover:w-3 transition-all duration-150',
        className
      )}
    >
      {/* Message segments */}
      {segments.map((segment) => (
        <div
          key={segment.id}
          className={cn(
            'absolute left-0 right-0 rounded-full',
            getSegmentColor(segment.type),
            'opacity-60 hover:opacity-100 transition-opacity'
          )}
          style={{
            top: `${String(segment.startPercent)}%`,
            height: `${String(segment.heightPercent)}%`,
          }}
        />
      ))}

      {/* Viewport indicator */}
      <div
        className="absolute left-0 right-0 bg-white/30 border border-white/50 rounded-full pointer-events-none"
        style={{
          top: `${String(viewportInfo.top)}%`,
          height: `${String(viewportInfo.height)}%`,
        }}
      />
    </div>
  )
})
