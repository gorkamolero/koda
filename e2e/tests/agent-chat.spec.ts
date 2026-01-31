import { test, expect, Page } from '@playwright/test'

/**
 * Agent Chat Tests
 *
 * Tests for the chat interface and agent communication.
 * Requires a workspace to exist in the database.
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
 * Returns status indicating outcome
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
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available - create one first')
      return
    }

    // Chat tab should be active by default (using testid for stability)
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
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
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
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const input = page.getByTestId('chat-input')
    const sendButton = page.getByTestId('send-button')

    // Initially disabled with empty input
    await expect(sendButton).toBeDisabled()

    // Type a message
    await input.fill('Test message')

    // Should be enabled
    await expect(sendButton).toBeEnabled()
  })

  test('can switch between models', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    const selector = page.getByTestId('model-selector')
    await selector.click()

    // Model options should be visible
    await expect(page.getByRole('option', { name: /Claude/ })).toBeVisible()

    // Select Claude
    await page.getByRole('option', { name: /Claude/ }).first().click()

    // Selector should show selected model
    await expect(selector).toContainText('Claude')
  })

  test('input supports multiline with Shift+Enter', async ({ page }) => {
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

    // Type first line
    await input.fill('Line 1')

    // Press Shift+Enter to add a new line
    await input.press('Shift+Enter')
    await page.keyboard.type('Line 2')

    // Should have both lines
    const value = await input.inputValue()
    expect(value).toContain('Line 1')
    expect(value).toContain('Line 2')
  })

  test('can navigate between tabs', async ({ page }) => {
    const result = await navigateToWorkspace(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Should start on Chat tab
    await expect(page.getByTestId('agent-chat-container')).toBeVisible()

    // Click Files tab (using testid - actual label is "All files")
    await page.getByTestId('tab-files').click()

    // Chat should be hidden
    await expect(page.getByTestId('agent-chat-container')).not.toBeVisible()

    // Click back to Chat
    await page.getByTestId('tab-chat').click()
    await expect(page.getByTestId('agent-chat-container')).toBeVisible()
  })
})

test.describe('Agent Communication', () => {
  test.skip('sending a message shows it in the chat', async ({ page }) => {
    // This test sends a real message to the agent
    // Skip by default as it requires API keys and incurs costs
    const result = await navigateToWorkspace(page)
    if (result !== 'success') {
      test.skip(true, 'No workspaces available')
      return
    }

    const input = page.getByTestId('chat-input')
    const sendButton = page.getByTestId('send-button')

    // Type and send a message
    await input.fill('Hello, this is a test message')
    await sendButton.click()

    // Message should appear in the message list
    await expect(page.getByTestId('message-list')).toContainText(
      'Hello, this is a test message'
    )
  })

  test.skip('agent responds to messages', async ({ page }) => {
    // This test waits for a real agent response
    // Skip by default as it requires API keys and takes time
    const result = await navigateToWorkspace(page)
    if (result !== 'success') {
      test.skip(true, 'No workspaces available')
      return
    }

    const input = page.getByTestId('chat-input')
    const sendButton = page.getByTestId('send-button')

    await input.fill('Say "test response" and nothing else')
    await sendButton.click()

    // Wait for agent response (streaming)
    await expect(page.getByTestId('message-list')).toContainText(
      'test response',
      { timeout: 60000 }
    )
  })
})
