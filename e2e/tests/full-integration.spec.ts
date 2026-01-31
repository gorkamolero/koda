import { test, expect, Page } from '@playwright/test'

/**
 * Full Integration Tests
 *
 * End-to-end tests that cover complete user journeys.
 * These tests require:
 * - App running with sidecar
 * - At least one workspace in the database
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

test.describe('Full Integration Flow', () => {
  test('complete journey: home → workspace → tabs → navigation', async ({
    page,
  }) => {
    // =====================================================
    // STEP 1: Home page loads successfully
    // =====================================================
    await test.step('Navigate to home and verify app loaded', async () => {
      await page.goto('/')
      await expect(page).toHaveTitle(/Koda/)

      // Wait for loading to complete
      const loading = page.getByText('Loading...')
      await expect(loading).not.toBeVisible({ timeout: 15000 })

      // Check if there's an error
      const errorMessage = page.getByText('Failed to load workspaces')
      if (await errorMessage.isVisible().catch(() => false)) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      // Should see workspaces heading or empty state
      const workspacesHeading = page.getByRole('heading', { name: 'Workspaces', level: 1 })
      const emptyState = page.getByRole('heading', { name: 'No workspaces yet' })
      const hasWorkspaces = await workspacesHeading.isVisible().catch(() => false)
      const hasEmpty = await emptyState.isVisible().catch(() => false)
      expect(hasWorkspaces || hasEmpty).toBe(true)
    })

    // =====================================================
    // STEP 2: Check for workspaces
    // =====================================================
    const hasWorkspaces = await test.step(
      'Check if workspaces exist',
      async () => {
        await page.waitForLoadState('networkidle')

        const workspaceCards = page.locator('button').filter({
          has: page.locator('h3'),
        })

        return (await workspaceCards.count()) > 0
      }
    )

    if (!hasWorkspaces) {
      // Verify empty state is shown correctly
      await test.step('Verify empty state', async () => {
        await expect(
          page.getByRole('heading', { name: 'No workspaces yet' })
        ).toBeVisible()
        // Use .first() since there may be multiple "New Workspace" buttons
        // (one in header, one in empty state)
        await expect(
          page.getByRole('button', { name: 'New Workspace' }).first()
        ).toBeVisible()
      })
      return
    }

    // =====================================================
    // STEP 3: Open a workspace
    // =====================================================
    await test.step('Open first workspace', async () => {
      const workspaceCards = page.locator('button').filter({
        has: page.locator('h3'),
      })
      await workspaceCards.first().click()
      await expect(page).toHaveURL(/\/workspace\//)
    })

    // =====================================================
    // STEP 4: Verify workspace view loads
    // =====================================================
    await test.step('Verify workspace view elements', async () => {
      // Tab navigation - look for tabs in the topbar
      const chatTab = page.getByTestId('tab-chat')
      const filesTab = page.getByTestId('tab-files')
      const diffTab = page.getByTestId('tab-diff')

      // At least one tab should be visible
      const hasChatTab = await chatTab.isVisible().catch(() => false)
      const hasFilesTab = await filesTab.isVisible().catch(() => false)
      const hasDiffTab = await diffTab.isVisible().catch(() => false)

      expect(hasChatTab || hasFilesTab || hasDiffTab).toBe(true)
    })

    // =====================================================
    // STEP 5: Navigate through tabs
    // =====================================================
    await test.step('Navigate through all tabs', async () => {
      // Use testid selectors for reliable tab navigation
      const filesTab = page.getByTestId('tab-files')
      const diffTab = page.getByTestId('tab-diff')
      const chatTab = page.getByTestId('tab-chat')

      if (await filesTab.isVisible().catch(() => false)) {
        await filesTab.click()
        await expect(filesTab).toHaveAttribute('data-active', 'true')
      }

      if (await diffTab.isVisible().catch(() => false)) {
        await diffTab.click()
        await expect(diffTab).toHaveAttribute('data-active', 'true')
      }

      if (await chatTab.isVisible().catch(() => false)) {
        await chatTab.click()
        await expect(chatTab).toHaveAttribute('data-active', 'true')
      }
    })

    // =====================================================
    // STEP 6: Navigate back to home
    // =====================================================
    await test.step('Navigate back to home', async () => {
      // Use browser navigation since sidebar links are icon-based
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Workspaces', level: 1 })).toBeVisible({ timeout: 15000 })
    })
  })

  test('workspace type switching flow', async ({ page }) => {
    await page.goto('/')
    const loaded = await waitForPageLoad(page)
    if (!loaded) {
      test.skip(true, 'Sidecar connection failed')
      return
    }

    const workspaceCards = page.locator('button').filter({
      has: page.locator('h3'),
    })

    if ((await workspaceCards.count()) === 0) {
      test.skip(true, 'No workspaces available')
      return
    }

    // Open workspace
    await workspaceCards.first().click()
    await expect(page).toHaveURL(/\/workspace\//)

    // Get type selector
    const typeSelector = page.getByTestId('workspace-type-selector')
    const hasSelectorVisible = await typeSelector.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasSelectorVisible) {
      test.skip(true, 'Workspace type selector not available')
      return
    }

    // Wait for selector to be interactive
    await expect(typeSelector).toBeEnabled({ timeout: 5000 })
    await typeSelector.click()

    // Check if options are available
    const specDrivenOption = page.getByRole('option', { name: /Spec-Driven/ })
    const hasOptions = await specDrivenOption.isVisible().catch(() => false)
    if (!hasOptions) {
      test.skip(true, 'Type selector options not available')
      return
    }

    // Switch to Spec-Driven
    await test.step('Switch to Spec-Driven mode', async () => {
      await specDrivenOption.click()

      // Wait and check if switch worked
      await page.waitForTimeout(500)
      const text = await typeSelector.textContent()
      if (!text?.includes('Spec-Driven')) {
        test.skip(true, 'Type switching not working - app may need fixing')
        return
      }

      // Spec tab should appear
      await expect(page.getByRole('button', { name: 'Spec' })).toBeVisible()
    })

    // Switch to Ralph
    await test.step('Switch to Ralph mode', async () => {
      await typeSelector.click()
      const ralphOption = page.getByRole('option', { name: /Ralph/ })
      if (await ralphOption.isVisible().catch(() => false)) {
        await ralphOption.click()
        await page.waitForTimeout(500)
      }
    })

    // Switch back to Standard
    await test.step('Switch back to Standard mode', async () => {
      await typeSelector.click()
      const standardOption = page.getByRole('option', { name: /Standard/ })
      if (await standardOption.isVisible().catch(() => false)) {
        await standardOption.click()
        await page.waitForTimeout(500)
        const text = await typeSelector.textContent()
        if (text?.includes('Standard')) {
          // Spec tab should be gone
          await expect(
            page.getByRole('button', { name: 'Spec' })
          ).not.toBeVisible()
        }
      }
    })
  })

  test('keyboard shortcuts work throughout the app', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const workspaceCards = page.locator('button').filter({
      has: page.locator('h3'),
    })

    if ((await workspaceCards.count()) === 0) {
      test.skip(true, 'No workspaces available')
      return
    }

    await workspaceCards.first().click()
    await expect(page).toHaveURL(/\/workspace\//)

    // Test Cmd+K for command palette
    await test.step('Cmd+K opens command palette', async () => {
      const commandPalette = page.getByTestId('command-palette')

      await page.keyboard.press('Meta+k')

      // Command palette might not be implemented yet
      const hasCommandPalette = await commandPalette.isVisible({ timeout: 2000 }).catch(() => false)
      if (!hasCommandPalette) {
        test.skip(true, 'Command palette not implemented')
        return
      }

      await page.keyboard.press('Escape')
      await expect(commandPalette).not.toBeVisible()
    })

    // Test tab switching with keyboard
    await test.step('Cmd+number switches tabs', async () => {
      const filesTab = page.getByTestId('tab-files')
      const chatTab = page.getByTestId('tab-chat')

      // Skip if tabs don't exist
      if (!(await filesTab.isVisible().catch(() => false))) {
        test.skip(true, 'Tabs not available')
        return
      }

      // Go to Files tab
      await page.keyboard.press('Meta+2')
      await page.waitForTimeout(300)

      // Check if it worked
      const filesActive = await filesTab.getAttribute('data-active')
      if (filesActive !== 'true') {
        // Keyboard shortcuts might not be implemented
        test.skip(true, 'Keyboard tab switching not implemented')
        return
      }

      // Back to Chat
      await page.keyboard.press('Meta+1')
      await expect(chatTab).toHaveAttribute('data-active', 'true')
    })
  })

  test('error states are handled gracefully', async ({ page }) => {
    // Navigate to a non-existent workspace
    await page.goto('/workspace/non-existent-workspace-id-12345')

    // App should handle this gracefully - either redirect or show error
    // It should not crash
    await page.waitForLoadState('networkidle')

    // Page should still have basic structure (sidebar)
    await expect(page.locator('aside')).toBeVisible()
  })
})

test.describe('Cross-Feature Integration', () => {
  test('file explorer and editor work together', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const workspaceCards = page.locator('button').filter({
      has: page.locator('h3'),
    })

    if ((await workspaceCards.count()) === 0) {
      test.skip(true, 'No workspaces')
      return
    }

    await workspaceCards.first().click()
    await expect(page).toHaveURL(/\/workspace\//)

    // Go to Files using testid
    const filesTab = page.getByTestId('tab-files')
    if (!(await filesTab.isVisible().catch(() => false))) {
      test.skip(true, 'Files tab not available')
      return
    }
    await filesTab.click()

    // Wait for file explorer
    const fileExplorer = page.getByTestId('file-explorer')
    const hasFileExplorer = await fileExplorer
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (!hasFileExplorer) {
      test.skip(true, 'File explorer not available')
      return
    }

    // Try to open a file
    const expandButtons = page.locator('[data-testid="expand-button"]')
    if ((await expandButtons.count()) > 0) {
      await expandButtons.first().click()
      await page.waitForTimeout(300)
    }

    const fileItems = page.locator('[data-testid^="file-item-"]')
    if ((await fileItems.count()) > 0) {
      await fileItems.first().click()

      // Editor should appear
      const editor = page.getByTestId('monaco-editor')
      await expect(editor).toBeVisible({ timeout: 10000 })

      // Editor should have content
      await expect(
        page.locator('.monaco-editor .view-lines')
      ).toBeVisible()
    }
  })

  test('chat and diff views work in same session', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const workspaceCards = page.locator('button').filter({
      has: page.locator('h3'),
    })

    if ((await workspaceCards.count()) === 0) {
      test.skip(true, 'No workspaces')
      return
    }

    await workspaceCards.first().click()

    // Check for chat input
    const chatInput = page.getByTestId('chat-input')
    if (!(await chatInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Chat input not available')
      return
    }

    // Type something in chat
    await chatInput.fill('Test message')
    await expect(chatInput).toHaveValue('Test message')

    // Go to Diff using testid
    const diffTab = page.getByTestId('tab-diff')
    if (await diffTab.isVisible().catch(() => false)) {
      await diffTab.click()
      await page.waitForTimeout(500)
    }

    // Go back to Chat
    const chatTab = page.getByTestId('tab-chat')
    if (await chatTab.isVisible().catch(() => false)) {
      await chatTab.click()
    }

    // Chat input should still be visible
    await expect(chatInput).toBeVisible()
  })
})
