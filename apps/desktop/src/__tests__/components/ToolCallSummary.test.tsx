import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolCallSummary } from '@/components/AgentChat/ToolCallSummary'
import type { ContentBlock } from '@/store/chat'

describe('ToolCallSummary', () => {
  const createToolUse = (
    id: string,
    name: string,
    overrides: Partial<ContentBlock> = {}
  ): ContentBlock => ({
    type: 'tool_use',
    id,
    name,
    input: {},
    ...overrides,
  } as ContentBlock)

  const createToolResult = (
    id: string,
    toolUseId: string,
    overrides: Partial<ContentBlock> = {}
  ): ContentBlock => ({
    type: 'tool_result',
    id,
    toolUseId,
    output: 'result',
    ...overrides,
  } as ContentBlock)

  it('should not render when no tool calls', () => {
    const { container } = render(
      <ToolCallSummary contentBlocks={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should not render for text-only blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Hello world' },
    ]
    const { container } = render(
      <ToolCallSummary contentBlocks={blocks} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render summary for single tool call', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file'),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    expect(screen.getByText('[TOOLS:1]')).toBeInTheDocument()
  })

  it('should render count for multiple tool calls', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file'),
      createToolUse('tool-2', 'write_file'),
      createToolUse('tool-3', 'bash'),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    expect(screen.getByText('[TOOLS:3]')).toBeInTheDocument()
  })

  it('should show completed count', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file'),
      createToolResult('result-1', 'tool-1'),
      createToolUse('tool-2', 'write_file'),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    expect(screen.getByText(/1✓/)).toBeInTheDocument()
  })

  it('should show running count', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file', { status: 'running' }),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    expect(screen.getByText(/1◉/)).toBeInTheDocument()
  })

  it('should show error count', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file'),
      createToolResult('result-1', 'tool-1', { isError: true, error: 'File not found' }),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    expect(screen.getByText(/1✗/)).toBeInTheDocument()
  })

  it('should expand on click', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file'),
      createToolUse('tool-2', 'bash'),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    // Tool names should not be visible initially
    expect(screen.queryByText('read_file')).not.toBeInTheDocument()
    expect(screen.queryByText('bash')).not.toBeInTheDocument()

    // Click to expand
    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Tool names should now be visible
    expect(screen.getByText('read_file')).toBeInTheDocument()
    expect(screen.getByText('bash')).toBeInTheDocument()
  })

  it('should collapse when expanded and clicked again', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file'),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    const button = screen.getByRole('button')

    // Expand
    fireEvent.click(button)
    expect(screen.getByText('read_file')).toBeInTheDocument()

    // Collapse
    fireEvent.click(button)
    expect(screen.queryByText('read_file')).not.toBeInTheDocument()
  })

  it('should show duration when expanded', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file', { durationMs: 1500 }),
      createToolResult('result-1', 'tool-1'),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    // Expand
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('1.5s')).toBeInTheDocument()
  })

  it('should show ms for short durations', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file', { durationMs: 150 }),
      createToolResult('result-1', 'tool-1'),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    // Expand
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('150ms')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const blocks: ContentBlock[] = [
      createToolUse('tool-1', 'read_file'),
    ]
    const { container } = render(
      <ToolCallSummary contentBlocks={blocks} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should handle mixed status correctly', () => {
    const blocks: ContentBlock[] = [
      // Completed
      createToolUse('tool-1', 'read_file'),
      createToolResult('result-1', 'tool-1'),
      // Running
      createToolUse('tool-2', 'bash', { status: 'running' }),
      // Error
      createToolUse('tool-3', 'write_file'),
      createToolResult('result-3', 'tool-3', { isError: true }),
    ]
    render(<ToolCallSummary contentBlocks={blocks} />)

    const summary = screen.getByRole('button')
    expect(summary.textContent).toContain('1✓')
    expect(summary.textContent).toContain('1◉')
    expect(summary.textContent).toContain('1✗')
  })
})
