import { test, expect, Page } from '@playwright/test'

/**
 * Scratchpad E2E Tests
 *
 * Tests for the Scratchpad markdown editor functionality.
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
 * Navigate to Scratchpad view
 */
async function navigateToScratchpad(
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

  // Navigate to Scratchpad tab
  await page.getByTestId('tab-scratchpad').click()
  await expect(page.getByTestId('scratchpad-container')).toBeVisible()

  return 'success'
}

test.describe('Scratchpad', () => {
  test('displays Notes and History tabs', async ({ page }) => {
    const result = await navigateToScratchpad(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('scratchpad-tab-notes')).toBeVisible()
    await expect(page.getByTestId('scratchpad-tab-history')).toBeVisible()
  })

  test('Notes tab is active by default', async ({ page }) => {
    const result = await navigateToScratchpad(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('scratchpad-tab-notes')).toHaveAttribute('data-active', 'true')
  })

  test('displays Monaco editor for notes', async ({ page }) => {
    const result = await navigateToScratchpad(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Monaco editor should be visible
    const monacoEditor = page.locator('.monaco-editor')
    await expect(monacoEditor.first()).toBeVisible({ timeout: 10000 })
  })

  test('can create new note', async ({ page }) => {
    const result = await navigateToScratchpad(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Wait for initial notes to load (auto-created on first visit)
    await page.waitForTimeout(1000)

    // New note button should be visible
    const newNoteButton = page.getByTestId('scratchpad-new-note')
    await expect(newNoteButton).toBeVisible()

    // Click new note button - it should be clickable
    await newNoteButton.click()

    // Wait for the new note to be created
    await page.waitForTimeout(500)

    // Monaco editor should still be visible with the new note
    const monacoEditor = page.locator('.monaco-editor')
    await expect(monacoEditor.first()).toBeVisible({ timeout: 5000 })
  })

  test('can switch to History tab', async ({ page }) => {
    const result = await navigateToScratchpad(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Click History tab
    await page.getByTestId('scratchpad-tab-history').click()

    // History tab should be active
    await expect(page.getByTestId('scratchpad-tab-history')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('scratchpad-tab-notes')).toHaveAttribute('data-active', 'false')

    // Should show conversation history view (using testid to avoid ambiguity)
    await expect(page.getByTestId('conversation-history')).toBeVisible()
  })

  test('can switch back to Notes tab', async ({ page }) => {
    const result = await navigateToScratchpad(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Switch to History
    await page.getByTestId('scratchpad-tab-history').click()
    await expect(page.getByTestId('scratchpad-tab-history')).toHaveAttribute('data-active', 'true')

    // Switch back to Notes
    await page.getByTestId('scratchpad-tab-notes').click()
    await expect(page.getByTestId('scratchpad-tab-notes')).toHaveAttribute('data-active', 'true')

    // Monaco editor should be visible again
    const monacoEditor = page.locator('.monaco-editor')
    await expect(monacoEditor.first()).toBeVisible({ timeout: 5000 })
  })

  test('notes list can be collapsed and expanded', async ({ page }) => {
    const result = await navigateToScratchpad(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Notes list header should be visible
    const notesHeader = page.getByText(/Notes \(\d+\)/)
    await expect(notesHeader).toBeVisible()

    // Click to collapse
    await notesHeader.click()
    await page.waitForTimeout(300)

    // Click to expand
    await notesHeader.click()
    await page.waitForTimeout(300)

    // Should still work
    await expect(notesHeader).toBeVisible()
  })
})
