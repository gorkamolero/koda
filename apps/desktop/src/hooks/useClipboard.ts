import { useState, useCallback, useRef } from 'react'

interface UseClipboardOptions {
  /** Duration to show copied state (ms) */
  timeout?: number
  /** Callback on error */
  onError?: (error: Error) => void
}

interface UseClipboardReturn {
  /** Copy text to clipboard */
  copy: (text: string) => Promise<boolean>
  /** Whether text was recently copied */
  isCopied: boolean
  /** Last error if any */
  error: Error | null
}

/**
 * Hook for clipboard operations with copied state management
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { timeout = 2000, onError } = options
  const [isCopied, setIsCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      setError(null)
      setIsCopied(true)

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Reset copied state after timeout
      timeoutRef.current = setTimeout(() => {
        setIsCopied(false)
      }, timeout)

      return true
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to copy')
      setError(error)
      onError?.(error)
      return false
    }
  }, [timeout, onError])

  return { copy, isCopied, error }
}
