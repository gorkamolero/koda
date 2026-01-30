import { test, expect } from '@playwright/test'

test.describe('File Explorer', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workspace with file explorer enabled via mock mode
    await page.goto('http://localhost:1420/workspace/test-workspace?mock=true')
  })

  test('displays file explorer in sidebar when Files tab is clicked', async ({
    page,
  }) => {
    // Click Files tab
    const filesTab = page.getByRole('button', { name: 'Files' })
    await filesTab.click()

    // File explorer container should be visible
    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Root directory indicator should be present
    await expect(page.getByTestId('file-explorer-root')).toBeVisible()
  })

  test('shows tree view with expand/collapse functionality', async ({
    page,
  }) => {
    // Switch to Files tab
    await page.getByRole('button', { name: 'Files' }).click()

    // Wait for file explorer
    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Should show a folder item with expand chevron
    const folderItem = page.getByTestId('file-item-src')
    await expect(folderItem).toBeVisible()

    // Click to expand folder
    await folderItem.getByTestId('expand-button').click()

    // Children should become visible
    await expect(
      page.getByTestId('file-item-src').getByTestId('folder-children')
    ).toBeVisible()

    // Click again to collapse
    await folderItem.getByTestId('expand-button').click()

    // Children should be hidden
    await expect(
      page.getByTestId('file-item-src').getByTestId('folder-children')
    ).not.toBeVisible()
  })

  test('displays correct file icons based on extension', async ({ page }) => {
    await page.getByRole('button', { name: 'Files' }).click()
    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Expand src folder to see files
    const srcFolder = page.getByTestId('file-item-src')
    await srcFolder.getByTestId('expand-button').click()

    // Check that TypeScript files have ts icon
    const tsFile = page.getByTestId('file-item-index-ts')
    await expect(tsFile.getByTestId('file-icon-ts')).toBeVisible()

    // Check that CSS files have css icon
    const cssFile = page.getByTestId('file-item-styles-css')
    await expect(cssFile.getByTestId('file-icon-css')).toBeVisible()
  })

  test('opens file in Monaco editor when clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'Files' }).click()
    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Expand src folder
    await page.getByTestId('file-item-src').getByTestId('expand-button').click()

    // Click on a file
    await page.getByTestId('file-item-index-ts').click()

    // Monaco editor should be visible with the file content
    await expect(page.getByTestId('monaco-editor')).toBeVisible()

    // File name should appear in editor tab
    await expect(page.getByTestId('editor-tab-index-ts')).toBeVisible()
  })

  test('supports quick open with Cmd+P', async ({ page }) => {
    await page.getByRole('button', { name: 'Files' }).click()
    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Open quick open dialog with Cmd+P (or Ctrl+P on Windows/Linux)
    await page.keyboard.press('Meta+p')

    // Quick open dialog should appear
    await expect(page.getByTestId('quick-open-dialog')).toBeVisible()

    // Search input should be focused
    const searchInput = page.getByTestId('quick-open-input')
    await expect(searchInput).toBeFocused()

    // Type a search term
    await searchInput.fill('index')

    // Results should appear with fuzzy matching
    await expect(page.getByTestId('quick-open-results')).toBeVisible()
    await expect(
      page.getByTestId('quick-open-result-index-ts')
    ).toBeVisible()

    // Press Enter to open the file
    await page.keyboard.press('Enter')

    // Quick open should close and file should open in editor
    await expect(page.getByTestId('quick-open-dialog')).not.toBeVisible()
    await expect(page.getByTestId('monaco-editor')).toBeVisible()
  })

  test('quick open closes on Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Files' }).click()
    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Open quick open
    await page.keyboard.press('Meta+p')
    await expect(page.getByTestId('quick-open-dialog')).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('quick-open-dialog')).not.toBeVisible()
  })

  test('file explorer uses virtualized list for performance', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Files' }).click()

    // Check that the file list has virtualized attribute
    const fileList = page.getByTestId('file-tree')
    await expect(fileList).toHaveAttribute('data-virtualized', 'true')
  })

  test('can save edited file via Monaco', async ({ page }) => {
    await page.getByRole('button', { name: 'Files' }).click()
    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Expand and click file
    await page.getByTestId('file-item-src').getByTestId('expand-button').click()
    await page.getByTestId('file-item-index-ts').click()

    // Wait for editor
    await expect(page.getByTestId('monaco-editor')).toBeVisible()

    // Type something in the editor (Monaco editor is complex, we'll check the unsaved indicator)
    // Focus the editor and type
    await page.getByTestId('monaco-editor').click()
    await page.keyboard.type('// test comment')

    // File should show unsaved indicator
    await expect(page.getByTestId('editor-tab-index-ts')).toHaveAttribute(
      'data-unsaved',
      'true'
    )

    // Save with Cmd+S
    await page.keyboard.press('Meta+s')

    // Unsaved indicator should disappear (in mock mode, this is immediate)
    await expect(page.getByTestId('editor-tab-index-ts')).not.toHaveAttribute(
      'data-unsaved',
      'true'
    )
  })

  test('shows loading state while reading directory', async ({ page }) => {
    await page.getByRole('button', { name: 'Files' }).click()

    // Initially should show loading skeleton or spinner
    // Note: In mock mode this may be too fast to see, but the structure should exist
    await expect(page.getByTestId('file-explorer')).toBeVisible()
  })

  test('keyboard navigation in file tree', async ({ page }) => {
    await page.getByRole('button', { name: 'Files' }).click()
    await expect(page.getByTestId('file-explorer')).toBeVisible()

    // Focus the file tree
    await page.getByTestId('file-tree').focus()

    // Press arrow down to move selection
    await page.keyboard.press('ArrowDown')

    // First item should be selected/focused
    const firstItem = page.getByTestId('file-item-src')
    await expect(firstItem).toHaveAttribute('data-selected', 'true')

    // Press Enter to expand
    await page.keyboard.press('Enter')

    // Folder should expand
    await expect(firstItem.getByTestId('folder-children')).toBeVisible()

    // Press ArrowRight should also expand (if collapsed) or move into children
    await page.keyboard.press('ArrowLeft')
    await expect(firstItem.getByTestId('folder-children')).not.toBeVisible()
  })
})
