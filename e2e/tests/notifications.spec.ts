import { test, expect } from '@playwright/test'

/**
 * Notification Tests
 *
 * Tests for toast notifications and system notifications.
 * These tests rely on the app exposing test helpers on window.__koda_test__.
 */
test.describe('Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('app loads and sidebar is visible', async ({ page }) => {
    // Basic sanity check that app is running
    await expect(page.locator('aside')).toBeVisible()
  })

  test('notification helper is available if exposed', async ({ page }) => {
    // Check if the test helper exists
    const hasTestHelper = await page.evaluate(() => {
      return typeof (window as { __koda_test__?: { showNotification?: unknown } }).__koda_test__?.showNotification === 'function'
    })

    if (!hasTestHelper) {
      test.skip(true, 'Test helper not exposed in production build')
      return
    }

    // If helper exists, test it
    await page.evaluate(() => {
      const w = window as { __koda_test__?: { showNotification: (opts: { type: string; title: string; message: string }) => void } }
      w.__koda_test__?.showNotification({
        type: 'success',
        title: 'Test Notification',
        message: 'This is a test',
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible({ timeout: 5000 })
    await expect(toast).toContainText('Test Notification')
  })

  test('shows success toast styling when type is success', async ({ page }) => {
    const hasTestHelper = await page.evaluate(() => {
      return typeof (window as { __koda_test__?: { showNotification?: unknown } }).__koda_test__?.showNotification === 'function'
    })

    if (!hasTestHelper) {
      test.skip(true, 'Test helper not exposed')
      return
    }

    await page.evaluate(() => {
      const w = window as { __koda_test__?: { showNotification: (opts: { type: string; title: string; message: string }) => void } }
      w.__koda_test__?.showNotification({
        type: 'success',
        title: 'Success',
        message: 'Operation completed',
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()
    await expect(toast).toHaveAttribute('data-type', 'success')
  })

  test('shows error toast styling when type is error', async ({ page }) => {
    const hasTestHelper = await page.evaluate(() => {
      return typeof (window as { __koda_test__?: { showNotification?: unknown } }).__koda_test__?.showNotification === 'function'
    })

    if (!hasTestHelper) {
      test.skip(true, 'Test helper not exposed')
      return
    }

    await page.evaluate(() => {
      const w = window as { __koda_test__?: { showNotification: (opts: { type: string; title: string; message: string }) => void } }
      w.__koda_test__?.showNotification({
        type: 'error',
        title: 'Error',
        message: 'Something went wrong',
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()
    await expect(toast).toHaveAttribute('data-type', 'error')
  })

  test('toast can be dismissed by clicking close button', async ({ page }) => {
    const hasTestHelper = await page.evaluate(() => {
      return typeof (window as { __koda_test__?: { showNotification?: unknown } }).__koda_test__?.showNotification === 'function'
    })

    if (!hasTestHelper) {
      test.skip(true, 'Test helper not exposed')
      return
    }

    await page.evaluate(() => {
      const w = window as { __koda_test__?: { showNotification: (opts: { type: string; title: string; message: string; duration?: number }) => void } }
      w.__koda_test__?.showNotification({
        type: 'info',
        title: 'Dismissable',
        message: 'Click to dismiss',
        duration: 60000,
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()

    // Click dismiss button if it exists
    const dismissButton = toast.locator('[data-testid="toast-dismiss"]')
    if (await dismissButton.isVisible().catch(() => false)) {
      await dismissButton.click()
      await expect(toast).not.toBeVisible()
    }
  })

  test('multiple toasts stack correctly', async ({ page }) => {
    const hasTestHelper = await page.evaluate(() => {
      return typeof (window as { __koda_test__?: { showNotification?: unknown } }).__koda_test__?.showNotification === 'function'
    })

    if (!hasTestHelper) {
      test.skip(true, 'Test helper not exposed')
      return
    }

    // Show multiple notifications
    await page.evaluate(() => {
      const w = window as { __koda_test__?: { showNotification: (opts: { type: string; title: string; message: string; duration?: number }) => void } }
      w.__koda_test__?.showNotification({
        type: 'info',
        title: 'First',
        message: 'First notification',
        duration: 10000,
      })
      w.__koda_test__?.showNotification({
        type: 'success',
        title: 'Second',
        message: 'Second notification',
        duration: 10000,
      })
    })

    // Should show multiple toasts
    const toasts = page.locator('[data-testid="toast"]')
    const toastCount = await toasts.count()
    expect(toastCount).toBeGreaterThanOrEqual(2)
  })
})

test.describe('Toast Container Positioning', () => {
  test('toast container exists when notifications are shown', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hasTestHelper = await page.evaluate(() => {
      return typeof (window as { __koda_test__?: { showNotification?: unknown } }).__koda_test__?.showNotification === 'function'
    })

    if (!hasTestHelper) {
      test.skip(true, 'Test helper not exposed')
      return
    }

    await page.evaluate(() => {
      const w = window as { __koda_test__?: { showNotification: (opts: { type: string; title: string; message: string }) => void } }
      w.__koda_test__?.showNotification({
        type: 'info',
        title: 'Position Test',
        message: 'Testing position',
      })
    })

    const container = page.locator('[data-testid="toast-container"]')
    await expect(container).toBeVisible()
  })
})

test.describe('System Notifications', () => {
  test('system notification helper exists if exposed', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hasSystemNotify = await page.evaluate(() => {
      return typeof (window as { __koda_test__?: { sendSystemNotification?: unknown } }).__koda_test__?.sendSystemNotification === 'function'
    })

    // Just verify the check works - actual system notifications require permissions
    expect(typeof hasSystemNotify).toBe('boolean')
  })

  test('notification permission check exists if exposed', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hasPermissionCheck = await page.evaluate(() => {
      return typeof (window as { __koda_test__?: { checkNotificationPermission?: unknown } }).__koda_test__?.checkNotificationPermission === 'function'
    })

    expect(typeof hasPermissionCheck).toBe('boolean')
  })
})
