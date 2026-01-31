import { test, expect, Page } from '@playwright/test'

/**
 * Full Integration Tests
 *
 * Tests for complete user workflows.
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

test.describe('Full Integration Flow', () => {
  test('can navigate from workspace list to workspace view', async ({ page }) => {
    await page.goto('/')
    const loaded = await waitForPageLoad(page)
    if (!loaded) {
      test.fail(true, 'Sidecar connection failed')
      return
    }

    // Should see workspace list
    await expect(page.getByRole('heading', { name: 'Workspaces', level: 1 })).toBeVisible()

    // Click first workspace
    const workspaceCards = page.locator('button').filter({
      has: page.locator('h3'),
    })

    if ((await workspaceCards.count()) === 0) {
      test.fail(true, 'No workspaces available')
      return
    }

    await workspaceCards.first().click()

    // Should navigate to workspace view
    await expect(page).toHaveURL(/\/workspace\//)

    // Chat tab should be visible and active
    await expect(page.getByTestId('tab-chat')).toHaveAttribute('data-active', 'true')
  })

  test('can navigate between all tabs in workspace view', async ({ page }) => {
    await page.goto('/')
    const loaded = await waitForPageLoad(page)
    if (!loaded) {
      test.fail(true, 'Sidecar connection failed')
      return
    }

    const workspaceCards = page.locator('button').filter({
      has: page.locator('h3'),
    })

    if ((await workspaceCards.count()) === 0) {
      test.fail(true, 'No workspaces available')
      return
    }

    await workspaceCards.first().click()
    await expect(page).toHaveURL(/\/workspace\//)

    // Test all tab navigation
    const tabs = ['tab-chat', 'tab-files', 'tab-diff', 'tab-checks', 'tab-review', 'tab-scratchpad', 'tab-terminal']

    for (const tabId of tabs) {
      const tab = page.getByTestId(tabId)
      const isVisible = await tab.isVisible().catch(() => false)
      if (isVisible) {
        await tab.click()
        await expect(tab).toHaveAttribute('data-active', 'true')
      }
    }
  })

  test('sidebar shows workspace list', async ({ page }) => {
    await page.goto('/')
    const loaded = await waitForPageLoad(page)
    if (!loaded) {
      test.fail(true, 'Sidecar connection failed')
      return
    }

    const workspaceCards = page.locator('button').filter({
      has: page.locator('h3'),
    })

    if ((await workspaceCards.count()) === 0) {
      test.fail(true, 'No workspaces available')
      return
    }

    await workspaceCards.first().click()
    await expect(page).toHaveURL(/\/workspace\//)

    // Sidebar should show workspace info
    // This may vary based on implementation
    const sidebar = page.locator('[role="complementary"]')
    await expect(sidebar).toBeVisible()
  })
})
