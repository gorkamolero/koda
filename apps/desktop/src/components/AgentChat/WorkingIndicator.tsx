import { memo, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface WorkingIndicatorProps {
  startTime: number
  className?: string
}

// ============================================================================
// ASCII Spinner Frames (Braille dots animation)
// ============================================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPINNER_INTERVAL = 80 // ms per frame

// Alternative spinners:
// const SPINNER_FRAMES = ['◐', '◓', '◑', '◒']
// const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']
// const SPINNER_FRAMES = ['|', '/', '-', '\\']

// ============================================================================
// WorkingIndicator Component
// ============================================================================

export const WorkingIndicator = memo(function WorkingIndicator({
  startTime,
  className,
}: WorkingIndicatorProps) {
  const [frame, setFrame] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const frameRef = useRef(0)

  // Animate spinner
  useEffect(() => {
    const interval = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % SPINNER_FRAMES.length
      setFrame(frameRef.current)
    }, SPINNER_INTERVAL)

    return () => { clearInterval(interval) }
  }, [])

  // Track elapsed time
  useEffect(() => {
    const updateElapsed = () => {
      setElapsed(Date.now() - startTime)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 100)

    return () => { clearInterval(interval) }
  }, [startTime])

  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${String(seconds)}s`

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${String(minutes)}m ${String(remainingSeconds)}s`
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-sm font-mono',
        'text-text-accent',
        className
      )}
    >
      <span className="text-status-success">{SPINNER_FRAMES[frame]}</span>
      <span>Working...</span>
      <span className="tabular-nums text-text-muted">{formatElapsed(elapsed)}</span>
    </div>
  )
})

// ============================================================================
// Compact variant for inline use
// ============================================================================

interface CompactWorkingIndicatorProps {
  startTime: number
  label?: string
  className?: string
}

export const CompactWorkingIndicator = memo(function CompactWorkingIndicator({
  startTime,
  label = 'Working',
  className,
}: CompactWorkingIndicatorProps) {
  const [frame, setFrame] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const spinnerInterval = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length)
    }, SPINNER_INTERVAL)

    const timeInterval = setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 100)

    return () => {
      clearInterval(spinnerInterval)
      clearInterval(timeInterval)
    }
  }, [startTime])

  const seconds = Math.floor(elapsed / 1000)

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-xs', className)}>
      <span className="text-status-success">{SPINNER_FRAMES[frame]}</span>
      <span className="text-text-muted">{label}</span>
      <span className="text-text-dim tabular-nums">{String(seconds)}s</span>
    </span>
  )
})
