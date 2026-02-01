import { test, expect, Page } from '@playwright/test'

/**
 * File Opening Tests
 *
 * Tests that clicking files in the diff view and file explorer
 * opens them in editor tabs.
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
 * Navigate to workspace and wait for it to load
 */
async function navigateToWorkspace(
  page: Page
): Promise<'success' | 'no-workspace' | 'sidecar-error'> {
  await page.goto('/')
  const loaded = await waitForPageLoad(page)
  if (!loaded) {
    return 'sidecar-error'
  }

  // Worktree rows are Links (rendered as <a>) that navigate to /workspace/$id
  const worktreeLinks = page.locator('a[href*="/workspace/"]')

  const count = await worktreeLinks.count()
  if (count === 0) {
    return 'no-workspace'
  }

  await worktreeLinks.first().click()
  await expect(page).toHaveURL(/\/workspace\//)

  return 'success'
}

test.describe('File Opening from Diff View', () => {
  test('clicking a file in Changes tab opens it in an editor tab', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Navigate to Changes tab in right sidebar
    const changesTab = page.getByTestId('right-tab-changes')
    await changesTab.click()
    await expect(changesTab).toHaveAttribute('data-active', 'true')

    // Wait for diff view to load
    const diffContainer = page.getByTestId('diff-view-container')
    const hasContainer = await diffContainer.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasContainer) {
      // No diff container means no changes - skip test
      test.skip(true, 'No changes in workspace to test')
      return
    }

    // Find a file row that is NOT deleted (we can click on added or modified files)
    const fileRows = page.locator('[data-testid^="diff-file-"]').filter({
      has: page.locator('[data-file-status]:not([data-file-status="deleted"])'),
    })

    // If no clickable files, look for any file row
    let targetFile = fileRows.first()
    if ((await fileRows.count()) === 0) {
      // Try finding any file row
      targetFile = page.locator('[data-testid^="diff-file-"]').first()
    }

    if (!(await targetFile.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No files in diff view to test')
      return
    }

    // Get the filename from the test ID (e.g., "diff-file-new-feature-ts" -> "new-feature-ts")
    const testId = await targetFile.getAttribute('data-testid')
    const filenamePart = testId?.replace('diff-file-', '') ?? ''

    // Click the file
    await targetFile.click()

    // Wait for editor tab to appear
    // Editor tab testid is like "editor-tab-new-feature-ts"
    const editorTab = page.getByTestId(`editor-tab-${filenamePart}`)
    await expect(editorTab).toBeVisible({ timeout: 5000 })
  })

  test('clicking a deleted file does not open an editor tab', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Navigate to Changes tab
    await page.getByTestId('right-tab-changes').click()

    // Find a deleted file row
    const deletedFile = page.locator('[data-file-status="deleted"]').first()

    if (!(await deletedFile.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No deleted files to test')
      return
    }

    // Count current editor tabs
    const initialTabCount = await page.locator('[data-testid^="editor-tab-"]').count()

    // Click the deleted file
    await deletedFile.click()

    // Wait a moment and verify no new tab was opened
    await page.waitForTimeout(500)
    const finalTabCount = await page.locator('[data-testid^="editor-tab-"]').count()

    expect(finalTabCount).toBe(initialTabCount)
  })

  test('clicking multiple files opens multiple tabs', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Navigate to Changes tab
    await page.getByTestId('right-tab-changes').click()

    // Find clickable files (not deleted)
    const fileRows = page.locator('[data-testid^="diff-file-"]:not([data-file-status="deleted"])')
    const fileCount = await fileRows.count()

    if (fileCount < 2) {
      test.skip(true, 'Need at least 2 files to test multiple tabs')
      return
    }

    // Click first file
    await fileRows.nth(0).click()
    await page.waitForTimeout(300)

    // Click second file
    await fileRows.nth(1).click()
    await page.waitForTimeout(300)

    // Verify we have 2 editor tabs
    const tabCount = await page.locator('[data-testid^="editor-tab-"]').count()
    expect(tabCount).toBeGreaterThanOrEqual(2)
  })
})

test.describe('File Opening from All Files', () => {
  test('clicking a file in All Files tab opens it in an editor tab', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Navigate to All Files tab in right sidebar
    const filesTab = page.getByTestId('right-tab-files')
    await filesTab.click()
    await expect(filesTab).toHaveAttribute('data-active', 'true')

    // Wait for file explorer to load
    const fileExplorer = page.getByTestId('file-explorer')
    await expect(fileExplorer).toBeVisible({ timeout: 5000 })

    // Find a file (not a directory) in the tree
    // File tree items have data-testid="file-item" and type indication
    const fileItems = page.locator('[data-testid="file-item"][data-type="file"]')

    if ((await fileItems.count()) === 0) {
      // Try to expand a directory first
      const dirItems = page.locator('[data-testid="file-item"][data-type="directory"]')
      if ((await dirItems.count()) > 0) {
        await dirItems.first().click()
        await page.waitForTimeout(500)
      }
    }

    // Now look for files again
    const visibleFiles = page.locator('[data-testid="file-item"][data-type="file"]')
    if ((await visibleFiles.count()) === 0) {
      test.skip(true, 'No files visible in file explorer')
      return
    }

    // Get filename for verification
    const firstFile = visibleFiles.first()
    const fileName = await firstFile.locator('span').last().textContent()

    // Click the file
    await firstFile.click()

    // Verify editor tab appears - normalize filename to match testid format
    const normalizedName = fileName?.replace(/\./g, '-').toLowerCase() ?? ''
    const editorTab = page.getByTestId(`editor-tab-${normalizedName}`)
    await expect(editorTab).toBeVisible({ timeout: 5000 })
  })

  test('clicking same file twice does not duplicate tab', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Navigate to All Files tab
    await page.getByTestId('right-tab-files').click()

    // Wait for file explorer
    await expect(page.getByTestId('file-explorer')).toBeVisible({ timeout: 5000 })

    // Find a file
    const fileItems = page.locator('[data-testid="file-item"][data-type="file"]')
    if ((await fileItems.count()) === 0) {
      test.skip(true, 'No files in file explorer')
      return
    }

    const firstFile = fileItems.first()

    // Click the file twice
    await firstFile.click()
    await page.waitForTimeout(300)

    const tabCountAfterFirst = await page.locator('[data-testid^="editor-tab-"]').count()

    await firstFile.click()
    await page.waitForTimeout(300)

    const tabCountAfterSecond = await page.locator('[data-testid^="editor-tab-"]').count()

    // Should still have the same number of tabs
    expect(tabCountAfterSecond).toBe(tabCountAfterFirst)
  })
})
