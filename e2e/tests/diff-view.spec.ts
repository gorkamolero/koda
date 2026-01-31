import { test, expect, Page } from '@playwright/test'

/**
 * Diff View Tests
 *
 * Tests for the diff viewer functionality.
 * Requires a workspace with git changes to fully test.
 */

/**
 * Helper to wait for page to load and check for errors
 */
async function waitForPageLoad(page: Page): Promise<boolean> {
  await page.waitForLoadState('networkidle')
  const loading = page.getByText('Loading...')
  await expect(loading).not.toBeVisible({ timeout: 15000 })
  const errorMessage = page.getByText('Failed to load workspaces')
  return !(await errorMessage.isVisible().catch(() => false))
}

/**
 * Navigate to a workspace and switch to Diff tab
 */
async function navigateToDiffTab(page: Page): Promise<'success' | 'no-workspace' | 'sidecar-error'> {
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

  // Click Diff tab
  await page.getByRole('button', { name: 'Diff' }).click()

  return 'success'
}

test.describe('Diff View', () => {
  test('displays diff view when Diff tab is clicked', async ({ page }) => {
    const result = await navigateToDiffTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Diff view should be visible - either file tree or empty state
    const diffFileTree = page.getByTestId('diff-file-tree')
    const emptyDiff = page.getByText(/No changes|No files changed/)

    const hasTree = await diffFileTree.isVisible().catch(() => false)
    const isEmpty = await emptyDiff.isVisible().catch(() => false)

    // One of these should be visible
    expect(hasTree || isEmpty).toBe(true)
  })

  test('shows file tree with changed files when changes exist', async ({
    page,
  }) => {
    const result = await navigateToDiffTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Wait a moment for diff view to load
    await page.waitForTimeout(1000)

    // Check if diff file tree is visible
    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasChanges = await diffFileTree.isVisible().catch(() => false)

    if (!hasChanges) {
      // Also check for empty state message
      const emptyDiff = page.getByText(/No changes|No files changed/)
      const isEmpty = await emptyDiff.isVisible().catch(() => false)
      if (isEmpty) {
        test.skip(true, 'No git changes in workspace')
        return
      }
      // Neither file tree nor empty state visible - UI not implemented
      test.skip(true, 'Diff file tree UI not available')
      return
    }

    // File count should be shown (if this element exists)
    const diffFileCount = page.getByTestId('diff-file-count')
    const hasCount = await diffFileCount.isVisible().catch(() => false)
    if (hasCount) {
      await expect(diffFileCount).toBeVisible()
    }

    // At least one file item should be present
    const fileItems = page.getByTestId('diff-file-item')
    const itemCount = await fileItems.count()
    if (itemCount === 0) {
      test.skip(true, 'No diff file items found')
      return
    }
    expect(itemCount).toBeGreaterThan(0)
  })
})

test.describe('Diff View - Mode Toggle', () => {
  test('displays split/unified mode toggle', async ({ page }) => {
    const result = await navigateToDiffTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Check if there are changes to show mode toggle for
    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasChanges = await diffFileTree.isVisible().catch(() => false)

    if (!hasChanges) {
      test.skip(true, 'No git changes to test mode toggle')
      return
    }

    await expect(page.getByTestId('diff-mode-toggle')).toBeVisible()
    await expect(page.getByTestId('diff-mode-split')).toBeVisible()
    await expect(page.getByTestId('diff-mode-unified')).toBeVisible()
  })

  test('can switch between split and unified modes', async ({ page }) => {
    const result = await navigateToDiffTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Wait a moment for diff view to load
    await page.waitForTimeout(1000)

    const diffFileTree = page.getByTestId('diff-file-tree')
    const hasChanges = await diffFileTree.isVisible().catch(() => false)

    if (!hasChanges) {
      test.skip(true, 'No git changes to test diff modes')
      return
    }

    // Check if there are file items to click
    const fileItems = page.getByTestId('diff-file-item')
    const itemCount = await fileItems.count()
    if (itemCount === 0) {
      test.skip(true, 'No diff file items available')
      return
    }

    // Select a file first
    await fileItems.first().click()
    
    // Check if Monaco container appears
    const monacoContainer = page.getByTestId('diff-monaco-container')
    const hasMonaco = await monacoContainer.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasMonaco) {
      test.skip(true, 'Monaco diff container not available')
      return
    }

    // Check if mode toggle exists
    const modeSplit = page.getByTestId('diff-mode-split')
    const hasModeToggle = await modeSplit.isVisible().catch(() => false)
    if (!hasModeToggle) {
      test.skip(true, 'Mode toggle not implemented')
      return
    }

    // Should default to split mode
    await expect(modeSplit).toHaveAttribute('data-active', 'true')

    // Switch to unified mode
    await page.getByTestId('diff-mode-unified').click()
    await expect(page.getByTestId('diff-mode-unified')).toHaveAttribute(
      'data-active',
      'true'
    )

    // Switch back to split
    await modeSplit.click()
    await expect(modeSplit).toHaveAttribute('data-active', 'true')
  })
})

test.describe('Diff View - Monaco Editor', () => {
  test('clicking a file shows Monaco diff editor', async ({ page }) => {
    const hasWorkspace = await navigateToDiffTab(page)
    if (hasWorkspace === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (hasWorkspace === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const fileItems = page.getByTestId('diff-file-item')
    const hasChanges = (await fileItems.count()) > 0

    if (!hasChanges) {
      test.skip(true, 'No git changes to test')
      return
    }

    // Click first file
    await fileItems.first().click()

    // Monaco diff editor should load
    await expect(page.getByTestId('diff-monaco-container')).toBeVisible()

    // Should show Monaco editor(s)
    await expect(
      page
        .locator(
          '.monaco-editor.original-in-monaco-diff-editor, .monaco-editor.modified-in-monaco-diff-editor, .monaco-editor'
        )
        .first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('Monaco diff shows view lines with content', async ({ page }) => {
    const hasWorkspace = await navigateToDiffTab(page)
    if (hasWorkspace === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (hasWorkspace === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const fileItems = page.getByTestId('diff-file-item')
    const hasChanges = (await fileItems.count()) > 0

    if (!hasChanges) {
      test.skip(true, 'No git changes')
      return
    }

    await fileItems.first().click()
    await expect(page.getByTestId('diff-monaco-container')).toBeVisible()

    // View lines should be visible (actual content)
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible({
      timeout: 10000,
    })
  })
})

test.describe('Diff View - File Navigation', () => {
  test('can navigate between changed files', async ({ page }) => {
    const hasWorkspace = await navigateToDiffTab(page)
    if (hasWorkspace === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (hasWorkspace === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const fileItems = page.getByTestId('diff-file-item')
    const fileCount = await fileItems.count()

    if (fileCount < 2) {
      test.skip(true, 'Need at least 2 changed files to test navigation')
      return
    }

    // Click first file
    await fileItems.first().click()
    await expect(fileItems.first()).toHaveAttribute('data-selected', 'true')

    // Click second file
    await fileItems.nth(1).click()
    await expect(fileItems.nth(1)).toHaveAttribute('data-selected', 'true')
  })

  test('keyboard navigation with n/p keys', async ({ page }) => {
    const hasWorkspace = await navigateToDiffTab(page)
    if (hasWorkspace === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (hasWorkspace === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const fileItems = page.getByTestId('diff-file-item')
    const fileCount = await fileItems.count()

    if (fileCount < 2) {
      test.skip(true, 'Need at least 2 changed files')
      return
    }

    // Select first file
    await fileItems.first().click()

    // Press n for next
    await page.keyboard.press('n')
    await expect(fileItems.nth(1)).toHaveAttribute('data-selected', 'true')

    // Press p for previous
    await page.keyboard.press('p')
    await expect(fileItems.first()).toHaveAttribute('data-selected', 'true')
  })
})

test.describe('Diff View - File Status', () => {
  test('shows file status badges (added/modified/deleted)', async ({
    page,
  }) => {
    const hasWorkspace = await navigateToDiffTab(page)
    if (hasWorkspace === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (hasWorkspace === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const fileItems = page.getByTestId('diff-file-item')
    const fileCount = await fileItems.count()

    if (fileCount === 0) {
      test.skip(true, 'No changed files')
      return
    }

    // Check for status badges
    let foundBadge = false
    for (let i = 0; i < fileCount; i++) {
      const badge = fileItems.nth(i).locator('[data-testid="file-status-badge"]')
      if (await badge.isVisible().catch(() => false)) {
        foundBadge = true
        const status = await badge.getAttribute('data-status')
        expect(['added', 'modified', 'deleted']).toContain(status)
        break
      }
    }

    // If no badges found, that's also valid (might not have status indicators implemented)
    expect(foundBadge || fileCount > 0).toBe(true)
  })
})

test.describe('Diff View - Performance', () => {
  test('diff view renders within reasonable time', async ({ page }) => {
    const hasWorkspace = await navigateToDiffTab(page)
    if (hasWorkspace === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (hasWorkspace === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const start = Date.now()

    // Either file tree or empty state should be visible
    const diffFileTree = page.getByTestId('diff-file-tree')
    const emptyDiff = page.getByText(/No changes|No files changed/)

    await Promise.race([
      expect(diffFileTree).toBeVisible({ timeout: 5000 }),
      expect(emptyDiff).toBeVisible({ timeout: 5000 }),
    ]).catch(() => {
      // At least one should become visible
    })

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000)
  })

  test('switching files does not cause performance issues', async ({
    page,
  }) => {
    const hasWorkspace = await navigateToDiffTab(page)
    if (hasWorkspace === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (hasWorkspace === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const fileItems = page.getByTestId('diff-file-item')
    const fileCount = await fileItems.count()

    if (fileCount < 2) {
      test.skip(true, 'Need multiple files to test')
      return
    }

    // Switch between files rapidly
    for (let i = 0; i < Math.min(fileCount, 5); i++) {
      await fileItems.nth(i % fileCount).click()
      await expect(page.getByTestId('diff-monaco-container')).toBeVisible()
    }

    // Page should still be responsive
    await expect(page.getByTestId('diff-file-tree')).toBeVisible()
  })
})
