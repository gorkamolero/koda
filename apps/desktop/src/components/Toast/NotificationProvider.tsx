import { useEffect } from 'react'
import { ToastContainer } from './ToastContainer'
import { useNotifications } from '@/hooks/useNotifications'
import { initializeTestHelpers, cleanupTestHelpers } from '@/lib/testHelpers'

interface NotificationProviderProps {
  children: React.ReactNode
}

/**
 * Provider component that sets up notifications and exposes test helpers
 */
export function NotificationProvider({ children }: NotificationProviderProps) {
  const {
    showToast,
    sendSystemNotification,
    checkPermission,
  } = useNotifications()

  // Initialize test helpers in development
  useEffect(() => {
    initializeTestHelpers({
      showNotification: showToast,
      sendSystemNotification: async (options) => {
        return sendSystemNotification({
          type: options.type as 'agent_finished' | 'agent_needs_approval' | 'agent_error',
          title: options.title,
          body: options.body,
        })
      },
      checkNotificationPermission: async () => {
        return checkPermission()
      },
    })

    return () => {
      cleanupTestHelpers()
    }
  }, [showToast, sendSystemNotification, checkPermission])

  return (
    <>
      {children}
      <ToastContainer />
    </>
  )
}
