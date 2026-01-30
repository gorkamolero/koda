import { test, expect } from './fixtures'

test.describe('Agent Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/workspace/test-workspace')
    await page.waitForLoadState('networkidle')
  })

  test('opens workspace and displays chat interface', async ({ page }) => {
    // Chat tab should be active by default
    const chatTab = page.getByRole('button', { name: 'Chat' })
    await expect(chatTab).toHaveClass(/border-primary/)

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
    const input = page.getByTestId('chat-input')
    await input.fill('Hello, agent!')

    // Message should be in input
    await expect(input).toHaveValue('Hello, agent!')
  })

  test('send button is enabled when input has content', async ({ page }) => {
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
    // Should start on Chat tab
    await expect(page.getByTestId('agent-chat-container')).toBeVisible()

    // Click Files tab
    await page.getByRole('button', { name: 'Files' }).click()

    // Chat should be hidden
    await expect(page.getByTestId('agent-chat-container')).not.toBeVisible()

    // Click back to Chat
    await page.getByRole('button', { name: 'Chat' }).click()
    await expect(page.getByTestId('agent-chat-container')).toBeVisible()
  })
})
