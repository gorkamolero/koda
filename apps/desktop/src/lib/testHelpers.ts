import type { ToastOptions } from '@/store/notifications'

/**
 * Test helpers interface exposed on window for E2E testing
 */
export interface KodaTestHelpers {
  showNotification: (options: ToastOptions) => void
  sendSystemNotification: (options: {
    type: string
    title: string
    body: string
  }) => Promise<boolean>
  checkNotificationPermission: () => Promise<string>
}

declare global {
  interface Window {
    __koda_test?: KodaTestHelpers
  }
}

/**
 * Initialize test helpers on the window object
 * Only runs in development mode
 */
export function initializeTestHelpers(helpers: KodaTestHelpers): void {
  if (import.meta.env.DEV) {
    window.__koda_test = helpers
  }
}

/**
 * Clean up test helpers
 */
export function cleanupTestHelpers(): void {
  if (import.meta.env.DEV && window.__koda_test) {
    delete window.__koda_test
  }
}
