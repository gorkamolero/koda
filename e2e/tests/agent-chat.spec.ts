import { test, expect } from '@playwright/test'

test.describe('Agent Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Use mock=true to enable mock mode for E2E tests
    await page.goto('http://localhost:1420/workspace/test-workspace?mock=true')
  })

  test('opens workspace and displays chat interface', async ({ page }) => {
    // Chat tab should be active by default
    const chatTab = page.getByRole('button', { name: 'Chat' })
    await expect(chatTab).toHaveAttribute('class', /border-primary/)

    // Chat container should be visible
    await expect(page.getByTestId('agent-chat-container')).toBeVisible()

    // Message input should be present
    await expect(page.getByTestId('chat-input')).toBeVisible()
    await expect(page.getByTestId('chat-input')).toHaveAttribute(
      'placeholder',
      /Type a message/
    )

    // Model selector should be present
    await expect(page.getByTestId('model-selector')).toBeVisible()

    // Context meter should be present
    await expect(page.getByTestId('context-meter')).toBeVisible()
  })

  test('sends a message and receives mock agent response', async ({ page }) => {
    // Type a message
    const input = page.getByTestId('chat-input')
    await input.fill('Hello, agent!')

    // Send the message
    await page.getByTestId('send-button').click()

    // User message should appear in the message list
    await expect(page.getByTestId('message-list')).toContainText(
      'Hello, agent!'
    )

    // Wait for mock agent response (in test mode, we mock the response)
    await expect(page.getByTestId('message-list')).toContainText(
      'Mock agent response',
      { timeout: 5000 }
    )
  })

  test('message list is virtualized', async ({ page }) => {
    // The virtualized container should exist
    await expect(page.getByTestId('message-list')).toBeVisible()

    // Check that the list has the virtualized class
    const messageList = page.getByTestId('message-list')
    await expect(messageList).toHaveAttribute('data-virtualized', 'true')
  })

  test('can switch between models', async ({ page }) => {
    const selector = page.getByTestId('model-selector')
    await selector.click()

    // Model options should be visible
    await expect(page.getByRole('option', { name: /Claude/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Codex/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Kimi/ })).toBeVisible()

    // Select a different model
    await page.getByRole('option', { name: /Codex/ }).click()

    // Model should be updated
    await expect(selector).toContainText('Codex')
  })

  test('context meter updates with message length', async ({ page }) => {
    const contextMeter = page.getByTestId('context-meter')

    // Initial state should show 0 tokens
    await expect(contextMeter).toContainText('0')

    // Type a message
    const input = page.getByTestId('chat-input')
    await input.fill('Hello, this is a test message to see the context meter update')

    // Context meter should update (approximate token count)
    await expect(contextMeter).not.toContainText('0')
  })

  test('can use keyboard shortcut to send message', async ({ page }) => {
    const input = page.getByTestId('chat-input')
    await input.fill('Keyboard test')

    // Press Enter to send
    await input.press('Enter')

    // Message should appear
    await expect(page.getByTestId('message-list')).toContainText(
      'Keyboard test'
    )
  })

  test('input area supports multiline with Shift+Enter', async ({ page }) => {
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
})
