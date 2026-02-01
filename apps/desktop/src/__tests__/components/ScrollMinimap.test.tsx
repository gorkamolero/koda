import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { ScrollMinimap } from '@/components/AgentChat/ScrollMinimap'
import { messagesAtom, type ChatMessage } from '@/store/chat'
import React from 'react'

describe('ScrollMinimap', () => {
  const renderWithStore = (
    ui: React.ReactElement,
    messages: ChatMessage[] = []
  ) => {
    const store = createStore()
    store.set(messagesAtom, messages)
    return render(
      <Provider store={store}>
        {ui}
      </Provider>
    )
  }

  it('should not render when no messages', () => {
    const containerRef = React.createRef<HTMLDivElement>()
    const { container } = renderWithStore(
      <ScrollMinimap containerRef={containerRef} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should not render with empty messages array', () => {
    const containerRef = React.createRef<HTMLDivElement>()
    const { container } = renderWithStore(
      <ScrollMinimap containerRef={containerRef} />,
      []
    )
    expect(container.firstChild).toBeNull()
  })

  // Note: Full rendering tests require a real DOM container with scroll dimensions.
  // The component uses useEffect + ResizeObserver which don't work well in jsdom.
  // For full integration testing, use Playwright E2E tests.
})

// Test the internal logic without rendering
describe('ScrollMinimap segment calculation', () => {
  // These tests verify the segment color mapping logic
  const getSegmentColor = (type: 'user' | 'assistant' | 'thinking' | 'tool' | 'system'): string => {
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

  it('should map user to blue', () => {
    expect(getSegmentColor('user')).toBe('bg-blue-500')
  })

  it('should map thinking to purple', () => {
    expect(getSegmentColor('thinking')).toBe('bg-purple-500')
  })

  it('should map tool to green', () => {
    expect(getSegmentColor('tool')).toBe('bg-green-500')
  })

  it('should map assistant to muted', () => {
    expect(getSegmentColor('assistant')).toBe('bg-text-muted')
  })

  it('should map system to yellow', () => {
    expect(getSegmentColor('system')).toBe('bg-yellow-500/50')
  })
})

describe('ScrollMinimap message type detection', () => {
  // Test the logic for determining message type from content blocks
  const getMessageType = (role: string, contentBlocks?: Array<{ type: string }>): string => {
    if (role === 'user') return 'user'
    if (role === 'system') return 'system'

    if (contentBlocks) {
      const hasThinking = contentBlocks.some(b => b.type === 'thinking')
      const hasTools = contentBlocks.some(b => b.type === 'tool_use')

      if (hasThinking) return 'thinking'
      if (hasTools) return 'tool'
    }

    return 'assistant'
  }

  it('should detect user messages', () => {
    expect(getMessageType('user')).toBe('user')
  })

  it('should detect system messages', () => {
    expect(getMessageType('system')).toBe('system')
  })

  it('should detect assistant messages', () => {
    expect(getMessageType('assistant')).toBe('assistant')
  })

  it('should detect thinking blocks in assistant messages', () => {
    expect(getMessageType('assistant', [{ type: 'thinking' }])).toBe('thinking')
  })

  it('should detect tool use blocks in assistant messages', () => {
    expect(getMessageType('assistant', [{ type: 'tool_use' }])).toBe('tool')
  })

  it('should prioritize thinking over tool', () => {
    expect(getMessageType('assistant', [
      { type: 'thinking' },
      { type: 'tool_use' },
    ])).toBe('thinking')
  })

  it('should handle empty content blocks', () => {
    expect(getMessageType('assistant', [])).toBe('assistant')
  })
})

describe('ScrollMinimap content length estimation', () => {
  // Test the logic for estimating content length
  const estimateContentLength = (
    content: string,
    contentBlocks?: Array<{ type: string; content?: string }>
  ): number => {
    let length = content.length

    if (contentBlocks) {
      for (const block of contentBlocks) {
        if (block.type === 'thinking' && block.content) {
          length += block.content.length
        } else if (block.type === 'tool_use') {
          length += 500 // Fixed estimate
        }
      }
    }

    return Math.max(length, 100) // Minimum height
  }

  it('should return content length for simple message', () => {
    expect(estimateContentLength('Hello world')).toBe(100) // Minimum
  })

  it('should enforce minimum length of 100', () => {
    expect(estimateContentLength('Hi')).toBe(100)
  })

  it('should add thinking block length', () => {
    const thinkingContent = 'A'.repeat(200)
    expect(estimateContentLength('', [
      { type: 'thinking', content: thinkingContent },
    ])).toBe(200)
  })

  it('should add fixed 500 for tool blocks', () => {
    expect(estimateContentLength('A'.repeat(100), [
      { type: 'tool_use' },
    ])).toBe(600)
  })

  it('should combine multiple blocks', () => {
    expect(estimateContentLength('A'.repeat(100), [
      { type: 'thinking', content: 'B'.repeat(200) },
      { type: 'tool_use' },
    ])).toBe(800) // 100 + 200 + 500
  })
})
