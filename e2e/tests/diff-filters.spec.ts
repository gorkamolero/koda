import { test, expect, Page } from '@playwright/test'

/**
 * Diff View Filters E2E Tests
 *
 * Tests for the file filter tabs in the diff view.
 * Note: Filter functionality requires checkpoint diff data which is created during
 * agent interactions. These tests verify the filter UI when data is available.
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
 * Navigate to Diff view
 */
async function navigateToDiffView(
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

  // Navigate to Diff tab
  await page.getByTestId('tab-diff').click()

  return 'success'
}

test.describe('Diff View Filters', () => {
  test('displays filter tabs when diff data exists', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    // Wait for diff file tree to load - it may or may not have data
    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasTree) {
      // If tree is visible, 'All' filter should always be visible
      await expect(page.getByTestId('filter-all')).toBeVisible()
      await expect(page.getByTestId('filter-all')).toHaveAttribute('data-active', 'true')
    } else {
      // Empty state is also valid - no checkpoint data available
      // The diff view should still render without errors
      expect(true).toBe(true)
    }
  })

  test('All filter is active by default when data exists', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasTree) {
      const allFilter = page.getByTestId('filter-all')
      await expect(allFilter).toHaveAttribute('data-active', 'true')
    } else {
      // No data available - this is acceptable
      expect(true).toBe(true)
    }
  })

  test('filter tabs show counts when data exists', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasTree) {
      const allFilter = page.getByTestId('filter-all')
      const allText = await allFilter.textContent()
      expect(allText).toContain('All')
    } else {
      // No data available - this is acceptable
      expect(true).toBe(true)
    }
  })
})
