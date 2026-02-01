import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from '@/hooks/useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useClipboard())

    expect(result.current.isCopied).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.copy).toBe('function')
  })

  it('should copy text and set isCopied', async () => {
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      const success = await result.current.copy('test text')
      expect(success).toBe(true)
    })

    expect(result.current.isCopied).toBe(true)
    expect(vi.mocked(navigator.clipboard).writeText).toHaveBeenCalledWith('test text')
  })

  it('should reset isCopied after timeout', async () => {
    const { result } = renderHook(() => useClipboard({ timeout: 1000 }))

    await act(async () => {
      await result.current.copy('test')
    })

    expect(result.current.isCopied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.isCopied).toBe(false)
  })

  it('should use default timeout of 2000ms', async () => {
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('test')
    })

    expect(result.current.isCopied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.isCopied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(result.current.isCopied).toBe(false)
  })

  it('should handle copy error', async () => {
    const mockError = new Error('Clipboard access denied')
    vi.mocked(navigator.clipboard).writeText.mockRejectedValueOnce(mockError)

    const onError = vi.fn()
    const { result } = renderHook(() => useClipboard({ onError }))

    await act(async () => {
      const success = await result.current.copy('test')
      expect(success).toBe(false)
    })

    expect(result.current.error).toBe(mockError)
    expect(onError).toHaveBeenCalledWith(mockError)
    expect(result.current.isCopied).toBe(false)
  })

  it('should wrap non-Error exceptions', async () => {
    vi.mocked(navigator.clipboard).writeText.mockRejectedValueOnce('string error')

    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('test')
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Failed to copy')
  })

  it('should clear error on successful copy', async () => {
    const mockError = new Error('First error')
    vi.mocked(navigator.clipboard).writeText
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useClipboard())

    // First copy fails
    await act(async () => {
      await result.current.copy('fail')
    })
    expect(result.current.error).toBe(mockError)

    // Second copy succeeds
    await act(async () => {
      await result.current.copy('success')
    })
    expect(result.current.error).toBeNull()
    expect(result.current.isCopied).toBe(true)
  })

  it('should clear previous timeout on rapid copies', async () => {
    const { result } = renderHook(() => useClipboard({ timeout: 1000 }))

    // First copy
    await act(async () => {
      await result.current.copy('first')
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.isCopied).toBe(true)

    // Second copy (should reset timer)
    await act(async () => {
      await result.current.copy('second')
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })
    // Should still be copied because timer was reset
    expect(result.current.isCopied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(600)
    })
    // Now it should be false
    expect(result.current.isCopied).toBe(false)
  })
})
