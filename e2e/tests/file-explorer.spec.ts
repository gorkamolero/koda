import { test, expect, Page } from '@playwright/test'

/**
 * File Explorer Tests
 *
 * Tests for the file explorer functionality.
 * Note: Full file explorer functionality requires file tree data.
 * These tests verify the UI renders correctly.
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
 * Navigate to Files view
 */
async function navigateToFilesView(
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

  // Navigate to Files tab
  await page.getByTestId('tab-files').click()

  return 'success'
}

test.describe('File Explorer', () => {
  test('displays file explorer when Files tab is clicked', async ({ page }) => {
    const result = await navigateToFilesView(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    // Files tab should be active
    const filesTab = page.getByTestId('tab-files')
    await expect(filesTab).toHaveAttribute('data-active', 'true')
  })

  test('Files tab is accessible via TopBar', async ({ page }) => {
    const result = await navigateToFilesView(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    // The files tab should have data-active="true" after clicking
    const filesTab = page.getByTestId('tab-files')
    await expect(filesTab).toHaveAttribute('data-active', 'true')
  })

  test('can switch between Files and other tabs', async ({ page }) => {
    const result = await navigateToFilesView(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    // Files tab should be active
    await expect(page.getByTestId('tab-files')).toHaveAttribute('data-active', 'true')

    // Switch to Chat tab
    await page.getByTestId('tab-chat').click()
    await expect(page.getByTestId('tab-chat')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('tab-files')).toHaveAttribute('data-active', 'false')

    // Switch back to Files
    await page.getByTestId('tab-files').click()
    await expect(page.getByTestId('tab-files')).toHaveAttribute('data-active', 'true')
  })
})
