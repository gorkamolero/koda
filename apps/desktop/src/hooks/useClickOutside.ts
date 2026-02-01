import { useEffect, type RefObject } from 'react'

interface UseClickOutsideOptions {
  /** Called when clicking outside the element */
  onClickOutside: () => void
  /** Called when Escape key is pressed */
  onEscape?: () => void
  /** Whether the listener is active */
  enabled?: boolean
}

/**
 * Hook to handle click-outside and escape key dismissal for dropdowns/modals.
 * Attaches event listeners only when enabled.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseClickOutsideOptions
): void {
  const { onClickOutside, onEscape, enabled = true } = options

  useEffect(() => {
    if (!enabled) return

    function handleClickOutside(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside()
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && onEscape) {
        onEscape()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    if (onEscape) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (onEscape) {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [ref, onClickOutside, onEscape, enabled])
}
