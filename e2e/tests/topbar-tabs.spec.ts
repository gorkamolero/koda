import { test, expect, Page } from '@playwright/test'

/**
 * TopBar Tabs E2E Tests
 *
 * Tests for the new tabs added to the TopBar:
 * - Checks tab
 * - Review tab
 * - Terminal tab
 * - Scratchpad tab
 */

/**
 * Helper to wait for page to load
 */
async function waitForPageLoad(page: Page): Promise<boolean> {
  await page.waitForLoadState('networkidle')
  const loading = page.getByText('Loading...')
  await expect(loading).not.toBeVisible({ timeout: 15000 })
  const errorMessage = page.getByText('Failed to load workspaces')
  return !(await errorMessage.isVisible().catch(() => false))
}

/**
 * Navigate to a workspace
 */
async function navigateToWorkspace(
  page: Page
): Promise<'success' | 'no-workspace' | 'sidecar-error'> {
  await page.goto('/')
  const loaded = await waitForPageLoad(page)
  if (!loaded) {
    return 'sidecar-error'
  }

  const workspaceCards = page.locator('button').filter({
    has: page.locator('h3'),
  })

  if ((await workspaceCards.count()) === 0) {
    return 'no-workspace'
  }

  await workspaceCards.first().click()
  await expect(page).toHaveURL(/\/workspace\//)

  return 'success'
}

test.describe('TopBar Tabs', () => {
  test('displays all expected tabs', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Check for all expected tabs
    const tabContainer = page.getByTestId('topbar-tabs')
    await expect(tabContainer).toBeVisible()

    await expect(page.getByTestId('tab-chat')).toBeVisible()
    await expect(page.getByTestId('tab-files')).toBeVisible()
    await expect(page.getByTestId('tab-diff')).toBeVisible()
    await expect(page.getByTestId('tab-checks')).toBeVisible()
    await expect(page.getByTestId('tab-review')).toBeVisible()
    await expect(page.getByTestId('tab-terminal')).toBeVisible()
    await expect(page.getByTestId('tab-scratchpad')).toBeVisible()
  })

  test('Chat tab is active by default', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const chatTab = page.getByTestId('tab-chat')
    await expect(chatTab).toHaveAttribute('data-active', 'true')
  })

  test('clicking Checks tab shows Checks view', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.getByTestId('tab-checks').click()

    // Checks view should be visible
    await expect(page.getByTestId('checks-view-container')).toBeVisible()
    await expect(page.getByText('CI/CD Checks')).toBeVisible()
  })

  test('clicking Review tab shows Review view', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.getByTestId('tab-review').click()

    // Review view should be visible
    await expect(page.getByTestId('review-view-container')).toBeVisible()
    await expect(page.getByText('Code Review')).toBeVisible()
  })

  test('clicking Scratchpad tab shows Scratchpad', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.getByTestId('tab-scratchpad').click()

    // Scratchpad should be visible
    await expect(page.getByTestId('scratchpad-container')).toBeVisible()
  })

  test('clicking Terminal tab shows Terminal panel', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.getByTestId('tab-terminal').click()

    // Terminal panel should be visible (look for xterm container)
    const terminal = page.locator('.xterm, [class*="terminal"]')
    await expect(terminal.first()).toBeVisible({ timeout: 5000 })
  })

  test('tab switching updates active state', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Click Checks tab
    await page.getByTestId('tab-checks').click()
    await expect(page.getByTestId('tab-checks')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('tab-chat')).toHaveAttribute('data-active', 'false')

    // Click back to Chat
    await page.getByTestId('tab-chat').click()
    await expect(page.getByTestId('tab-chat')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('tab-checks')).toHaveAttribute('data-active', 'false')
  })
})
