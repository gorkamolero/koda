import { test, expect } from './fixtures'

test.describe('Interview Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Use mock=true to enable mock mode for E2E tests
    await page.goto(
      'http://localhost:1420/workspace/test-workspace?mock=true&mode=interview'
    )
  })

  test('displays interview interface with first question', async ({ page }) => {
    // Interview container should be visible
    await expect(page.getByTestId('interview-container')).toBeVisible()

    // First question should be displayed
    await expect(page.getByTestId('interview-question')).toBeVisible()
    await expect(page.getByTestId('interview-question')).toContainText(
      'What feature are you building?'
    )

    // Progress indicator should show step 1
    await expect(page.getByTestId('interview-progress')).toBeVisible()
    await expect(page.getByTestId('interview-progress')).toContainText('1')
  })

  test('allows text input for open questions', async ({ page }) => {
    // Text input should be visible for open questions
    const textInput = page.getByTestId('interview-text-input')
    await expect(textInput).toBeVisible()

    // Type an answer
    await textInput.fill('Building a user authentication system')

    // Next button should be enabled
    const nextButton = page.getByTestId('interview-next-button')
    await expect(nextButton).toBeEnabled()

    // Click next to proceed
    await nextButton.click()

    // Should advance to next question
    await expect(page.getByTestId('interview-progress')).toContainText('2')
  })

  test('displays multiple choice options', async ({ page }) => {
    // Answer first question to get to multiple choice
    await page.getByTestId('interview-text-input').fill('Test feature')
    await page.getByTestId('interview-next-button').click()

    // Wait for multiple choice question
    await expect(page.getByTestId('interview-choices')).toBeVisible()

    // Should show multiple options
    const options = page.getByTestId('interview-choice-option')
    await expect(options).toHaveCount(3) // Expecting 3 options for complexity
  })

  test('allows selecting multiple choice answer', async ({ page }) => {
    // Navigate to multiple choice question
    await page.getByTestId('interview-text-input').fill('Test feature')
    await page.getByTestId('interview-next-button').click()

    // Select an option
    const firstOption = page.getByTestId('interview-choice-option').first()
    await firstOption.click()

    // Option should be selected
    await expect(firstOption).toHaveAttribute('data-selected', 'true')

    // Next button should be enabled
    await expect(page.getByTestId('interview-next-button')).toBeEnabled()
  })

  test('shows progress through all questions', async ({ page }) => {
    // Answer question 1 (text)
    await page.getByTestId('interview-text-input').fill('User auth system')
    await page.getByTestId('interview-next-button').click()

    // Answer question 2 (multiple choice - complexity)
    await page.getByTestId('interview-choice-option').first().click()
    await page.getByTestId('interview-next-button').click()

    // Answer question 3 (multiple choice - dependencies)
    await page.getByTestId('interview-choice-option').first().click()
    await page.getByTestId('interview-next-button').click()

    // Answer question 4 (text - acceptance criteria)
    await page.getByTestId('interview-text-input').fill('Users can login')
    await page.getByTestId('interview-next-button').click()

    // Should show completion state
    await expect(page.getByTestId('interview-complete')).toBeVisible()
  })

  test('can go back to previous questions', async ({ page }) => {
    // Answer first question
    await page.getByTestId('interview-text-input').fill('Test feature')
    await page.getByTestId('interview-next-button').click()

    // Progress should show question 2
    await expect(page.getByTestId('interview-progress')).toContainText('2')

    // Click back button
    await page.getByTestId('interview-back-button').click()

    // Should be back to question 1
    await expect(page.getByTestId('interview-progress')).toContainText('1')

    // Previous answer should be preserved
    await expect(page.getByTestId('interview-text-input')).toHaveValue(
      'Test feature'
    )
  })
})

test.describe('Spec Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(
      'http://localhost:1420/workspace/test-workspace?mock=true&mode=interview'
    )
  })

  test('generates spec from completed interview', async ({ page }) => {
    // Complete the interview flow
    await page.getByTestId('interview-text-input').fill('User authentication')
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-choice-option').first().click()
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-choice-option').first().click()
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-text-input').fill('Login with email')
    await page.getByTestId('interview-next-button').click()

    // Interview complete screen should show spec preview
    await expect(page.getByTestId('spec-preview')).toBeVisible()
    await expect(page.getByTestId('spec-preview')).toContainText(
      'User authentication'
    )
  })

  test('allows editing generated spec', async ({ page }) => {
    // Complete interview
    await page.getByTestId('interview-text-input').fill('Test feature')
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-choice-option').first().click()
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-choice-option').first().click()
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-text-input').fill('Test criteria')
    await page.getByTestId('interview-next-button').click()

    // Click edit button
    await page.getByTestId('spec-edit-button').click()

    // Editor should be visible
    await expect(page.getByTestId('spec-editor')).toBeVisible()

    // Make changes
    const editor = page.getByTestId('spec-editor')
    await editor.fill('# Edited Spec\n\nModified content')

    // Save changes
    await page.getByTestId('spec-save-button').click()

    // Preview should update
    await expect(page.getByTestId('spec-preview')).toContainText('Edited Spec')
  })

  test('saves spec to workspace and generates fix plan', async ({ page }) => {
    // Complete interview
    await page.getByTestId('interview-text-input').fill('Auth feature')
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-choice-option').first().click()
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-choice-option').first().click()
    await page.getByTestId('interview-next-button').click()

    await page.getByTestId('interview-text-input').fill('Can login')
    await page.getByTestId('interview-next-button').click()

    // Click save button
    await page.getByTestId('spec-confirm-button').click()

    // Should show success message
    await expect(page.getByTestId('spec-saved-message')).toBeVisible()

    // Fix plan should be generated
    await expect(page.getByTestId('fix-plan-preview')).toBeVisible()
    await expect(page.getByTestId('fix-plan-preview')).toContainText('Task')
  })
})

test.describe('Workspace Type Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/workspace/test-workspace?mock=true')
  })

  test('displays workspace type selector', async ({ page }) => {
    await expect(page.getByTestId('workspace-type-selector')).toBeVisible()
  })

  test('can switch from standard to spec-driven mode', async ({ page }) => {
    const selector = page.getByTestId('workspace-type-selector')
    await selector.click()

    // Options should be visible
    await expect(
      page.getByRole('option', { name: /Standard/ })
    ).toBeVisible()
    await expect(
      page.getByRole('option', { name: /Spec-Driven/ })
    ).toBeVisible()
    await expect(page.getByRole('option', { name: /Ralph/ })).toBeVisible()

    // Select spec-driven
    await page.getByRole('option', { name: /Spec-Driven/ }).click()

    // Selector should update
    await expect(selector).toContainText('Spec-Driven')
  })

  test('spec-driven mode shows interview button', async ({ page }) => {
    // Switch to spec-driven mode
    await page.getByTestId('workspace-type-selector').click()
    await page.getByRole('option', { name: /Spec-Driven/ }).click()

    // Need to click on Spec tab to see the interview button
    await page.getByRole('button', { name: 'Spec' }).click()

    // Interview button should appear
    await expect(page.getByTestId('start-interview-button')).toBeVisible()
  })

  test('can switch to ralph mode', async ({ page }) => {
    const selector = page.getByTestId('workspace-type-selector')
    await selector.click()
    await page.getByRole('option', { name: /Ralph/ }).click()

    await expect(selector).toContainText('Ralph')

    // Need to click on Spec tab to see Ralph mode sections
    await page.getByRole('button', { name: 'Spec' }).click()

    // Ralph mode should show spec and fix plan sections
    await expect(page.getByTestId('spec-section')).toBeVisible()
    await expect(page.getByTestId('fix-plan-section')).toBeVisible()
  })

  test('workspace type changes within session', async ({ page }) => {
    // Switch to spec-driven
    await page.getByTestId('workspace-type-selector').click()
    await page.getByRole('option', { name: /Spec-Driven/ }).click()
    await expect(page.getByTestId('workspace-type-selector')).toContainText('Spec-Driven')

    // Switch to Ralph
    await page.getByTestId('workspace-type-selector').click()
    await page.getByRole('option', { name: /Ralph/ }).click()
    await expect(page.getByTestId('workspace-type-selector')).toContainText('Ralph')

    // Switch back to Standard
    await page.getByTestId('workspace-type-selector').click()
    await page.getByRole('option', { name: /Standard/ }).click()
    await expect(page.getByTestId('workspace-type-selector')).toContainText('Standard')
  })
})
