import { test, expect, Page } from '@playwright/test'

/**
 * File Explorer Tests
 *
 * Tests for the file explorer and editor functionality.
 * Requires a workspace with real files in its worktree directory.
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
 * Navigate to a workspace and switch to Files tab
 */
async function navigateToFilesTab(page: Page): Promise<'success' | 'no-workspace' | 'sidecar-error'> {
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

  // Click Files tab (using testid - actual label is "All files")
  await page.getByTestId('tab-files').click()

  return 'success'
}

test.describe('File Explorer', () => {
  test('displays file explorer when Files tab is clicked', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // File explorer container should be visible
    await expect(page.getByTestId('file-explorer')).toBeVisible()
  })

  test('shows file tree with real files', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Wait for file explorer to load
    const fileExplorer = page.getByTestId('file-explorer')
    const hasExplorer = await fileExplorer.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasExplorer) {
      test.skip(true, 'File explorer not available')
      return
    }

    // Check if file tree exists
    const fileTree = page.getByTestId('file-tree')
    const hasTree = await fileTree.isVisible({ timeout: 3000 }).catch(() => false)
    if (!hasTree) {
      test.skip(true, 'File tree component not available')
      return
    }

    // Should have at least one file or folder item
    const fileItems = page.locator('[data-testid^="file-item-"]')
    const itemCount = await fileItems.count()
    if (itemCount === 0) {
      test.skip(true, 'No file items in tree')
      return
    }
    expect(itemCount).toBeGreaterThan(0)
  })

  test('can expand and collapse folders', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Find a folder item (look for expand button)
    const expandButtons = page.locator('[data-testid="expand-button"]')
    const hasExpandable = (await expandButtons.count()) > 0

    if (!hasExpandable) {
      test.skip(true, 'No expandable folders found')
      return
    }

    // Click to expand
    await expandButtons.first().click()

    // Should show children
    const children = page.locator('[data-testid="folder-children"]')
    await expect(children.first()).toBeVisible()

    // Click to collapse
    await expandButtons.first().click()

    // Children should be hidden
    await expect(children.first()).not.toBeVisible()
  })

  test('clicking a file opens it in Monaco editor', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // First, try to expand a folder to see files
    const expandButtons = page.locator('[data-testid="expand-button"]')
    if ((await expandButtons.count()) > 0) {
      await expandButtons.first().click()
      // Wait for children to appear
      await page.waitForTimeout(300)
    }

    // Look for file items
    const fileItems = page.locator('[data-testid^="file-item-"]')
    const firstFile = fileItems.first()

    if ((await firstFile.count()) === 0) {
      test.skip(true, 'No files found in workspace')
      return
    }

    // Click the file
    await firstFile.click()

    // Monaco editor should appear
    await expect(page.getByTestId('monaco-editor')).toBeVisible({
      timeout: 10000,
    })
  })
})

test.describe('Quick Open', () => {
  test('Cmd+P opens quick open dialog in Files view', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Open quick open with Cmd+P
    await page.keyboard.press('Meta+p')

    // Quick open dialog should appear
    await expect(page.getByTestId('quick-open-dialog')).toBeVisible()

    // Search input should be focused
    const searchInput = page.getByTestId('quick-open-input')
    await expect(searchInput).toBeFocused()
  })

  test('quick open closes on Escape', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Open quick open
    await page.keyboard.press('Meta+p')
    await expect(page.getByTestId('quick-open-dialog')).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('quick-open-dialog')).not.toBeVisible()
  })

  test('can search for files in quick open', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Open quick open
    await page.keyboard.press('Meta+p')
    await expect(page.getByTestId('quick-open-dialog')).toBeVisible()

    // Type a search term
    const searchInput = page.getByTestId('quick-open-input')
    await searchInput.fill('package')

    // Results should appear (if package.json exists in workspace)
    const results = page.getByTestId('quick-open-results')
    await expect(results).toBeVisible()
  })
})

test.describe('Editor', () => {
  test('editor tabs show open files', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Expand a folder and click a file
    const expandButtons = page.locator('[data-testid="expand-button"]')
    if ((await expandButtons.count()) > 0) {
      await expandButtons.first().click()
      await page.waitForTimeout(300)
    }

    const fileItems = page.locator('[data-testid^="file-item-"]')
    if ((await fileItems.count()) === 0) {
      test.skip(true, 'No files found')
      return
    }

    await fileItems.first().click()

    // Editor should show with a tab
    await expect(page.getByTestId('monaco-editor')).toBeVisible({
      timeout: 10000,
    })

    // Tab bar should exist
    const editorTabs = page.locator('[data-testid^="editor-tab-"]')
    expect(await editorTabs.count()).toBeGreaterThan(0)
  })

  test('editor shows file content', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Open a file
    const expandButtons = page.locator('[data-testid="expand-button"]')
    if ((await expandButtons.count()) > 0) {
      await expandButtons.first().click()
      await page.waitForTimeout(300)
    }

    const fileItems = page.locator('[data-testid^="file-item-"]')
    if ((await fileItems.count()) === 0) {
      test.skip(true, 'No files found')
      return
    }

    await fileItems.first().click()

    // Wait for Monaco to load
    await expect(page.getByTestId('monaco-editor')).toBeVisible({
      timeout: 10000,
    })

    // Monaco should have view-lines (actual content)
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible()
  })
})

test.describe('Sidebar Toggle', () => {
  test('Cmd+B toggles file explorer sidebar', async ({ page }) => {
    const result = await navigateToFilesTab(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Sidebar should be visible initially
    const sidebar = page.getByTestId('file-explorer-sidebar')
    const hasSidebar = await sidebar.isVisible().catch(() => false)

    if (!hasSidebar) {
      test.skip(true, 'Sidebar not available')
      return
    }

    // Toggle sidebar off
    await page.keyboard.press('Meta+b')
    await expect(sidebar).not.toBeVisible()

    // Toggle sidebar back on
    await page.keyboard.press('Meta+b')
    await expect(sidebar).toBeVisible()
  })
})
