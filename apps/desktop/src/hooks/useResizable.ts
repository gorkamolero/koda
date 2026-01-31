import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Configuration for a resizable panel.
 */
export interface ResizableConfig {
  /** CSS variable to update (e.g., '--sidebar-width') */
  cssVar: string
  /** Initial size in pixels */
  initialSize: number
  /** Minimum size in pixels */
  minSize: number
  /** Maximum size in pixels */
  maxSize: number
  /** Direction: 'horizontal' resizes width, 'vertical' resizes height */
  direction: 'horizontal' | 'vertical'
  /** Storage key for persistence (optional) */
  storageKey?: string
  /** Whether to resize from the start (left/top) or end (right/bottom) */
  edge?: 'start' | 'end'
}

/**
 * Return value from useResizable hook.
 */
export interface ResizableState {
  /** Current size in pixels */
  size: number
  /** Set size programmatically */
  setSize: (size: number) => void
  /** Reset to initial size */
  reset: () => void
  /** Whether currently being dragged */
  isDragging: boolean
  /** Props to spread on the resize handle element */
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void
    onTouchStart: (e: React.TouchEvent) => void
    style: React.CSSProperties
    'data-resizing': boolean
  }
}

/**
 * Hook for creating resizable panels with drag handles.
 *
 * @example
 * const sidebar = useResizable({
 *   cssVar: '--sidebar-width',
 *   initialSize: 280,
 *   minSize: 200,
 *   maxSize: 400,
 *   direction: 'horizontal',
 *   storageKey: 'sidebar-width',
 * })
 *
 * // In JSX:
 * <div className="resizer" {...sidebar.handleProps} />
 */
export function useResizable(config: ResizableConfig): ResizableState {
  const {
    cssVar,
    initialSize,
    minSize,
    maxSize,
    direction,
    storageKey,
    edge = 'end',
  } = config

  // Load persisted size or use initial
  const getInitialSize = useCallback(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed = parseInt(stored, 10)
          if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
            return parsed
          }
        }
      } catch {
        // Ignore storage errors
      }
    }
    return initialSize
  }, [storageKey, initialSize, minSize, maxSize])

  const [size, setSizeState] = useState(getInitialSize)
  const [isDragging, setIsDragging] = useState(false)

  // Refs for tracking drag state
  const startPosRef = useRef(0)
  const startSizeRef = useRef(0)

  // Update CSS variable when size changes
  useEffect(() => {
    document.documentElement.style.setProperty(cssVar, `${size}px`)
  }, [cssVar, size])

  // Persist size to storage
  useEffect(() => {
    if (storageKey && !isDragging) {
      try {
        localStorage.setItem(storageKey, size.toString())
      } catch {
        // Ignore storage errors
      }
    }
  }, [storageKey, size, isDragging])

  // Clamp size to min/max
  const clampSize = useCallback(
    (value: number) => Math.min(maxSize, Math.max(minSize, value)),
    [minSize, maxSize]
  )

  // Set size with clamping
  const setSize = useCallback(
    (newSize: number) => {
      setSizeState(clampSize(newSize))
    },
    [clampSize]
  )

  // Reset to initial size
  const reset = useCallback(() => {
    setSizeState(initialSize)
  }, [initialSize])

  // Handle mouse/touch move during drag
  const handleMove = useCallback(
    (clientPos: number) => {
      const delta = clientPos - startPosRef.current
      const multiplier = edge === 'start' ? -1 : 1
      const newSize = startSizeRef.current + delta * multiplier
      setSizeState(clampSize(newSize))
    },
    [clampSize, edge]
  )

  // Start dragging
  const startDrag = useCallback(
    (clientPos: number) => {
      startPosRef.current = clientPos
      startSizeRef.current = size
      setIsDragging(true)

      // Add body class to prevent text selection
      document.body.style.userSelect = 'none'
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    },
    [size, direction]
  )

  // Stop dragging
  const stopDrag = useCallback(() => {
    setIsDragging(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  // Mouse event handlers
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const clientPos = direction === 'horizontal' ? e.clientX : e.clientY
      handleMove(clientPos)
    }

    const handleMouseUp = () => {
      stopDrag()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, direction, handleMove, stopDrag])

  // Touch event handlers
  useEffect(() => {
    if (!isDragging) return

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) {
        const clientPos = direction === 'horizontal' ? touch.clientX : touch.clientY
        handleMove(clientPos)
      }
    }

    const handleTouchEnd = () => {
      stopDrag()
    }

    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, direction, handleMove, stopDrag])

  // Handle props for the resize handle element
  const handleProps = {
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      const clientPos = direction === 'horizontal' ? e.clientX : e.clientY
      startDrag(clientPos)
    },
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (touch) {
        const clientPos = direction === 'horizontal' ? touch.clientX : touch.clientY
        startDrag(clientPos)
      }
    },
    style: {
      cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
    } as React.CSSProperties,
    'data-resizing': isDragging,
  }

  return {
    size,
    setSize,
    reset,
    isDragging,
    handleProps,
  }
}

/**
 * Pre-configured hook for sidebar resizing.
 */
export function useSidebarResize() {
  return useResizable({
    cssVar: '--sidebar-width',
    initialSize: 280,
    minSize: 200,
    maxSize: 400,
    direction: 'horizontal',
    storageKey: 'minnetonka-sidebar-width',
    edge: 'end',
  })
}

/**
 * Pre-configured hook for right panel resizing.
 */
export function useRightPanelResize() {
  return useResizable({
    cssVar: '--right-panel-width',
    initialSize: 230,
    minSize: 180,
    maxSize: 400,
    direction: 'horizontal',
    storageKey: 'minnetonka-right-panel-width',
    edge: 'start',
  })
}
