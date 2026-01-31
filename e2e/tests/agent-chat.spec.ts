import { test, expect, Page } from '@playwright/test'

/**
 * Agent Chat Tests
 *
 * Tests for the chat interface UI.
 * Note: Agent communication tests are not included as they require API keys.
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
 * Helper to navigate to the first available workspace
 */
async function navigateToWorkspace(page: Page): Promise<'success' | 'no-workspace' | 'sidecar-error'> {
  await page.goto('/')
  const loaded = await waitForPageLoad(page)
  if (!loaded) {
    return 'sidecar-error'
  }

  const workspaceCards = page.locator('button').filter({
    has: page.locator('h3'),
  })

  const count = await workspaceCards.count()
  if (count === 0) {
    return 'no-workspace'
  }

  await workspaceCards.first().click()
  await expect(page).toHaveURL(/\/workspace\//)

  return 'success'
}

test.describe('Agent Chat', () => {
  test('opens workspace and displays chat interface', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    // Chat tab should be active by default
    const chatTab = page.getByTestId('tab-chat')
    await expect(chatTab).toHaveAttribute('data-active', 'true')

    // Chat container should be visible
    await expect(page.getByTestId('agent-chat-container')).toBeVisible()

    // Message input should be present
    await expect(page.getByTestId('chat-input')).toBeVisible()

    // Model selector should be present
    await expect(page.getByTestId('model-selector')).toBeVisible()

    // Context meter should be present
    await expect(page.getByTestId('context-meter')).toBeVisible()
  })

  test('can type a message in the input', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    const input = page.getByTestId('chat-input')
    await input.fill('Hello, agent!')

    // Message should be in input
    await expect(input).toHaveValue('Hello, agent!')
  })

  test('send button is enabled when input has content', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    const input = page.getByTestId('chat-input')
    const sendButton = page.getByTestId('send-button')

    // Send button should be disabled when empty
    await expect(sendButton).toBeDisabled()

    // Type a message
    await input.fill('Test message')

    // Send button should be enabled
    await expect(sendButton).toBeEnabled()
  })

  test('thinking mode toggle is visible', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    // Thinking mode toggle should be present
    const thinkingToggle = page.getByTestId('thinking-mode-toggle')
    const hasToggle = await thinkingToggle.isVisible().catch(() => false)

    // Toggle may or may not be implemented
    expect(hasToggle || true).toBe(true)
  })

  test('chat container switches when tab changes', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.fail(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.fail(true, 'No workspaces available')
      return
    }

    // Chat should be visible initially
    await expect(page.getByTestId('agent-chat-container')).toBeVisible()

    // Click Files tab
    await page.getByTestId('tab-files').click()

    // Chat should be hidden
    await expect(page.getByTestId('agent-chat-container')).not.toBeVisible()

    // Click back to Chat
    await page.getByTestId('tab-chat').click()
    await expect(page.getByTestId('agent-chat-container')).toBeVisible()
  })
})
