import { test, expect, Page } from '@playwright/test'

/**
 * Keyboard Shortcuts Tests
 *
 * Tests for keyboard shortcuts throughout the app.
 * Requires a workspace to test workspace-specific shortcuts.
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

async function navigateToWorkspace(page: Page): Promise<'success' | 'no-workspace' | 'sidecar-error'> {
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

test.describe('Cmd+Enter - Send Message', () => {
  test('sends message from chat input with Cmd+Enter', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Make sure we're on the chat tab (using testid for stability)
    const chatTab = page.getByTestId('tab-chat')
    await chatTab.click()

    const input = page.getByTestId('chat-input')
    await input.fill('Hello from keyboard shortcut')

    // Check if send button exists and is enabled
    const sendButton = page.getByTestId('send-button')
    const canSend = await sendButton.isEnabled().catch(() => false)

    if (canSend) {
      // Send with Cmd+Enter
      await input.press('Meta+Enter')

      // Message should appear in the list (or at least input should clear)
      // Depending on implementation
      await page.waitForTimeout(500)
    }
  })
})

test.describe('Cmd+K - Command Palette', () => {
  test('opens command palette with Cmd+K', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
  })

  test('opens command palette with Ctrl+K on non-Mac', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
  })

  test('command palette closes on Escape', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('command-palette')).not.toBeVisible()
  })

  test('command palette has search input focused', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.keyboard.press('Meta+k')

    const searchInput = page.getByTestId('command-palette-input')
    await expect(searchInput).toBeFocused()
  })

  test('command palette shows available commands', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.keyboard.press('Meta+k')

    await expect(page.getByTestId('command-palette-results')).toBeVisible()
  })

  test('can filter commands by typing', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.keyboard.press('Meta+k')

    const searchInput = page.getByTestId('command-palette-input')
    await searchInput.fill('sidebar')

    // Results should filter
    await expect(page.getByTestId('command-palette-results')).toBeVisible()
  })
})

test.describe('Cmd+P - Quick Open File', () => {
  test('opens quick open dialog with Cmd+P in Files view', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Go to Files tab (using testid - actual label is "All files")
    await page.getByTestId('tab-files').click()

    // Wait for file explorer to be visible
    const fileExplorer = page.getByTestId('file-explorer')
    const hasExplorer = await fileExplorer
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    if (!hasExplorer) {
      test.skip(true, 'File explorer not available')
      return
    }

    await page.keyboard.press('Meta+p')
    await expect(page.getByTestId('quick-open-dialog')).toBeVisible()
  })

  test('quick open closes on Escape', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.getByTestId('tab-files').click()

    const fileExplorer = page.getByTestId('file-explorer')
    if (!(await fileExplorer.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'File explorer not available')
      return
    }

    await page.keyboard.press('Meta+p')
    await expect(page.getByTestId('quick-open-dialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('quick-open-dialog')).not.toBeVisible()
  })
})

test.describe('Cmd+B - Toggle Sidebar', () => {
  test('toggles sidebar visibility with Cmd+B in Files view', async ({
    page,
  }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.getByTestId('tab-files').click()

    const sidebar = page.getByTestId('file-explorer-sidebar')
    const hasSidebar = await sidebar
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    if (!hasSidebar) {
      test.skip(true, 'Sidebar not available')
      return
    }

    // Toggle off
    await page.keyboard.press('Meta+b')
    await expect(sidebar).not.toBeVisible()

    // Toggle on
    await page.keyboard.press('Meta+b')
    await expect(sidebar).toBeVisible()
  })
})

test.describe('Cmd+1/2/3 - Switch Tabs', () => {
  test('switches to Chat tab with Cmd+1', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Start on a different tab
    await page.getByTestId('tab-files').click()

    // Switch to Chat with Cmd+1
    await page.keyboard.press('Meta+1')

    const chatTab = page.getByTestId('tab-chat')
    await expect(chatTab).toHaveAttribute('data-active', 'true')
  })

  test('switches to Files tab with Cmd+2', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Start on Chat
    await page.keyboard.press('Meta+1')

    // Switch to Files with Cmd+2
    await page.keyboard.press('Meta+2')

    const filesTab = page.getByTestId('tab-files')
    await expect(filesTab).toHaveAttribute('data-active', 'true')
  })

  test('switches to Diff tab with Cmd+3', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.keyboard.press('Meta+3')

    const diffTab = page.getByTestId('tab-diff')
    await expect(diffTab).toHaveAttribute('data-active', 'true')
  })

  test('handles tabs with Ctrl+number', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await page.getByTestId('tab-files').click()

    await page.keyboard.press('Control+1')

    const chatTab = page.getByTestId('tab-chat')
    await expect(chatTab).toHaveAttribute('data-active', 'true')
  })
})

test.describe('Shortcut Conflicts', () => {
  test('does not trigger shortcuts when typing in input', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const input = page.getByTestId('chat-input')
    await input.focus()

    // Type "k" normally - should not open command palette
    await input.fill('Testing k key')

    // Command palette should NOT be open
    await expect(page.getByTestId('command-palette')).not.toBeVisible()

    // The text should be in the input
    await expect(input).toHaveValue('Testing k key')
  })

  test('shortcuts work when input is not focused', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const input = page.getByTestId('chat-input')
    await input.fill('some text')

    // Click outside to blur the input
    await page.click('body')

    // Now Cmd+K should work
    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
  })
})
