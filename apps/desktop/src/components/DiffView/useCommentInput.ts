import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { activeCommentInputAtom } from '@/store/diff'

/**
 * Hook to open comment input programmatically
 */
export function useCommentInput() {
  const setActiveInput = useSetAtom(activeCommentInputAtom)

  return useCallback(
    (fileId: string, lineNumber: number, side: 'original' | 'modified') => {
      setActiveInput({ fileId, lineNumber, side })
    },
    [setActiveInput]
  )
}
