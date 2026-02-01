import { memo, useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// KODA ASCII Art Definitions
// ============================================================================

// Compact KODA letters using box-drawing characters
// Reserved for future use in compact ASCII displays
// const KODA_COMPACT = {
//   K: ['╻ ╻', '╠╸ ', '╹ ╹'],
//   O: ['╭─╮', '│ │', '╰─╯'],
//   D: ['┌─╮', '│ │', '└─╯'],
//   A: ['╭─╮', '├─┤', '╵ ╵'],
// }

/**
 * Large ASCII art KODA logo
 * Block-style letters for splash screens and loading
 */
const KODA_LARGE = `
██╗  ██╗ ██████╗ ██████╗  █████╗
██║ ██╔╝██╔═══██╗██╔══██╗██╔══██╗
█████╔╝ ██║   ██║██║  ██║███████║
██╔═██╗ ██║   ██║██║  ██║██╔══██║
██║  ██╗╚██████╔╝██████╔╝██║  ██║
╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝
`.trim()

/**
 * Minimal KODA for very compact spaces
 */
const KODA_MINIMAL = 'K·O·D·A'

// KODA using braille patterns for a unique look
// Reserved for future braille animation mode
// const KODA_BRAILLE = {
//   frames: [
//     '⣿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',  // Full
//     '⣷⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',  // K animating
//     '⣯⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',
//     '⣟⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',
//     '⡿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',
//     '⣿⡇⡇⣷⣿⣷⡇⣿⡇⡇⣿⣿⡇',  // O animating
//     '⣿⡇⡇⣯⣿⣯⡇⣿⡇⡇⣿⣿⡇',
//     '⣿⡇⡇⣟⣿⣟⡇⣿⡇⡇⣿⣿⡇',
//     '⣿⡇⡇⣿⣿⣿⡇⣷⡇⡇⣿⣿⡇',  // D animating
//     '⣿⡇⡇⣿⣿⣿⡇⣯⡇⡇⣿⣿⡇',
//     '⣿⡇⡇⣿⣿⣿⡇⣟⡇⡇⣿⣿⡇',
//     '⣿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣷⣿⣷',  // A animating
//     '⣿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣯⣿⣯',
//     '⣿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣟⣿⣟',
//   ]
// }

// ============================================================================
// Animation Types
// ============================================================================

type AnimationStyle = 'wave' | 'pulse' | 'matrix' | 'scan' | 'bounce'

// ============================================================================
// KodaWaveSpinner - Letters light up in sequence
// ============================================================================

interface KodaWaveSpinnerProps {
  className?: string
  speed?: number
  showLabel?: boolean
  label?: string
}

export const KodaWaveSpinner = memo(function KodaWaveSpinner({
  className,
  speed = 150,
  showLabel = true,
  label = 'Loading',
}: KodaWaveSpinnerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const letters = ['K', 'O', 'D', 'A']

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(i => (i + 1) % (letters.length + 1))
    }, speed)
    return () => { clearInterval(interval) }
  }, [speed, letters.length])

  return (
    <div className={cn('inline-flex items-center gap-2 font-mono', className)}>
      <span className="inline-flex">
        {letters.map((letter, i) => (
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
      {showLabel && <span className="text-text-muted text-xs">{label}</span>}
    </div>
  )
})

// ============================================================================
// KodaScanSpinner - Scanning line effect through KODA
// ============================================================================

interface KodaScanSpinnerProps {
  className?: string
  speed?: number
}

export const KodaScanSpinner = memo(function KodaScanSpinner({
  className,
  speed = 120,
}: KodaScanSpinnerProps) {
  const [scanPos, setScanPos] = useState(0)
  const letters = ['K', 'O', 'D', 'A']

  useEffect(() => {
    const interval = setInterval(() => {
      setScanPos(p => (p + 1) % 8) // 4 letters + 4 gaps for smooth loop
    }, speed)
    return () => { clearInterval(interval) }
  }, [speed])

  return (
    <div className={cn('inline-flex font-mono font-bold tracking-wider', className)}>
      {letters.map((letter, i) => {
        const distance = Math.abs(scanPos - i * 2)
        const brightness = distance === 0 ? 1 : distance === 1 ? 0.7 : distance === 2 ? 0.4 : 0.2
        return (
          <span
            key={letter}
            className="transition-all duration-75"
            style={{
              opacity: brightness,
              textShadow: brightness > 0.5 ? '0 0 8px currentColor' : 'none',
              color: brightness > 0.5 ? 'var(--text-accent)' : 'var(--text-dim)',
            }}
          >
            {letter}
          </span>
        )
      })}
    </div>
  )
})

// ============================================================================
// KodaPulseSpinner - KODA with heartbeat effect
// ============================================================================

interface KodaPulseSpinnerProps {
  className?: string
  speed?: number
}

export const KodaPulseSpinner = memo(function KodaPulseSpinner({
  className,
  speed = 1200,
}: KodaPulseSpinnerProps) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true)
      setTimeout(() => { setPulse(false) }, speed / 3)
    }, speed)
    return () => { clearInterval(interval) }
  }, [speed])

  return (
    <span
      className={cn(
        'inline-flex font-mono font-bold tracking-widest transition-all',
        pulse ? 'scale-105 text-text-accent' : 'scale-100 text-text-muted',
        className
      )}
      style={{
        textShadow: pulse ? '0 0 12px currentColor' : 'none',
      }}
    >
      KODA
    </span>
  )
})

// ============================================================================
// KodaMatrixSpinner - Matrix-style character rain resolving to KODA
// ============================================================================

const MATRIX_CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ'

interface KodaMatrixSpinnerProps {
  className?: string
  speed?: number
}

export const KodaMatrixSpinner = memo(function KodaMatrixSpinner({
  className,
  speed = 80,
}: KodaMatrixSpinnerProps) {
  const [frame, setFrame] = useState(0)
  const targetWord = 'KODA'

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 40)
    }, speed)
    return () => { clearInterval(interval) }
  }, [speed])

  const displayChars = useMemo(() => {
    return targetWord.split('').map((target, i) => {
      const resolveFrame = 20 + i * 5
      if (frame >= resolveFrame) {
        return target
      }
      return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
    })
  }, [frame])

  return (
    <span className={cn('inline-flex font-mono font-bold tracking-wider', className)}>
      {displayChars.map((char, i) => (
        <span
          key={i}
          className={cn(
            'transition-colors duration-150',
            char === targetWord[i] ? 'text-status-success' : 'text-text-accent'
          )}
        >
          {char}
        </span>
      ))}
    </span>
  )
})

// ============================================================================
// KodaBounceSpinner - Letters bounce in sequence
// ============================================================================

interface KodaBounceSpinnerProps {
  className?: string
  speed?: number
}

export const KodaBounceSpinner = memo(function KodaBounceSpinner({
  className,
  speed = 200,
}: KodaBounceSpinnerProps) {
  const [bounceIndex, setBounceIndex] = useState(0)
  const letters = ['K', 'O', 'D', 'A']

  useEffect(() => {
    const interval = setInterval(() => {
      setBounceIndex(i => (i + 1) % letters.length)
    }, speed)
    return () => { clearInterval(interval) }
  }, [speed, letters.length])

  return (
    <span className={cn('inline-flex font-mono font-bold tracking-wider', className)}>
      {letters.map((letter, i) => (
        <span
          key={letter}
          className={cn(
            'inline-block transition-transform duration-150',
            i === bounceIndex ? '-translate-y-1' : 'translate-y-0'
          )}
          style={{
            color: i === bounceIndex ? 'var(--text-accent)' : 'var(--text-muted)',
          }}
        >
          {letter}
        </span>
      ))}
    </span>
  )
})

// ============================================================================
// KodaAsciiLogo - Full ASCII art logo for splash screens
// ============================================================================

interface KodaAsciiLogoProps {
  className?: string
  animated?: boolean
  size?: 'small' | 'medium' | 'large'
}

export const KodaAsciiLogo = memo(function KodaAsciiLogo({
  className,
  animated = true,
  size = 'large',
}: KodaAsciiLogoProps) {
  const [scanLine, setScanLine] = useState(0)
  const lines = KODA_LARGE.split('\n')

  useEffect(() => {
    if (!animated) return
    const interval = setInterval(() => {
      setScanLine(l => (l + 1) % (lines.length + 3))
    }, 100)
    return () => { clearInterval(interval) }
  }, [animated, lines.length])

  const fontSize = size === 'large' ? 'text-xs' : size === 'medium' ? 'text-[10px]' : 'text-[8px]'

  return (
    <pre className={cn('font-mono leading-tight', fontSize, className)}>
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'transition-all duration-100',
            animated && i === scanLine
              ? 'text-text-accent'
              : animated && Math.abs(i - scanLine) === 1
                ? 'text-status-success'
                : 'text-text-muted'
          )}
          style={{
            textShadow: animated && i === scanLine ? '0 0 8px currentColor' : 'none',
          }}
        >
          {line}
        </div>
      ))}
    </pre>
  )
})

// ============================================================================
// KodaLoadingScreen - Full loading screen with ASCII art
// ============================================================================

interface KodaLoadingScreenProps {
  message?: string
  progress?: number
  className?: string
}

export const KodaLoadingScreen = memo(function KodaLoadingScreen({
  message = 'Initializing...',
  progress,
  className,
}: KodaLoadingScreenProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 400)
    return () => { clearInterval(interval) }
  }, [])

  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-6 p-8',
      'bg-surface-messages min-h-[300px]',
      className
    )}>
      <KodaAsciiLogo animated />

      <div className="flex flex-col items-center gap-2">
        <span className="text-text-muted font-mono text-sm">
          {message}{dots}
        </span>

        {progress !== undefined && (
          <div className="w-48 h-1 bg-surface-card rounded-full overflow-hidden">
            <div
              className="h-full bg-status-success transition-all duration-300"
              style={{ width: `${String(progress)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
})

// ============================================================================
// KodaSpinner - Main unified spinner with style variants
// ============================================================================

interface KodaSpinnerProps {
  style?: AnimationStyle
  className?: string
  speed?: number
  showLabel?: boolean
  label?: string
}

export const KodaSpinner = memo(function KodaSpinner({
  style = 'wave',
  className,
  speed,
  showLabel,
  label,
}: KodaSpinnerProps) {
  switch (style) {
    case 'wave':
      return <KodaWaveSpinner className={className} speed={speed} showLabel={showLabel} label={label} />
    case 'pulse':
      return <KodaPulseSpinner className={className} speed={speed} />
    case 'matrix':
      return <KodaMatrixSpinner className={className} speed={speed} />
    case 'scan':
      return <KodaScanSpinner className={className} speed={speed} />
    case 'bounce':
      return <KodaBounceSpinner className={className} speed={speed} />
    default:
      return <KodaWaveSpinner className={className} speed={speed} showLabel={showLabel} label={label} />
  }
})

// ============================================================================
// Convenience exports
// ============================================================================

export { KODA_LARGE, KODA_MINIMAL }
export type { AnimationStyle }
