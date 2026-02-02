import { memo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface WorkingIndicatorProps {
  startTime: number
  className?: string
}

const KODA_LETTERS = ['K', 'O', 'D', 'A']
const LETTER_INTERVAL = 150

export const WorkingIndicator = memo(function WorkingIndicator({
  startTime,
  className,
}: WorkingIndicatorProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(i => (i + 1) % (KODA_LETTERS.length + 1))
    }, LETTER_INTERVAL)

    return () => { clearInterval(interval) }
  }, [])

  useEffect(() => {
    const updateElapsed = () => {
      setElapsed(Date.now() - startTime)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 100)

    return () => { clearInterval(interval) }
  }, [startTime])

  const formatElapsed = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    if (totalSeconds < 60) {
      return `${totalSeconds}s`
    }
    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = Math.floor(totalSeconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className={cn('inline-flex items-center gap-2 font-mono', className)}>
      <span className="text-text-faint">[</span>
      <span className="inline-flex">
        {KODA_LETTERS.map((letter, i) => (
          <span
            key={letter}
            className={cn(
              'transition-all duration-100',
              i === activeIndex
                ? 'text-text-accent'
                : i < activeIndex
                  ? 'text-[--git-green]'
                  : 'text-text-faint'
            )}
          >
            {letter}
          </span>
        ))}
      </span>
      <span className="text-text-faint">]</span>
      <span className="text-text-muted">working</span>
      <span className="tabular-nums text-text-faint">{formatElapsed(elapsed)}</span>
    </div>
  )
})

interface CompactWorkingIndicatorProps {
  startTime: number
  label?: string
  className?: string
}

export const CompactWorkingIndicator = memo(function CompactWorkingIndicator({
  startTime,
  label = 'working',
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
    const totalSeconds = Math.floor(ms / 1000)
    if (totalSeconds < 60) {
      return `${totalSeconds}s`
    }
    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = Math.floor(totalSeconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <span className={cn('inline-flex items-center gap-1 font-mono text-xs', className)}>
      <span className="text-text-faint">[</span>
      <span className="inline-flex">
        {KODA_LETTERS.map((letter, i) => (
          <span
            key={letter}
            className={cn(
              'transition-all duration-75',
              i === activeIndex
                ? 'text-text-accent'
                : i < activeIndex
                  ? 'text-[--git-green]'
                  : 'text-text-faint'
            )}
          >
            {letter}
          </span>
        ))}
      </span>
      <span className="text-text-faint">]</span>
      <span className="text-text-muted">{label}</span>
      <span className="text-text-faint tabular-nums">{formatElapsed(elapsed)}</span>
    </span>
  )
})
