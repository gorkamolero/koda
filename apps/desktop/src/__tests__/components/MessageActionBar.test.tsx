import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { MessageActionBar } from '@/components/AgentChat/MessageActionBar'
import type { ChatMessage } from '@/store/chat'

// Mock the atoms
vi.mock('@/store/chat', async () => {
  const actual = await vi.importActual('@/store/chat')
  return {
    ...actual,
    revertToMessageAtom: { write: vi.fn() },
    splitAtMessageAtom: { write: vi.fn() },
  }
})

describe('MessageActionBar', () => {
  const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'msg-1',
    role: 'assistant',
    content: 'Test message content',
    timestamp: Date.now(),
    ...overrides,
  })

  const renderWithProvider = (ui: React.ReactElement) => {
    const store = createStore()
    return render(
      <Provider store={store}>
        {ui}
      </Provider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render three action buttons', () => {
    const message = createMessage()
    renderWithProvider(<MessageActionBar message={message} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
  })

  it('should render copy button with correct title', () => {
    const message = createMessage()
    renderWithProvider(<MessageActionBar message={message} />)

    expect(screen.getByTitle('Copy message')).toBeInTheDocument()
  })

  it('should render fork button with correct title', () => {
    const message = createMessage()
    renderWithProvider(<MessageActionBar message={message} />)

    expect(screen.getByTitle('Fork conversation from here')).toBeInTheDocument()
  })

  it('should render revert button with correct title', () => {
    const message = createMessage()
    renderWithProvider(<MessageActionBar message={message} />)

    expect(screen.getByTitle('Revert to this message')).toBeInTheDocument()
  })

  it('should copy message content to clipboard on copy click', async () => {
    const message = createMessage({ content: 'Copy this text' })
    renderWithProvider(<MessageActionBar message={message} />)

    const copyButton = screen.getByTitle('Copy message')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(vi.mocked(navigator.clipboard).writeText).toHaveBeenCalledWith('Copy this text')
    })
  })

  it('should show copied state after copying', async () => {
    const message = createMessage()
    renderWithProvider(<MessageActionBar message={message} />)

    const copyButton = screen.getByTitle('Copy message')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByTitle('Copied!')).toBeInTheDocument()
    })
  })

  it('should extract content from content blocks', async () => {
    const message = createMessage({
      content: '',
      contentBlocks: [
        { type: 'text', text: 'Block content here' },
      ],
    })
    renderWithProvider(<MessageActionBar message={message} />)

    const copyButton = screen.getByTitle('Copy message')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(vi.mocked(navigator.clipboard).writeText).toHaveBeenCalledWith('Block content here')
    })
  })

  it('should apply custom className', () => {
    const message = createMessage()
    const { container } = renderWithProvider(
      <MessageActionBar message={message} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should have opacity transition classes for hover reveal', () => {
    const message = createMessage()
    const { container } = renderWithProvider(<MessageActionBar message={message} />)

    expect(container.firstChild).toHaveClass('opacity-0')
    expect(container.firstChild).toHaveClass('group-hover:opacity-100')
  })

  it('should handle message with thinking blocks', async () => {
    const message = createMessage({
      content: '',
      contentBlocks: [
        {
          type: 'thinking',
          content: 'Thinking about the problem...',
          durationMs: 1000,
        },
      ],
    })
    renderWithProvider(<MessageActionBar message={message} />)

    const copyButton = screen.getByTitle('Copy message')
    fireEvent.click(copyButton)

    await waitFor(() => {
      const mockCalls = vi.mocked(navigator.clipboard).writeText.mock.calls
      const clipboardContent = mockCalls[0]?.[0] ?? ''
      expect(clipboardContent).toContain('Thinking')
      expect(clipboardContent).toContain('Thinking about the problem...')
    })
  })

  it('should handle message with tool use blocks', async () => {
    const message = createMessage({
      content: '',
      contentBlocks: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'read_file',
          input: { path: '/src/App.tsx' },
        },
      ],
    })
    renderWithProvider(<MessageActionBar message={message} />)

    const copyButton = screen.getByTitle('Copy message')
    fireEvent.click(copyButton)

    await waitFor(() => {
      const mockCalls = vi.mocked(navigator.clipboard).writeText.mock.calls
      const clipboardContent = mockCalls[0]?.[0] ?? ''
      expect(clipboardContent).toContain('Tool: read_file')
      expect(clipboardContent).toContain('/src/App.tsx')
    })
  })
})
