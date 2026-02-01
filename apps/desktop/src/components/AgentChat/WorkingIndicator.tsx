import { memo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface WorkingIndicatorProps {
  startTime: number
  className?: string
}

// ============================================================================
// KODA Animation Constants
// ============================================================================

const KODA_LETTERS = ['K', 'O', 'D', 'A']
const LETTER_INTERVAL = 150 // ms per letter

// ============================================================================
// WorkingIndicator Component
// ============================================================================

export const WorkingIndicator = memo(function WorkingIndicator({
  startTime,
  className,
}: WorkingIndicatorProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  // Animate KODA letters
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(i => (i + 1) % (KODA_LETTERS.length + 1))
    }, LETTER_INTERVAL)

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
    const totalSeconds = ms / 1000
    if (totalSeconds < 60) {
      // Show one decimal place for sub-minute durations
      return `${totalSeconds.toFixed(1)}s`
    }

    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = Math.floor(totalSeconds % 60)
    return `${String(minutes)}m, ${String(remainingSeconds)}s`
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-sm font-mono',
        'text-text-accent',
        className
      )}
    >
      <span className="inline-flex">
        {KODA_LETTERS.map((letter, i) => (
          <span
            key={letter}
            className={cn(
              'transition-all duration-100',
              i === activeIndex
                ? 'text-text-accent scale-110 font-bold'
                : i < activeIndex
                  ? 'text-status-success'
                  : 'text-text-dim'
            )}
          >
            {letter}
          </span>
        ))}
      </span>
      <span className="text-text-muted">working</span>
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
  const [activeIndex, setActiveIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const letterInterval = setInterval(() => {
      setActiveIndex(i => (i + 1) % (KODA_LETTERS.length + 1))
    }, LETTER_INTERVAL)

    const timeInterval = setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 100)

    return () => {
      clearInterval(letterInterval)
      clearInterval(timeInterval)
    }
  }, [startTime])

  const formatElapsed = (ms: number): string => {
    const totalSeconds = ms / 1000
    if (totalSeconds < 60) {
      return `${totalSeconds.toFixed(1)}s`
    }
    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = Math.floor(totalSeconds % 60)
    return `${String(minutes)}m, ${String(remainingSeconds)}s`
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-xs', className)}>
      <span className="inline-flex">
        {KODA_LETTERS.map((letter, i) => (
          <span
            key={letter}
            className={cn(
              'transition-all duration-75',
              i === activeIndex
                ? 'text-text-accent font-bold'
                : i < activeIndex
                  ? 'text-status-success'
                  : 'text-text-dim'
            )}
          >
            {letter}
          </span>
        ))}
      </span>
      <span className="text-text-muted">{label}</span>
      <span className="text-text-dim tabular-nums">{formatElapsed(elapsed)}</span>
    </span>
  )
})
