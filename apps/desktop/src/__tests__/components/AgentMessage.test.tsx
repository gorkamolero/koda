import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageItem } from '@/components/AgentChat/MessageItem'

describe('agent messages with tool events', () => {
  it('keeps streamed assistant text visible alongside completed tools', () => {
    render(<MessageItem turnIndex={1} message={{
      id: 'assistant-1', role: 'assistant', model: 'codex', timestamp: 1000,
      status: 'streaming', content: 'The isolated worktree is ready.',
      contentBlocks: [
        { type: 'tool_use', id: 'command-1', name: 'command_execution', input: { command: 'git status' }, status: 'success' },
        { type: 'tool_result', toolUseId: 'command-1', toolName: 'command_execution', output: 'Clean' },
      ],
    }} />)
    expect(screen.getByText('The isolated worktree is ready.')).toBeVisible()
    expect(screen.getByTestId('message-assistant-1')).toHaveAttribute('data-message-status', 'streaming')
  })
})
