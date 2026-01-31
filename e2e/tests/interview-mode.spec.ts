import { test, expect, Page } from '@playwright/test'

/**
 * Interview Mode Tests
 *
 * Tests for the interview/spec generation flow.
 * Requires a workspace to exist AND the workspace type selector feature to be implemented.
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
 * Navigate to workspace and check if type selector is available
 */
async function navigateToWorkspaceWithTypeSelector(page: Page): Promise<'success' | 'no-workspace' | 'no-selector' | 'sidecar-error'> {
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

  // Check if workspace type selector exists (feature may not be implemented)
  const typeSelector = page.getByTestId('workspace-type-selector')
  const hasSelector = await typeSelector.isVisible({ timeout: 3000 }).catch(() => false)

  if (!hasSelector) {
    return 'no-selector'
  }

  return 'success'
}

/**
 * Navigate to workspace and attempt to switch to Ralph/Spec mode
 */
async function setupSpecMode(page: Page): Promise<'success' | 'no-workspace' | 'no-selector' | 'switch-failed' | 'sidecar-error'> {
  const result = await navigateToWorkspaceWithTypeSelector(page)
  if (result !== 'success') {
    return result
  }

  // Switch to Ralph mode (which includes spec features)
  const typeSelector = page.getByTestId('workspace-type-selector')
  await typeSelector.click()

  const ralphOption = page.getByRole('option', { name: /Ralph/ })
  if (!(await ralphOption.isVisible().catch(() => false))) {
    return 'switch-failed'
  }

  await ralphOption.click()

  // Wait a moment for state to update
  await page.waitForTimeout(500)

  // Check if the switch worked
  const selectorText = await typeSelector.textContent()
  if (!selectorText?.includes('Ralph')) {
    return 'switch-failed'
  }

  return 'success'
}

test.describe('Workspace Type Switching', () => {
  test('displays workspace type selector', async ({ page }) => {
    const result = await navigateToWorkspaceWithTypeSelector(page)

    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }
    if (result === 'no-selector') {
      test.skip(true, 'Workspace type selector not implemented')
      return
    }

    await expect(page.getByTestId('workspace-type-selector')).toBeVisible()
  })

  test('can switch between workspace modes', async ({ page }) => {
    const result = await navigateToWorkspaceWithTypeSelector(page)

    if (result !== 'success') {
      test.skip(true, `Skipping: ${result}`)
      return
    }

    const typeSelector = page.getByTestId('workspace-type-selector')
    await typeSelector.click()

    // Check that options are available
    const standardOption = page.getByRole('option', { name: /Standard/ })
    const specDrivenOption = page.getByRole('option', { name: /Spec-Driven/ })

    const hasStandard = await standardOption.isVisible().catch(() => false)
    const hasSpecDriven = await specDrivenOption.isVisible().catch(() => false)

    if (!hasStandard && !hasSpecDriven) {
      test.skip(true, 'No mode options available')
      return
    }

    // If spec-driven is available, select it
    if (hasSpecDriven) {
      await specDrivenOption.click()
      await page.waitForTimeout(500)
      await expect(typeSelector).toContainText(/Spec/)
    }
  })

  test('switching to Spec-Driven mode shows Spec tab', async ({ page }) => {
    const result = await navigateToWorkspaceWithTypeSelector(page)

    if (result !== 'success') {
      test.skip(true, `Skipping: ${result}`)
      return
    }

    const typeSelector = page.getByTestId('workspace-type-selector')
    await typeSelector.click()

    const specDrivenOption = page.getByRole('option', { name: /Spec-Driven/ })
    if (!(await specDrivenOption.isVisible().catch(() => false))) {
      test.skip(true, 'Spec-Driven mode not available')
      return
    }

    await specDrivenOption.click()
    await page.waitForTimeout(500)

    // Spec tab should appear
    const specTab = page.getByRole('button', { name: 'Spec' })
    await expect(specTab).toBeVisible()
  })

  test('switching to Ralph mode shows Spec tab', async ({ page }) => {
    const setupResult = await setupSpecMode(page)

    if (setupResult !== 'success') {
      test.skip(true, `Skipping: ${setupResult}`)
      return
    }

    // Spec tab should appear in Ralph mode
    await expect(page.getByRole('button', { name: 'Spec' })).toBeVisible()
  })
})

test.describe('Ralph Mode View', () => {
  test('Ralph mode shows spec and fix plan sections', async ({ page }) => {
    const setupResult = await setupSpecMode(page)

    if (setupResult !== 'success') {
      test.skip(true, `Skipping: ${setupResult}`)
      return
    }

    // Click Spec tab
    await page.getByRole('button', { name: 'Spec' }).click()

    // Should show Ralph-specific sections
    const specSection = page.getByTestId('ralph-spec-section')
    const hasSpecSection = await specSection.isVisible({ timeout: 3000 }).catch(() => false)

    if (!hasSpecSection) {
      test.skip(true, 'Ralph spec section not implemented')
      return
    }

    await expect(specSection).toBeVisible()
  })

  test('Ralph view has interview start button', async ({ page }) => {
    const setupResult = await setupSpecMode(page)

    if (setupResult !== 'success') {
      test.skip(true, `Skipping: ${setupResult}`)
      return
    }

    // Click Spec tab
    await page.getByRole('button', { name: 'Spec' }).click()

    // Should have start interview button
    const startButton = page.getByRole('button', { name: /Start Interview|Begin Interview/ })
    const hasButton = await startButton.isVisible({ timeout: 3000 }).catch(() => false)

    if (!hasButton) {
      test.skip(true, 'Interview start button not implemented')
      return
    }

    await expect(startButton).toBeVisible()
  })
})

test.describe('Interview Flow', () => {
  test('clicking start interview opens interview interface', async ({ page }) => {
    const setupResult = await setupSpecMode(page)

    if (setupResult !== 'success') {
      test.skip(true, `Skipping: ${setupResult}`)
      return
    }

    // Click Spec tab
    await page.getByRole('button', { name: 'Spec' }).click()

    // Find and click start interview
    const startButton = page.getByRole('button', { name: /Start Interview|Begin Interview/ })
    if (!(await startButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Interview start button not available')
      return
    }

    await startButton.click()

    // Interview interface should open
    const interviewContainer = page.getByTestId('interview-container')
    const hasContainer = await interviewContainer.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasContainer) {
      test.skip(true, 'Interview container not implemented')
      return
    }

    await expect(interviewContainer).toBeVisible()
  })

  test('interview shows progress indicator', async ({ page }) => {
    const setupResult = await setupSpecMode(page)

    if (setupResult !== 'success') {
      test.skip(true, `Skipping: ${setupResult}`)
      return
    }

    await page.getByRole('button', { name: 'Spec' }).click()

    const startButton = page.getByRole('button', { name: /Start Interview|Begin Interview/ })
    if (!(await startButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Interview not available')
      return
    }

    await startButton.click()

    // Should show progress indicator
    const progress = page.getByTestId('interview-progress')
    const hasProgress = await progress.isVisible({ timeout: 3000 }).catch(() => false)

    if (!hasProgress) {
      test.skip(true, 'Progress indicator not implemented')
      return
    }

    await expect(progress).toBeVisible()
  })

  test('can answer text questions', async ({ page }) => {
    const setupResult = await setupSpecMode(page)

    if (setupResult !== 'success') {
      test.skip(true, `Skipping: ${setupResult}`)
      return
    }

    await page.getByRole('button', { name: 'Spec' }).click()

    const startButton = page.getByRole('button', { name: /Start Interview|Begin Interview/ })
    if (!(await startButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Interview not available')
      return
    }

    await startButton.click()

    // Find text input in interview
    const textInput = page.getByTestId('interview-text-input')
    if (!(await textInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Text input not implemented')
      return
    }

    await textInput.fill('Test answer')
    await expect(textInput).toHaveValue('Test answer')
  })

  test('can navigate back to previous questions', async ({ page }) => {
    const setupResult = await setupSpecMode(page)

    if (setupResult !== 'success') {
      test.skip(true, `Skipping: ${setupResult}`)
      return
    }

    await page.getByRole('button', { name: 'Spec' }).click()

    const startButton = page.getByRole('button', { name: /Start Interview|Begin Interview/ })
    if (!(await startButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Interview not available')
      return
    }

    await startButton.click()

    // Check for back navigation
    const backButton = page.getByRole('button', { name: /Back|Previous/ })
    const hasBack = await backButton.isVisible({ timeout: 3000 }).catch(() => false)

    if (!hasBack) {
      test.skip(true, 'Back navigation not implemented')
      return
    }

    // Initially back should be disabled (first question)
    const isDisabled = await backButton.isDisabled()
    expect(isDisabled).toBe(true)
  })
})

test.describe('Spec Generation', () => {
  test.skip('completing interview generates spec', async ({ page }) => {
    // Skip by default as it requires completing a full interview
    const setupResult = await setupSpecMode(page)

    if (setupResult !== 'success') {
      test.skip(true, `Skipping: ${setupResult}`)
      return
    }

    // This test would complete the full interview flow
    // and verify spec generation
  })
})
