import { useCallback, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import {
  toastsAtom,
  addToastAtom,
  removeToastAtom,
  clearToastsAtom,
  notificationPermissionAtom,
  systemNotificationsEnabledAtom,
  type ToastOptions,
  type SystemNotificationOptions,
  type NotificationPermission,
  type Toast,
} from '@/store/notifications'

/**
 * Hook for managing notifications
 */
export function useNotifications() {
  const [toasts] = useAtom(toastsAtom)
  const addToast = useSetAtom(addToastAtom)
  const removeToast = useSetAtom(removeToastAtom)
  const clearToasts = useSetAtom(clearToastsAtom)
  const [permission, setPermission] = useAtom(notificationPermissionAtom)
  const [systemEnabled, setSystemEnabled] = useAtom(systemNotificationsEnabledAtom)

  /**
   * Check and update notification permission status
   */
  const checkPermission = useCallback(async (): Promise<NotificationPermission> => {
    try {
      const granted = await isPermissionGranted()
      const status: NotificationPermission = granted ? 'granted' : 'denied'
      setPermission(status)
      return status
    } catch (error) {
      console.error('Failed to check notification permission:', error)
      setPermission('unknown')
      return 'unknown'
    }
  }, [setPermission])

  /**
   * Request notification permission
   */
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    try {
      const result = await requestPermission()
      const status: NotificationPermission =
        result === 'granted' ? 'granted' : 'denied'
      setPermission(status)
      return status
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return 'denied'
    }
  }, [setPermission])

  /**
   * Send a system notification
   */
  const sendSystemNotification = useCallback(
    async (options: SystemNotificationOptions): Promise<boolean> => {
      if (!systemEnabled) {
        return false
      }

      try {
        // Check permission first
        let currentPermission = permission
        if (currentPermission === 'unknown') {
          currentPermission = await checkPermission()
        }

        if (currentPermission !== 'granted') {
          console.warn('System notifications not permitted')
          return false
        }

        // sendNotification is synchronous and returns void
        sendNotification({
          title: options.title,
          body: options.body,
        })

        return true
      } catch (error) {
        console.error('Failed to send system notification:', error)
        return false
      }
    },
    [permission, systemEnabled, checkPermission]
  )

  /**
   * Show a toast notification
   */
  const showToast = useCallback(
    (options: ToastOptions): Toast => {
      return addToast(options)
    },
    [addToast]
  )

  /**
   * Dismiss a toast notification
   */
  const dismissToast = useCallback(
    (id: string) => {
      removeToast(id)
    },
    [removeToast]
  )

  /**
   * Dismiss all toast notifications
   */
  const dismissAllToasts = useCallback(() => {
    clearToasts()
  }, [clearToasts])

  /**
   * Enable or disable system notifications
   */
  const setSystemNotificationsEnabled = useCallback(
    (enabled: boolean) => {
      setSystemEnabled(enabled)
    },
    [setSystemEnabled]
  )

  // Check permission on mount
  useEffect(() => {
    if (permission === 'unknown') {
      void checkPermission()
    }
  }, [permission, checkPermission])

  return {
    // State
    toasts,
    permission,
    systemEnabled,

    // Toast actions
    showToast,
    dismissToast,
    dismissAllToasts,

    // System notification actions
    sendSystemNotification,
    checkPermission,
    requestNotificationPermission,
    setSystemNotificationsEnabled,
  }
}

/**
 * Convenience functions for agent-specific notifications
 */
export function useAgentNotifications() {
  const { showToast, sendSystemNotification, systemEnabled } = useNotifications()

  /**
   * Notify that an agent has finished its task
   */
  const notifyAgentFinished = useCallback(
    async (agentName: string, summary?: string) => {
      // Show in-app toast
      showToast({
        type: 'success',
        title: 'Agent Finished',
        message: summary ?? `${agentName} has completed its task`,
      })

      // Send system notification if window is not focused
      if (systemEnabled && !document.hasFocus()) {
        await sendSystemNotification({
          type: 'agent_finished',
          title: 'Agent Finished',
          body: summary ?? `${agentName} has completed its task`,
        })
      }
    },
    [showToast, sendSystemNotification, systemEnabled]
  )

  /**
   * Notify that an agent needs approval
   */
  const notifyAgentNeedsApproval = useCallback(
    async (agentName: string, action?: string) => {
      // Show in-app toast
      showToast({
        type: 'warning',
        title: 'Approval Required',
        message: action ?? `${agentName} needs your approval to continue`,
        duration: 0, // Don't auto-dismiss
      })

      // Send system notification if window is not focused
      if (systemEnabled && !document.hasFocus()) {
        await sendSystemNotification({
          type: 'agent_needs_approval',
          title: 'Approval Required',
          body: action ?? `${agentName} needs your approval to continue`,
        })
      }
    },
    [showToast, sendSystemNotification, systemEnabled]
  )

  /**
   * Notify that an agent encountered an error
   */
  const notifyAgentError = useCallback(
    async (agentName: string, error?: string) => {
      // Show in-app toast
      showToast({
        type: 'error',
        title: 'Agent Error',
        message: error ?? `${agentName} encountered an error`,
      })

      // Send system notification if window is not focused
      if (systemEnabled && !document.hasFocus()) {
        await sendSystemNotification({
          type: 'agent_error',
          title: 'Agent Error',
          body: error ?? `${agentName} encountered an error`,
        })
      }
    },
    [showToast, sendSystemNotification, systemEnabled]
  )

  return {
    notifyAgentFinished,
    notifyAgentNeedsApproval,
    notifyAgentError,
  }
}
