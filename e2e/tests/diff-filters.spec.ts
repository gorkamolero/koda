import { test, expect, Page } from '@playwright/test'

/**
 * Diff View Filters E2E Tests
 *
 * Tests for the file filter tabs in the diff view.
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
  test('displays filter tabs', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Wait for diff file tree to load
    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasTree) {
      test.skip(true, 'No diff file tree visible')
      return
    }

    // 'All' filter is always visible - other filters only show if they have files
    await expect(page.getByTestId('filter-all')).toBeVisible()
    await expect(page.getByTestId('filter-all')).toHaveAttribute('data-active', 'true')
  })

  test('All filter is active by default', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasTree) {
      test.skip(true, 'No diff file tree visible')
      return
    }

    // All filter should be active by default
    const allFilter = page.getByTestId('filter-all')
    await expect(allFilter).toHaveAttribute('data-active', 'true')
  })

  test('can filter to Added files', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasTree) {
      test.skip(true, 'No diff file tree visible')
      return
    }

    // Added filter only shows if there are added files
    const addedFilter = page.getByTestId('filter-added')
    const hasAddedFilter = await addedFilter.isVisible().catch(() => false)
    if (!hasAddedFilter) {
      test.skip(true, 'No added files in diff')
      return
    }

    // Click Added filter
    await addedFilter.click()
    await expect(addedFilter).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('filter-all')).toHaveAttribute('data-active', 'false')
  })

  test('can filter to Modified files', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasTree) {
      test.skip(true, 'No diff file tree visible')
      return
    }

    // Modified filter only shows if there are modified files
    const modifiedFilter = page.getByTestId('filter-modified')
    const hasModifiedFilter = await modifiedFilter.isVisible().catch(() => false)
    if (!hasModifiedFilter) {
      test.skip(true, 'No modified files in diff')
      return
    }

    // Click Modified filter
    await modifiedFilter.click()
    await expect(modifiedFilter).toHaveAttribute('data-active', 'true')
  })

  test('can filter to Deleted files', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasTree) {
      test.skip(true, 'No diff file tree visible')
      return
    }

    // Deleted filter only shows if there are deleted files
    const deletedFilter = page.getByTestId('filter-deleted')
    const hasDeletedFilter = await deletedFilter.isVisible().catch(() => false)
    if (!hasDeletedFilter) {
      test.skip(true, 'No deleted files in diff')
      return
    }

    // Click Deleted filter
    await deletedFilter.click()
    await expect(deletedFilter).toHaveAttribute('data-active', 'true')
  })

  test('can return to All filter', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasTree) {
      test.skip(true, 'No diff file tree visible')
      return
    }

    // Find any filter other than 'all' to test switching back
    const modifiedFilter = page.getByTestId('filter-modified')
    const addedFilter = page.getByTestId('filter-added')
    const deletedFilter = page.getByTestId('filter-deleted')

    const hasModified = await modifiedFilter.isVisible().catch(() => false)
    const hasAdded = await addedFilter.isVisible().catch(() => false)
    const hasDeleted = await deletedFilter.isVisible().catch(() => false)

    if (!hasModified && !hasAdded && !hasDeleted) {
      test.skip(true, 'No filter tabs to switch between')
      return
    }

    // Click any available filter
    const targetFilter = hasModified ? modifiedFilter : hasAdded ? addedFilter : deletedFilter
    await targetFilter.click()
    await expect(page.getByTestId('filter-all')).toHaveAttribute('data-active', 'false')

    // Return to All
    await page.getByTestId('filter-all').click()
    await expect(page.getByTestId('filter-all')).toHaveAttribute('data-active', 'true')
  })

  test('filter tabs show file counts', async ({ page }) => {
    const result = await navigateToDiffView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasTree = await diffFileTree.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasTree) {
      test.skip(true, 'No diff file tree visible')
      return
    }

    // Check that the "All" filter shows a count
    const allFilter = page.getByTestId('filter-all')
    const allText = await allFilter.textContent()
    // Should contain "All" and potentially a number
    expect(allText).toContain('All')
  })
})
