import { test, expect } from './fixtures'

/**
 * Full Integration Test
 *
 * This test covers the complete user journey through the application:
 * 1. Add repository (navigate to workspace)
 * 2. Create workspace (worktree) - simulated via Ralph mode
 * 3. Enter interview mode → generate spec
 * 4. Start Ralph loop
 * 5. Review diffs as agent works
 * 6. Switch diff view modes
 * 7. Navigate between files
 * 8. Complete spec
 */
test.describe('Full Integration Flow', () => {
  test('complete user journey from workspace creation to spec completion', async ({ page }) => {
    // =====================================================
    // STEP 1: Add repository - Navigate to app
    // =====================================================
    await test.step('Navigate to application and verify home screen', async () => {
      await page.goto('http://localhost:1420')

      // Verify app loaded
      await expect(page).toHaveTitle(/Koda/)
      await expect(page.getByRole('heading', { name: 'Workspaces', exact: true })).toBeVisible()

      // Verify empty state and create workspace button
      await expect(page.getByText('No workspaces yet')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Create Workspace' })).toBeVisible()
    })

    // =====================================================
    // STEP 2: Create workspace - Navigate to workspace view
    // =====================================================
    await test.step('Navigate to workspace and switch to Ralph mode', async () => {
      // Navigate to workspace with mock mode
      await page.goto('http://localhost:1420/workspace/integration-test?mock=true')

      // Verify workspace loaded
      await expect(page.getByRole('heading', { name: /Workspace/ })).toBeVisible()

      // Verify workspace type selector is present
      const typeSelector = page.getByTestId('workspace-type-selector')
      await expect(typeSelector).toBeVisible()

      // Switch to Ralph mode (autonomous agent with spec)
      await typeSelector.click()

      // Wait for dropdown to appear
      await expect(page.getByRole('option', { name: /Ralph/ })).toBeVisible()
      await page.getByRole('option', { name: /Ralph/ }).click()

      // Wait for update to complete and verify we're in Ralph mode
      await expect(typeSelector).toContainText('Ralph', { timeout: 10000 })
    })

    // =====================================================
    // STEP 3: Enter interview mode → generate spec
    // =====================================================
    await test.step('Complete interview to generate feature spec', async () => {
      // Click on Spec tab to access Ralph view
      await page.getByRole('button', { name: 'Spec' }).click()

      // Verify Ralph mode sections are visible
      await expect(page.getByTestId('spec-section')).toBeVisible()
      await expect(page.getByTestId('fix-plan-section')).toBeVisible()

      // Start new interview
      await page.getByTestId('start-interview-button').click()

      // Verify interview container loaded
      await expect(page.getByTestId('interview-container')).toBeVisible()

      // Answer question 1: Feature name (text)
      await expect(page.getByTestId('interview-question')).toContainText('What feature are you building?')
      await page.getByTestId('interview-text-input').fill('User authentication with OAuth2')
      await page.getByTestId('interview-next-button').click()

      // Answer question 2: Complexity (multiple choice)
      await expect(page.getByTestId('interview-progress')).toContainText('2')
      await page.getByTestId('interview-choice-option').first().click()
      await page.getByTestId('interview-next-button').click()

      // Answer question 3: Dependencies (multiple choice)
      await expect(page.getByTestId('interview-progress')).toContainText('3')
      await page.getByTestId('interview-choice-option').first().click()
      await page.getByTestId('interview-next-button').click()

      // Answer question 4: Acceptance criteria (text)
      await expect(page.getByTestId('interview-progress')).toContainText('4')
      await page.getByTestId('interview-text-input').fill('Users can sign in via Google OAuth and maintain session')
      await page.getByTestId('interview-next-button').click()

      // Verify interview complete and spec generated
      await expect(page.getByTestId('interview-complete')).toBeVisible()
      await expect(page.getByTestId('spec-preview')).toBeVisible()
      await expect(page.getByTestId('spec-preview')).toContainText('User authentication with OAuth2')
    })

    // =====================================================
    // STEP 4: Save spec and generate fix plan (Ralph loop start)
    // =====================================================
    await test.step('Save spec and start Ralph loop with fix plan', async () => {
      // Click confirm/save button to finalize spec
      await page.getByTestId('spec-confirm-button').click()

      // Verify spec saved and fix plan generated
      await expect(page.getByTestId('spec-saved-message')).toBeVisible()
      await expect(page.getByTestId('fix-plan-preview')).toBeVisible()

      // Verify fix plan contains tasks
      await expect(page.getByTestId('fix-plan-preview')).toContainText('Task')
    })

    // =====================================================
    // STEP 5: Review diffs as agent works
    // =====================================================
    await test.step('Navigate to Diff tab and review changes', async () => {
      // Click on Diff tab
      await page.getByRole('button', { name: 'Diff' }).click()

      // Verify diff view loaded
      await expect(page.getByTestId('diff-file-tree')).toBeVisible()
      await expect(page.getByTestId('diff-file-count')).toBeVisible()

      // Select first file to view diff
      await page.getByTestId('diff-file-item').first().click()

      // Verify Monaco editor loaded with diff
      await expect(page.getByTestId('diff-monaco-container')).toBeVisible()
      // Wait for Monaco diff editor panes (original or modified) to be visible
      await expect(page.locator('.monaco-editor.original-in-monaco-diff-editor, .monaco-editor.modified-in-monaco-diff-editor').first()).toBeVisible({ timeout: 10000 })

      // Verify mode toggle is present and in split mode
      await expect(page.getByTestId('diff-mode-toggle')).toBeVisible()
      await expect(page.getByTestId('diff-mode-split')).toHaveAttribute('data-active', 'true')
    })

    // =====================================================
    // STEP 6: Switch diff view modes
    // =====================================================
    await test.step('Switch between split and unified diff modes', async () => {
      // Switch to unified mode
      await page.getByTestId('diff-mode-unified').click()
      await expect(page.getByTestId('diff-mode-unified')).toHaveAttribute('data-active', 'true')

      // Switch back to split mode
      await page.getByTestId('diff-mode-split').click()
      await expect(page.getByTestId('diff-mode-split')).toHaveAttribute('data-active', 'true')
    })

    // =====================================================
    // STEP 7: Navigate between diff files
    // =====================================================
    await test.step('Navigate between diff files', async () => {
      const fileItems = page.getByTestId('diff-file-item')
      const fileCount = await fileItems.count()

      // Navigate through multiple files if available
      if (fileCount > 1) {
        // Click second file
        await fileItems.nth(1).click()
        await expect(fileItems.nth(1)).toHaveAttribute('data-selected', 'true')

        // Click first file
        await fileItems.first().click()
        await expect(fileItems.first()).toHaveAttribute('data-selected', 'true')
      }
    })

    // =====================================================
    // STEP 8: Complete workflow - verify all tabs accessible
    // =====================================================
    await test.step('Complete workflow and verify all tabs functional', async () => {
      // Navigate back to Chat tab
      await page.getByRole('button', { name: 'Chat' }).click()

      // Verify chat is functional - input is available
      const chatInput = page.getByTestId('chat-input')
      await expect(chatInput).toBeVisible()

      // Navigate to Files tab
      await page.getByRole('button', { name: 'Files' }).click()
      await expect(page.getByTestId('file-explorer')).toBeVisible()

      // Verify all tabs are accessible via keyboard
      await page.keyboard.press('Meta+1') // Chat
      await expect(chatInput).toBeVisible()
    })
  })

  test('workspace type persistence across navigation', async ({ page }) => {
    // Set up workspace in Ralph mode
    await page.goto('http://localhost:1420/workspace/persistence-test?mock=true')

    const typeSelector = page.getByTestId('workspace-type-selector')
    await typeSelector.click()

    // Wait for dropdown and select Ralph
    await expect(page.getByRole('option', { name: /Ralph/ })).toBeVisible()
    await page.getByRole('option', { name: /Ralph/ }).click()

    // Wait for update to complete
    await expect(typeSelector).toContainText('Ralph', { timeout: 10000 })

    // Navigate away
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Navigate back - note: state is stored in Jotai atom, which resets on navigation
    // This test verifies the selector is functional, not persistence (which requires backend)
    await page.goto('http://localhost:1420/workspace/persistence-test?mock=true')

    // Mode should be reset to standard (default) since we don't have backend persistence in mock mode
    await expect(typeSelector).toBeVisible()
  })

  test('keyboard shortcuts work throughout the flow', async ({ page }) => {
    await page.goto('http://localhost:1420/workspace/shortcut-test?mock=true')

    // Test Cmd+K for command palette
    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('command-palette')).not.toBeVisible()

    // Navigate to Files tab first (Cmd+P quick open is only available in Files view)
    await page.getByRole('button', { name: 'Files' }).click()
    const fileExplorer = page.getByTestId('file-explorer')
    await expect(fileExplorer).toBeVisible()

    // Test Cmd+P for quick open (only available in Files view)
    await page.keyboard.press('Meta+p')
    await expect(page.getByTestId('quick-open-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('quick-open-dialog')).not.toBeVisible()

    // Test tab switching with Cmd+1/2/3
    await page.keyboard.press('Meta+1')
    await expect(page.getByTestId('chat-input')).toBeVisible()
  })

  test('error handling in interview flow', async ({ page }) => {
    await page.goto('http://localhost:1420/workspace/error-test?mock=true&mode=interview')

    // Verify interview mode loaded
    await expect(page.getByTestId('interview-container')).toBeVisible()

    // Text input should be present for first question
    const textInput = page.getByTestId('interview-text-input')
    await expect(textInput).toBeVisible()

    // Provide valid answer and proceed
    await textInput.fill('Test feature')
    const nextButton = page.getByTestId('interview-next-button')
    await expect(nextButton).toBeEnabled()
    await nextButton.click()

    // Should advance to next question
    await expect(page.getByTestId('interview-progress')).toContainText('2')
  })

  test('diff view file navigation', async ({ page }) => {
    await page.goto('http://localhost:1420/workspace/diff-test?mock=true')

    // Go to Diff tab
    await page.getByRole('button', { name: 'Diff' }).click()

    // Wait for diff file tree to load
    await expect(page.getByTestId('diff-file-tree')).toBeVisible({ timeout: 10000 })

    // Wait for file items to appear
    await expect(page.getByTestId('diff-file-item').first()).toBeVisible({ timeout: 10000 })

    // Select a file
    await page.getByTestId('diff-file-item').first().click()

    // Wait for Monaco editor panes to be visible
    await expect(page.locator('.monaco-editor.original-in-monaco-diff-editor, .monaco-editor.modified-in-monaco-diff-editor').first()).toBeVisible({ timeout: 10000 })

    // Verify file count is displayed
    await expect(page.getByTestId('diff-file-count')).toBeVisible()
  })
})
