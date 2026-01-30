import { useEffect, useState, useCallback, useRef } from 'react'
import type { Toast as ToastType, ToastType as ToastVariant } from '@/store/notifications'

interface ToastProps {
  toast: ToastType
  onDismiss: (id: string) => void
}

const ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

const STYLES: Record<ToastVariant, string> = {
  success: 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100',
  error: 'bg-red-900/90 border-red-500/50 text-red-100',
  warning: 'bg-amber-900/90 border-amber-500/50 text-amber-100',
  info: 'bg-blue-900/90 border-blue-500/50 text-blue-100',
}

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'bg-emerald-500/30 text-emerald-300',
  error: 'bg-red-500/30 text-red-300',
  warning: 'bg-amber-500/30 text-amber-300',
  info: 'bg-blue-500/30 text-blue-300',
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const isLeavingRef = useRef(false)

  const handleDismiss = useCallback(() => {
    if (isLeavingRef.current) return
    isLeavingRef.current = true
    setIsLeaving(true)
    // Wait for exit animation before removing
    setTimeout(() => {
      onDismiss(toast.id)
    }, 200)
  }, [onDismiss, toast.id])

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => {
      setIsVisible(true)
    }, 10)

    // Set up auto-dismiss if duration > 0
    let dismissTimer: ReturnType<typeof setTimeout> | undefined
    if (toast.duration > 0) {
      dismissTimer = setTimeout(() => {
        handleDismiss()
      }, toast.duration)
    }

    return () => {
      clearTimeout(enterTimer)
      if (dismissTimer) {
        clearTimeout(dismissTimer)
      }
    }
  }, [toast.duration, handleDismiss])

  return (
    <div
      data-testid="toast"
      data-type={toast.type}
      role="alert"
      aria-live="assertive"
      className={`
        pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg
        border p-4 shadow-lg backdrop-blur-sm
        transition-all duration-200 ease-out
        ${STYLES[toast.type]}
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}
      `}
    >
      {/* Icon */}
      <div
        className={`
          flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full
          text-sm font-bold
          ${ICON_STYLES[toast.type]}
        `}
      >
        {ICONS[toast.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-sm opacity-90 line-clamp-2">{toast.message}</p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        data-testid="toast-dismiss"
        onClick={handleDismiss}
        className="
          flex-shrink-0 rounded p-1 opacity-70 hover:opacity-100
          transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50
        "
        aria-label="Dismiss notification"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}
