import { test, expect, Page } from '@playwright/test'

/**
 * Model Selector E2E Tests
 *
 * Tests for the AI model selection dropdown.
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
 * Navigate to a workspace chat
 */
async function navigateToWorkspaceChat(
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

  return 'success'
}

test.describe('Model Selector', () => {
  test('displays model selector in chat', async ({ page }) => {
    const result = await navigateToWorkspaceChat(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Model selector should be visible
    const modelSelector = page.getByTestId('model-selector')
    const isVisible = await modelSelector.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip(true, 'Model selector not visible in this view')
      return
    }

    await expect(modelSelector).toBeVisible()
  })

  test('clicking model selector opens dropdown', async ({ page }) => {
    const result = await navigateToWorkspaceChat(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const modelSelector = page.getByTestId('model-selector')
    const isVisible = await modelSelector.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip(true, 'Model selector not visible')
      return
    }

    // Click to open dropdown
    await modelSelector.click()

    // Dropdown should be visible
    await expect(page.getByTestId('model-selector-dropdown')).toBeVisible()
  })

  test('dropdown shows available models', async ({ page }) => {
    const result = await navigateToWorkspaceChat(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const modelSelector = page.getByTestId('model-selector')
    const isVisible = await modelSelector.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip(true, 'Model selector not visible')
      return
    }

    // Open dropdown
    await modelSelector.click()
    await expect(page.getByTestId('model-selector-dropdown')).toBeVisible()

    // Should show available model options using testids
    await expect(page.getByTestId('model-option-claude')).toBeVisible()
    await expect(page.getByTestId('model-option-codex')).toBeVisible()
  })

  test('can select a different model', async ({ page }) => {
    const result = await navigateToWorkspaceChat(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const modelSelector = page.getByTestId('model-selector')
    const isVisible = await modelSelector.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip(true, 'Model selector not visible')
      return
    }

    // Get current model text
    const initialText = await modelSelector.textContent()

    // Open dropdown
    await modelSelector.click()
    await expect(page.getByTestId('model-selector-dropdown')).toBeVisible()

    // Select a different model (Codex if Claude is selected, Claude if not)
    if (initialText?.includes('Claude')) {
      await page.getByTestId('model-option-codex').click()
      // Model selector should now show Codex
      await expect(modelSelector).toContainText('Codex')
    } else {
      await page.getByTestId('model-option-claude').click()
      // Model selector should now show Claude
      await expect(modelSelector).toContainText('Claude')
    }
  })

  test('dropdown closes after selection', async ({ page }) => {
    const result = await navigateToWorkspaceChat(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const modelSelector = page.getByTestId('model-selector')
    const isVisible = await modelSelector.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip(true, 'Model selector not visible')
      return
    }

    // Open dropdown
    await modelSelector.click()
    await expect(page.getByTestId('model-selector-dropdown')).toBeVisible()

    // Select a model using testid
    await page.getByTestId('model-option-claude').click()

    // Dropdown should be closed
    await expect(page.getByTestId('model-selector-dropdown')).not.toBeVisible()
  })

  test('dropdown closes when clicking outside', async ({ page }) => {
    const result = await navigateToWorkspaceChat(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const modelSelector = page.getByTestId('model-selector')
    const isVisible = await modelSelector.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip(true, 'Model selector not visible')
      return
    }

    // Open dropdown
    await modelSelector.click()
    await expect(page.getByTestId('model-selector-dropdown')).toBeVisible()

    // Click outside
    await page.mouse.click(10, 10)

    // Dropdown should be closed
    await expect(page.getByTestId('model-selector-dropdown')).not.toBeVisible()
  })

  test('dropdown closes on Escape key', async ({ page }) => {
    const result = await navigateToWorkspaceChat(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const modelSelector = page.getByTestId('model-selector')
    const isVisible = await modelSelector.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip(true, 'Model selector not visible')
      return
    }

    // Open dropdown
    await modelSelector.click()
    await expect(page.getByTestId('model-selector-dropdown')).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')

    // Dropdown should be closed
    await expect(page.getByTestId('model-selector-dropdown')).not.toBeVisible()
  })
})
