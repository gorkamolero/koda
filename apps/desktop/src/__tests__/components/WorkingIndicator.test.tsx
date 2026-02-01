import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { WorkingIndicator, CompactWorkingIndicator } from '@/components/AgentChat/WorkingIndicator'

describe('WorkingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render with spinner', () => {
    const startTime = Date.now()
    render(<WorkingIndicator startTime={startTime} />)

    // Should show "Working..." text
    expect(screen.getByText('Working...')).toBeInTheDocument()
  })

  it('should show elapsed time', () => {
    const startTime = Date.now() - 5000 // 5 seconds ago
    render(<WorkingIndicator startTime={startTime} />)

    // Should show elapsed time (5s)
    expect(screen.getByText('5s')).toBeInTheDocument()
  })

  it('should format time in minutes when over 60s', () => {
    const startTime = Date.now() - 75000 // 75 seconds ago
    render(<WorkingIndicator startTime={startTime} />)

    // Should show as "1m 15s"
    expect(screen.getByText('1m 15s')).toBeInTheDocument()
  })

  it('should update elapsed time over time', () => {
    const startTime = Date.now()
    render(<WorkingIndicator startTime={startTime} />)

    // Initial: 0s
    expect(screen.getByText('0s')).toBeInTheDocument()

    // Advance time by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3100) // Slightly over 3s to ensure update
    })

    expect(screen.getByText('3s')).toBeInTheDocument()
  })

  it('should animate spinner frames', () => {
    const startTime = Date.now()
    const { container } = render(<WorkingIndicator startTime={startTime} />)

    const spinner = container.querySelector('.text-status-success')

    // Advance time to trigger frame change (80ms per frame)
    act(() => {
      vi.advanceTimersByTime(160)
    })

    // Spinner element should exist
    expect(spinner).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const startTime = Date.now()
    const { container } = render(
      <WorkingIndicator startTime={startTime} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should have monospace font', () => {
    const startTime = Date.now()
    const { container } = render(<WorkingIndicator startTime={startTime} />)

    expect(container.firstChild).toHaveClass('font-mono')
  })

  it('should use braille spinner characters', () => {
    const startTime = Date.now()
    const { container } = render(<WorkingIndicator startTime={startTime} />)

    const spinner = container.querySelector('.text-status-success')
    const spinnerText = spinner?.textContent ?? ''

    // Should be one of the braille characters
    const brailleChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    expect(brailleChars).toContain(spinnerText)
  })
})

describe('CompactWorkingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render with default label', () => {
    const startTime = Date.now()
    render(<CompactWorkingIndicator startTime={startTime} />)

    expect(screen.getByText('Working')).toBeInTheDocument()
  })

  it('should accept custom label', () => {
    const startTime = Date.now()
    render(<CompactWorkingIndicator startTime={startTime} label="Processing" />)

    expect(screen.getByText('Processing')).toBeInTheDocument()
  })

  it('should show elapsed seconds after time passes', () => {
    const startTime = Date.now()
    render(<CompactWorkingIndicator startTime={startTime} />)

    // Start at 0s
    expect(screen.getByText('0s')).toBeInTheDocument()

    // Advance time by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10100)
    })

    expect(screen.getByText('10s')).toBeInTheDocument()
  })

  it('should be smaller than main indicator', () => {
    const startTime = Date.now()
    const { container } = render(<CompactWorkingIndicator startTime={startTime} />)

    expect(container.firstChild).toHaveClass('text-xs')
  })

  it('should apply custom className', () => {
    const startTime = Date.now()
    const { container } = render(
      <CompactWorkingIndicator startTime={startTime} className="my-compact" />
    )

    expect(container.firstChild).toHaveClass('my-compact')
  })

  it('should update time display', () => {
    const startTime = Date.now()
    render(<CompactWorkingIndicator startTime={startTime} />)

    expect(screen.getByText('0s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5100)
    })

    expect(screen.getByText('5s')).toBeInTheDocument()
  })
})
