import { describe, it, expect } from 'vitest'
import { extractMessageContent, getMessagePreview } from '@/lib/messageContent'
import type { ChatMessage } from '@/store/chat'

const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'test-1',
  role: 'assistant',
  content: '',
  timestamp: Date.now(),
  ...overrides,
})

describe('extractMessageContent', () => {
  it('should return raw content when no content blocks', () => {
    const message = createMessage({ content: 'Hello world' })
    expect(extractMessageContent(message)).toBe('Hello world')
  })

  it('should return raw content for empty content blocks', () => {
    const message = createMessage({
      content: 'Fallback content',
      contentBlocks: [],
    })
    expect(extractMessageContent(message)).toBe('Fallback content')
  })

  it('should format text blocks', () => {
    const message = createMessage({
      contentBlocks: [
        { type: 'text', text: 'First paragraph' },
        { type: 'text', text: 'Second paragraph' },
      ],
    })
    const result = extractMessageContent(message)
    expect(result).toContain('First paragraph')
    expect(result).toContain('Second paragraph')
  })

  it('should format thinking blocks with collapsible details', () => {
    const message = createMessage({
      contentBlocks: [
        {
          type: 'thinking',
          content: 'Let me think about this...',
          durationMs: 1500,
        },
      ],
    })
    const result = extractMessageContent(message)
    expect(result).toContain('<details>')
    expect(result).toContain('<summary>Thinking (1.5s)</summary>')
    expect(result).toContain('Let me think about this...')
    expect(result).toContain('</details>')
  })

  it('should format tool_use blocks as markdown', () => {
    const message = createMessage({
      contentBlocks: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'read_file',
          input: { path: '/src/App.tsx' },
        },
      ],
    })
    const result = extractMessageContent(message)
    expect(result).toContain('### Tool: read_file')
    expect(result).toContain('```json')
    expect(result).toContain('/src/App.tsx')
  })

  it('should format tool_result blocks', () => {
    const message = createMessage({
      contentBlocks: [
        {
          type: 'tool_result',
          id: 'tool-1',
          output: 'File content here',
        },
      ],
    })
    const result = extractMessageContent(message)
    expect(result).toBe('File content here')
  })

  it('should format tool_result errors', () => {
    const message = createMessage({
      contentBlocks: [
        {
          type: 'tool_result',
          id: 'tool-1',
          error: 'File not found',
        },
      ],
    })
    const result = extractMessageContent(message)
    expect(result).toContain('**Error:** File not found')
  })

  it('should handle mixed content blocks', () => {
    const message = createMessage({
      contentBlocks: [
        { type: 'text', text: 'Let me help you with that.' },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'bash',
          input: { command: 'ls -la' },
        },
        { type: 'text', text: 'Here are the results.' },
      ],
    })
    const result = extractMessageContent(message)
    expect(result).toContain('Let me help you with that.')
    expect(result).toContain('### Tool: bash')
    expect(result).toContain('Here are the results.')
  })

  it('should handle thinking with unknown duration', () => {
    const message = createMessage({
      contentBlocks: [
        {
          type: 'thinking',
          content: 'Thinking...',
          durationMs: undefined,
        },
      ],
    })
    const result = extractMessageContent(message)
    expect(result).toContain('Thinking (unknown)')
  })

  it('should handle short durations in ms', () => {
    const message = createMessage({
      contentBlocks: [
        {
          type: 'thinking',
          content: 'Quick thought',
          durationMs: 500,
        },
      ],
    })
    const result = extractMessageContent(message)
    expect(result).toContain('Thinking (500ms)')
  })
})

describe('getMessagePreview', () => {
  it('should return full content if under max length', () => {
    const message = createMessage({ content: 'Short message' })
    expect(getMessagePreview(message)).toBe('Short message')
  })

  it('should truncate long content', () => {
    const longContent = 'A'.repeat(200)
    const message = createMessage({ content: longContent })
    const result = getMessagePreview(message, 100)
    expect(result.length).toBeLessThanOrEqual(103) // 100 + '...'
    expect(result.endsWith('...')).toBe(true)
  })

  it('should use default max length of 100', () => {
    const longContent = 'B'.repeat(150)
    const message = createMessage({ content: longContent })
    const result = getMessagePreview(message)
    expect(result.length).toBeLessThanOrEqual(103)
  })

  it('should extract from content blocks if no direct content', () => {
    const message = createMessage({
      content: '',
      contentBlocks: [{ type: 'text', text: 'From content blocks' }],
    })
    const result = getMessagePreview(message)
    expect(result).toBe('From content blocks')
  })

  it('should prefer direct content over content blocks', () => {
    const message = createMessage({
      content: 'Direct content',
      contentBlocks: [{ type: 'text', text: 'Block content' }],
    })
    const result = getMessagePreview(message)
    expect(result).toBe('Direct content')
  })
})
