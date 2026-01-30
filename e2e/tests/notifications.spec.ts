import { test, expect } from '@playwright/test'

test.describe('Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
  })

  test('shows success toast notification', async ({ page }) => {
    // Wait for app to load
    await expect(page.locator('aside')).toBeVisible()

    // Trigger a success notification via the exposed test function
    await page.evaluate(() => {
      window.__koda_test?.showNotification({
        type: 'success',
        title: 'Agent Finished',
        message: 'Task completed successfully',
      })
    })

    // Verify toast appears
    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('Agent Finished')
    await expect(toast).toContainText('Task completed successfully')

    // Verify success styling (green)
    await expect(toast).toHaveAttribute('data-type', 'success')
  })

  test('shows error toast notification', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible()

    await page.evaluate(() => {
      window.__koda_test?.showNotification({
        type: 'error',
        title: 'Error',
        message: 'Something went wrong',
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('Error')
    await expect(toast).toHaveAttribute('data-type', 'error')
  })

  test('shows warning toast notification for approval needed', async ({
    page,
  }) => {
    await expect(page.locator('aside')).toBeVisible()

    await page.evaluate(() => {
      window.__koda_test?.showNotification({
        type: 'warning',
        title: 'Approval Required',
        message: 'Agent needs your approval to continue',
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('Approval Required')
    await expect(toast).toHaveAttribute('data-type', 'warning')
  })

  test('shows info toast notification', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible()

    await page.evaluate(() => {
      window.__koda_test?.showNotification({
        type: 'info',
        title: 'Info',
        message: 'Agent started processing',
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('Info')
    await expect(toast).toHaveAttribute('data-type', 'info')
  })

  test('toast auto-dismisses after timeout', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible()

    await page.evaluate(() => {
      window.__koda_test?.showNotification({
        type: 'info',
        title: 'Quick Message',
        message: 'This will disappear',
        duration: 1000, // 1 second
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()

    // Wait for auto-dismiss
    await expect(toast).not.toBeVisible({ timeout: 3000 })
  })

  test('toast can be manually dismissed', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible()

    await page.evaluate(() => {
      window.__koda_test?.showNotification({
        type: 'info',
        title: 'Dismissable',
        message: 'Click to dismiss',
        duration: 60000, // Long duration
      })
    })

    const toast = page.locator('[data-testid="toast"]').first()
    await expect(toast).toBeVisible()

    // Click dismiss button
    await toast.locator('[data-testid="toast-dismiss"]').click()

    await expect(toast).not.toBeVisible()
  })

  test('multiple toasts stack correctly', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible()

    // Show multiple notifications
    await page.evaluate(() => {
      window.__koda_test?.showNotification({
        type: 'info',
        title: 'First',
        message: 'First notification',
        duration: 10000,
      })
      window.__koda_test?.showNotification({
        type: 'success',
        title: 'Second',
        message: 'Second notification',
        duration: 10000,
      })
      window.__koda_test?.showNotification({
        type: 'error',
        title: 'Third',
        message: 'Third notification',
        duration: 10000,
      })
    })

    // All three should be visible
    const toasts = page.locator('[data-testid="toast"]')
    await expect(toasts).toHaveCount(3)

    // Verify order (newest at bottom or top depending on design)
    await expect(toasts.nth(0)).toContainText('First')
    await expect(toasts.nth(1)).toContainText('Second')
    await expect(toasts.nth(2)).toContainText('Third')
  })

  test('toast container positioned correctly', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible()

    await page.evaluate(() => {
      window.__koda_test?.showNotification({
        type: 'info',
        title: 'Positioned',
        message: 'Check position',
      })
    })

    const container = page.locator('[data-testid="toast-container"]')
    await expect(container).toBeVisible()

    // Container should be fixed positioned in bottom-right
    const boundingBox = await container.boundingBox()
    const viewport = page.viewportSize()
    if (boundingBox && viewport) {
      // Check it's in the right side of the screen
      expect(boundingBox.x + boundingBox.width).toBeGreaterThan(viewport.width / 2)
    }
  })
})

test.describe('System Notifications', () => {
  test('system notification helper is available', async ({ page }) => {
    await page.goto('http://localhost:1420')
    await expect(page.locator('aside')).toBeVisible()

    // Check that the system notification function exists
    const hasSystemNotify = await page.evaluate(() => {
      return typeof window.__koda_test?.sendSystemNotification === 'function'
    })

    expect(hasSystemNotify).toBe(true)
  })

  test('can request notification permission', async ({ page }) => {
    await page.goto('http://localhost:1420')
    await expect(page.locator('aside')).toBeVisible()

    // Check that permission check function exists
    const hasPermissionCheck = await page.evaluate(() => {
      return typeof window.__koda_test?.checkNotificationPermission === 'function'
    })

    expect(hasPermissionCheck).toBe(true)
  })
})
