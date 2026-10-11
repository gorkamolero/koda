import { Toast as ToastView } from '@koda/ui'
import { useEffect, useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Toast as ToastType, ToastType as ToastVariant } from '@/store/notifications'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

interface ToastProps {
  toast: ToastType
  onDismiss: (id: string) => void
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
}

const STYLES: Record<ToastVariant, string> = {
  success: 'border-status-success/40 bg-status-success/10',
  error: 'border-status-error/40 bg-status-error/10',
  warning: 'border-status-warning/40 bg-status-warning/10',
  info: 'border-border-accent/40 bg-surface-active',
}

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-status-success',
  error: 'text-status-error',
  warning: 'text-status-warning',
  info: 'text-text-accent',
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
    <ToastView
      title={toast.title}
      description={toast.message}
      tone={toast.type}
      onDismiss={handleDismiss}
      dismissProps={{ 'data-testid': 'toast-dismiss', className: 'size-6 p-1 opacity-70 hover:opacity-100' }}
      icon={<div className={cn('flex-shrink-0', ICON_STYLES[toast.type])}>{ICONS[toast.type]}</div>}
      descriptionClassName="text-sm text-text-muted line-clamp-2"
      data-testid="toast"
      data-type={toast.type}
      role="alert"
      aria-live="assertive"
      className={cn(
        'font-ui pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl',
        'border p-4 shadow-xl glass',
        'transition-all duration-200 ease-out',
        STYLES[toast.type],
        isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      )}
    />
  )
}
