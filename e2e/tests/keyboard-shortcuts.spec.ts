import { test, expect } from './fixtures'

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workspace with mock mode for E2E tests
    await page.goto('http://localhost:1420/workspace/test-workspace?mock=true')
  })

  test.describe('Cmd+Enter - Send Message', () => {
    test('sends message from chat input with Cmd+Enter', async ({ page }) => {
      // Make sure we're on the chat tab
      const chatTab = page.getByRole('button', { name: 'Chat' })
      await chatTab.click()

      // Type a message
      const input = page.getByTestId('chat-input')
      await input.fill('Hello from keyboard shortcut')

      // Send with Cmd+Enter
      await input.press('Meta+Enter')

      // Message should appear in the list
      await expect(page.getByTestId('message-list')).toContainText(
        'Hello from keyboard shortcut'
      )
    })

    test('sends message with Ctrl+Enter on non-Mac', async ({ page }) => {
      const input = page.getByTestId('chat-input')
      await input.fill('Hello from Ctrl+Enter')

      // Send with Ctrl+Enter (for Windows/Linux)
      await input.press('Control+Enter')

      await expect(page.getByTestId('message-list')).toContainText(
        'Hello from Ctrl+Enter'
      )
    })
  })

  test.describe('Cmd+K - Command Palette', () => {
    test('opens command palette with Cmd+K', async ({ page }) => {
      // Press Cmd+K
      await page.keyboard.press('Meta+k')

      // Command palette should appear
      await expect(page.getByTestId('command-palette')).toBeVisible()
    })

    test('opens command palette with Ctrl+K on non-Mac', async ({ page }) => {
      await page.keyboard.press('Control+k')
      await expect(page.getByTestId('command-palette')).toBeVisible()
    })

    test('command palette closes on Escape', async ({ page }) => {
      // Open command palette
      await page.keyboard.press('Meta+k')
      await expect(page.getByTestId('command-palette')).toBeVisible()

      // Close with Escape
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('command-palette')).not.toBeVisible()
    })

    test('command palette has search input focused', async ({ page }) => {
      await page.keyboard.press('Meta+k')

      const searchInput = page.getByTestId('command-palette-input')
      await expect(searchInput).toBeFocused()
    })

    test('command palette shows available commands', async ({ page }) => {
      await page.keyboard.press('Meta+k')

      // Should show various commands
      await expect(page.getByTestId('command-palette-results')).toBeVisible()
      await expect(
        page.getByRole('option', { name: /Quick Open File/i })
      ).toBeVisible()
      await expect(
        page.getByRole('option', { name: /Toggle Sidebar/i })
      ).toBeVisible()
    })

    test('can filter commands by typing', async ({ page }) => {
      await page.keyboard.press('Meta+k')

      const searchInput = page.getByTestId('command-palette-input')
      await searchInput.fill('sidebar')

      // Should filter to sidebar-related commands
      await expect(
        page.getByRole('option', { name: /Toggle Sidebar/i })
      ).toBeVisible()
    })

    test('executes command on Enter', async ({ page }) => {
      await page.keyboard.press('Meta+k')

      const searchInput = page.getByTestId('command-palette-input')
      await searchInput.fill('quick open')

      // Press Enter to execute
      await page.keyboard.press('Enter')

      // Command palette should close and Quick Open should open
      await expect(page.getByTestId('command-palette')).not.toBeVisible()
      await expect(page.getByTestId('quick-open-dialog')).toBeVisible()
    })
  })

  test.describe('Cmd+P - Quick Open File', () => {
    test('opens quick open dialog with Cmd+P', async ({ page }) => {
      // First go to Files tab to ensure file explorer is available
      await page.getByRole('button', { name: 'Files' }).click()
      await expect(page.getByTestId('file-explorer')).toBeVisible()

      await page.keyboard.press('Meta+p')
      await expect(page.getByTestId('quick-open-dialog')).toBeVisible()
    })

    test('quick open works from any tab', async ({ page }) => {
      // Stay on chat tab
      await expect(page.getByTestId('agent-chat-container')).toBeVisible()

      // Open quick open
      await page.keyboard.press('Meta+p')
      await expect(page.getByTestId('quick-open-dialog')).toBeVisible()
    })

    test('quick open closes on Cmd+P again (toggle)', async ({ page }) => {
      await page.keyboard.press('Meta+p')
      await expect(page.getByTestId('quick-open-dialog')).toBeVisible()

      // Press again to close
      await page.keyboard.press('Meta+p')
      await expect(page.getByTestId('quick-open-dialog')).not.toBeVisible()
    })
  })

  test.describe('Cmd+B - Toggle Sidebar', () => {
    test('toggles sidebar visibility with Cmd+B', async ({ page }) => {
      // Go to Files tab to have a sidebar
      await page.getByRole('button', { name: 'Files' }).click()
      await expect(page.getByTestId('file-explorer')).toBeVisible()

      // Sidebar should be visible initially
      const sidebar = page.getByTestId('file-explorer-sidebar')
      await expect(sidebar).toBeVisible()

      // Toggle sidebar off
      await page.keyboard.press('Meta+b')
      await expect(sidebar).not.toBeVisible()

      // Toggle sidebar back on
      await page.keyboard.press('Meta+b')
      await expect(sidebar).toBeVisible()
    })

    test('toggles sidebar with Ctrl+B on non-Mac', async ({ page }) => {
      await page.getByRole('button', { name: 'Files' }).click()
      const sidebar = page.getByTestId('file-explorer-sidebar')
      await expect(sidebar).toBeVisible()

      await page.keyboard.press('Control+b')
      await expect(sidebar).not.toBeVisible()
    })
  })

  test.describe('Cmd+1/2/3 - Switch Tabs', () => {
    test('switches to Chat tab with Cmd+1', async ({ page }) => {
      // Start on a different tab
      await page.getByRole('button', { name: 'Files' }).click()
      await expect(page.getByTestId('file-explorer')).toBeVisible()

      // Switch to Chat with Cmd+1
      await page.keyboard.press('Meta+1')

      // Chat tab should be active
      const chatTab = page.getByRole('button', { name: 'Chat' })
      await expect(chatTab).toHaveClass(/border-primary/)
      await expect(page.getByTestId('agent-chat-container')).toBeVisible()
    })

    test('switches to Files tab with Cmd+2', async ({ page }) => {
      // Start on Chat tab
      await expect(page.getByTestId('agent-chat-container')).toBeVisible()

      // Switch to Files with Cmd+2
      await page.keyboard.press('Meta+2')

      // Files tab should be active
      const filesTab = page.getByRole('button', { name: 'Files' })
      await expect(filesTab).toHaveClass(/border-primary/)
      await expect(page.getByTestId('file-explorer')).toBeVisible()
    })

    test('switches to Diff tab with Cmd+3', async ({ page }) => {
      await page.keyboard.press('Meta+3')

      // Diff tab should be active
      const diffTab = page.getByRole('button', { name: 'Diff' })
      await expect(diffTab).toHaveClass(/border-primary/)
    })

    test('handles tabs with Ctrl+number on non-Mac', async ({ page }) => {
      await page.getByRole('button', { name: 'Files' }).click()

      await page.keyboard.press('Control+1')

      const chatTab = page.getByRole('button', { name: 'Chat' })
      await expect(chatTab).toHaveClass(/border-primary/)
    })

    test('ignores out-of-bounds tab numbers', async ({ page }) => {
      // Start on Chat tab
      const chatTab = page.getByRole('button', { name: 'Chat' })
      await expect(chatTab).toHaveClass(/border-primary/)

      // Try to switch to tab 9 (doesn't exist)
      await page.keyboard.press('Meta+9')

      // Should stay on Chat tab
      await expect(chatTab).toHaveClass(/border-primary/)
    })
  })

  test.describe('Shortcut Hints', () => {
    test('shows keyboard shortcut hints in UI', async ({ page }) => {
      // Check that the chat input shows shortcut hint
      const hintText = page.getByText(/Enter.*to send/)
      await expect(hintText).toBeVisible()
    })

    test('command palette shows shortcuts for commands', async ({ page }) => {
      await page.keyboard.press('Meta+k')

      // Commands should show their shortcuts
      const quickOpenCommand = page.getByRole('option', {
        name: /Quick Open File/i,
      })
      await expect(quickOpenCommand).toContainText(/P/i) // Shows Cmd+P hint
    })
  })

  test.describe('Shortcut Conflicts', () => {
    test('does not trigger shortcuts when typing in input', async ({
      page,
    }) => {
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
      const input = page.getByTestId('chat-input')
      await input.fill('some text')

      // Click outside to blur the input
      await page.click('body')

      // Now Cmd+K should work
      await page.keyboard.press('Meta+k')
      await expect(page.getByTestId('command-palette')).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('shortcuts are documented in help', async ({ page }) => {
      // Open command palette
      await page.keyboard.press('Meta+k')

      // Type "help" or "shortcuts"
      const searchInput = page.getByTestId('command-palette-input')
      await searchInput.fill('keyboard')

      // Should show keyboard shortcuts help
      await expect(
        page.getByRole('option', { name: /Keyboard Shortcuts/i })
      ).toBeVisible()
    })
  })
})
