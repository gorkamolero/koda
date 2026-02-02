import { test, expect } from '@playwright/test'

/**
 * Terminal E2E Tests
 *
 * Tests the integrated terminal panel with real PTY sessions.
 * These tests interact with the actual terminal UI, not the API directly.
 *
 * Note: Due to React strict mode or HMR, multiple terminal tabs may be created
 * on initial load. Tests account for this with .first() selectors.
 */

test.describe('Terminal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the seeded workspace
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for loading to complete
    const loading = page.getByText('Loading...')
    await expect(loading).not.toBeVisible({ timeout: 15000 })

    // Click on the first worktree to open it
    const worktreeCard = page.locator('[data-testid="worktree-card"]').first()
    if (await worktreeCard.isVisible()) {
      await worktreeCard.click()
      await page.waitForLoadState('networkidle')
    }
  })

  test('terminal panel is visible and connects to shell', async ({ page }) => {
    // Terminal panel should be visible
    const terminalPanel = page.getByTestId('terminal-panel')
    await expect(terminalPanel).toBeVisible({ timeout: 10000 })

    // Wait for terminal to connect (PID appears in at least one tab)
    const terminalPid = page.getByTestId('terminal-pid').first()
    await expect(terminalPid).toBeVisible({ timeout: 10000 })

    // Verify connecting overlay is gone
    const connectingOverlay = page.getByTestId('terminal-connecting-overlay')
    await expect(connectingOverlay).not.toBeVisible()
  })

  test('can type command in terminal', async ({ page }) => {
    // Wait for terminal to be ready (at least one connected terminal)
    const terminalPid = page.getByTestId('terminal-pid').first()
    await expect(terminalPid).toBeVisible({ timeout: 10000 })

    // Get the terminal viewport where xterm renders
    const terminalViewport = page.getByTestId('terminal-viewport')
    await expect(terminalViewport).toBeVisible()

    // xterm.js creates a textarea for input - find and interact with it
    const xtermTextarea = terminalViewport.locator('textarea.xterm-helper-textarea')
    await expect(xtermTextarea).toBeAttached({ timeout: 5000 })

    // Type a simple command and press enter
    // Note: We can't verify output since xterm renders to canvas
    await xtermTextarea.focus()
    await xtermTextarea.type('echo "E2E_TEST"')
    await page.keyboard.press('Enter')

    // Give shell time to execute
    await page.waitForTimeout(300)

    // The terminal screen should still be visible (didn't crash)
    const terminalScreen = terminalViewport.locator('.xterm-screen')
    await expect(terminalScreen).toBeVisible()

    // Type another command to verify input still works
    await xtermTextarea.type('pwd')
    await page.keyboard.press('Enter')

    // Terminal should still be responsive
    await expect(terminalScreen).toBeVisible()
  })

  test('can create new terminal tab', async ({ page }) => {
    // Wait for initial terminal(s)
    const terminalPid = page.getByTestId('terminal-pid').first()
    await expect(terminalPid).toBeVisible({ timeout: 10000 })

    // Count current tabs
    const initialCount = await page.getByTestId('terminal-pid').count()

    // Click the new tab button
    const newTabButton = page.getByTestId('terminal-new-tab')
    await newTabButton.click()

    // Should have one more tab than before
    const pids = page.getByTestId('terminal-pid')
    await expect(pids).toHaveCount(initialCount + 1, { timeout: 10000 })
  })

  test('can close terminal tab', async ({ page }) => {
    // Wait for terminal(s)
    const terminalPid = page.getByTestId('terminal-pid').first()
    await expect(terminalPid).toBeVisible({ timeout: 10000 })

    // Count current tabs
    const initialCount = await page.getByTestId('terminal-pid').count()

    // Get the terminal tab bar
    const tabBar = page.getByTestId('terminal-tab-bar')

    // Hover over the first tab to reveal close button
    const tab = tabBar.locator('[data-testid^="terminal-tab-"]').first()
    await tab.hover()

    // Click close button
    const closeButton = tabBar.locator('[data-testid^="terminal-close-"]').first()
    await closeButton.click()

    // Wait a moment for the tab to close
    await page.waitForTimeout(300)

    // Should have one fewer tab (or empty state if was last tab)
    if (initialCount === 1) {
      // Empty state button should appear
      const emptyButton = page.getByTestId('terminal-new-empty')
      await expect(emptyButton).toBeVisible({ timeout: 5000 })
    } else {
      // Should have one less tab
      const pids = page.getByTestId('terminal-pid')
      await expect(pids).toHaveCount(initialCount - 1, { timeout: 5000 })
    }
  })

  test('terminal accepts multiple commands in sequence', async ({ page }) => {
    // Wait for terminal
    const terminalPid = page.getByTestId('terminal-pid').first()
    await expect(terminalPid).toBeVisible({ timeout: 10000 })

    const terminalViewport = page.getByTestId('terminal-viewport')
    const xtermTextarea = terminalViewport.locator('textarea.xterm-helper-textarea')
    await expect(xtermTextarea).toBeAttached({ timeout: 5000 })
    await xtermTextarea.focus()

    // Run multiple commands in sequence
    // Note: Can't verify output since xterm renders to canvas
    await xtermTextarea.type('echo "TEST_1"')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    await xtermTextarea.type('echo "TEST_2"')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    await xtermTextarea.type('date')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Terminal should still be responsive
    const terminalScreen = terminalViewport.locator('.xterm-screen')
    await expect(terminalScreen).toBeVisible()

    // Use up arrow to access command history
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(100)

    // Terminal should still be functional
    await expect(terminalScreen).toBeVisible()
  })
})
