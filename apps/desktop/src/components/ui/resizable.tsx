/**
 * Resizable Panel Components
 *
 * A simple resizable panel system similar to react-resizable-panels
 * but using CSS and the existing useResizable hook.
 */

import { createContext, useContext, type ReactNode, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Context
// ============================================================================

interface PanelGroupContextValue {
  direction: 'horizontal' | 'vertical'
}

const PanelGroupContext = createContext<PanelGroupContextValue>({ direction: 'horizontal' })

// ============================================================================
// PanelGroup
// ============================================================================

interface PanelGroupProps {
  direction: 'horizontal' | 'vertical'
  children: ReactNode
  className?: string
  style?: CSSProperties
  'data-testid'?: string
}

export function PanelGroup({
  direction,
  children,
  className,
  style,
  'data-testid': testId,
}: PanelGroupProps) {
  return (
    <PanelGroupContext.Provider value={{ direction }}>
      <div
        data-testid={testId}
        className={cn(
          'flex',
          direction === 'horizontal' ? 'flex-row' : 'flex-col',
          'h-full w-full overflow-hidden',
          className
        )}
        style={style}
      >
        {children}
      </div>
    </PanelGroupContext.Provider>
  )
}

// ============================================================================
// Panel
// ============================================================================

interface PanelProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  defaultSize?: number
  minSize?: number
  maxSize?: number
  'data-testid'?: string
}

export function Panel({
  children,
  className,
  style,
  defaultSize,
  'data-testid': testId,
}: PanelProps) {
  const flexStyle: CSSProperties = defaultSize
    ? { flex: `${defaultSize} 1 0%`, ...style }
    : { flex: '1 1 0%', ...style }

  return (
    <div
      data-testid={testId}
      data-panel="true"
      className={cn('overflow-hidden', className)}
      style={flexStyle}
    >
      {children}
    </div>
  )
}

// ============================================================================
// PanelResizeHandle
// ============================================================================

interface PanelResizeHandleProps {
  className?: string
  onDragging?: (isDragging: boolean) => void
  hitAreaMargins?: { coarse: number; fine: number }
}

export function PanelResizeHandle({
  className,
}: PanelResizeHandleProps) {
  const { direction } = useContext(PanelGroupContext)

  return (
    <div
      data-resize-handle="true"
      className={cn(
        'relative shrink-0',
        direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
        'bg-border hover:bg-border-accent transition-colors',
        'before:absolute before:inset-0',
        direction === 'horizontal'
          ? 'before:-left-1 before:-right-1'
          : 'before:-top-1 before:-bottom-1',
        className
      )}
    />
  )
}
