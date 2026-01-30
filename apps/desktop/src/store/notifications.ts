import { atom } from 'jotai'

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info'

/**
 * A toast notification
 */
export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration: number
  createdAt: number
}

/**
 * Options for creating a toast notification
 */
export interface ToastOptions {
  type: ToastType
  title: string
  message?: string
  duration?: number // in milliseconds, default 5000
}

/**
 * Default duration for toast notifications (5 seconds)
 */
const DEFAULT_TOAST_DURATION = 5000

/**
 * Maximum number of toasts to show at once
 */
const MAX_TOASTS = 5

/**
 * Generate a unique toast ID
 */
export function generateToastId(): string {
  return `toast_${String(Date.now())}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Toasts array atom
 */
export const toastsAtom = atom<Toast[]>([])

/**
 * Add a toast notification
 */
export const addToastAtom = atom(null, (get, set, options: ToastOptions) => {
  const toast: Toast = {
    id: generateToastId(),
    type: options.type,
    title: options.title,
    message: options.message,
    duration: options.duration ?? DEFAULT_TOAST_DURATION,
    createdAt: Date.now(),
  }

  const currentToasts = get(toastsAtom)

  // Remove oldest toasts if we exceed the limit
  const newToasts =
    currentToasts.length >= MAX_TOASTS
      ? [...currentToasts.slice(1), toast]
      : [...currentToasts, toast]

  set(toastsAtom, newToasts)

  return toast
})

/**
 * Remove a toast by ID
 */
export const removeToastAtom = atom(null, (get, set, id: string) => {
  const currentToasts = get(toastsAtom)
  set(
    toastsAtom,
    currentToasts.filter((toast) => toast.id !== id)
  )
})

/**
 * Clear all toasts
 */
export const clearToastsAtom = atom(null, (_get, set) => {
  set(toastsAtom, [])
})

/**
 * System notification types for agent events
 */
export type SystemNotificationType =
  | 'agent_finished'
  | 'agent_needs_approval'
  | 'agent_error'

/**
 * System notification options
 */
export interface SystemNotificationOptions {
  type: SystemNotificationType
  title: string
  body: string
}

/**
 * Notification permission status
 */
export type NotificationPermission = 'granted' | 'denied' | 'unknown'

/**
 * System notification permission atom
 */
export const notificationPermissionAtom = atom<NotificationPermission>('unknown')

/**
 * Whether system notifications are enabled
 */
export const systemNotificationsEnabledAtom = atom<boolean>(true)
