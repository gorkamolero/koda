import { test, expect, Page } from '@playwright/test'

/**
 * Agent Conversation Tests
 *
 * These tests verify the CORE functionality: talking to Claude.
 * Requires API keys to be configured.
 */

async function waitForPageLoad(page: Page): Promise<boolean> {
  await page.waitForLoadState('networkidle')
  const loading = page.getByText('Loading...')
  await expect(loading).not.toBeVisible({ timeout: 15000 })
  const errorMessage = page.getByText('Failed to load workspaces')
  return !(await errorMessage.isVisible().catch(() => false))
}

async function navigateToWorkspace(page: Page): Promise<boolean> {
  await page.goto('/')
  const loaded = await waitForPageLoad(page)
  if (!loaded) return false

  const workspaceCards = page.locator('button').filter({
    has: page.locator('h3'),
  })

  if ((await workspaceCards.count()) === 0) return false

  await workspaceCards.first().click()
  await expect(page).toHaveURL(/\/workspace\//)
  return true
}

test.describe('Agent Conversation', () => {
  test('can send message and receive response from Claude', async ({ page }) => {
    const navigated = await navigateToWorkspace(page)
    if (!navigated) {
      test.fail(true, 'Could not navigate to workspace')
      return
    }

    // Ensure we're on the Chat tab
    const chatTab = page.getByTestId('tab-chat')
    await chatTab.click()
    await expect(chatTab).toHaveAttribute('data-active', 'true')

    // Find the chat input (uses testid)
    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible({ timeout: 10000 })

    // Count existing assistant messages before sending
    const existingMessages = await page.locator('[data-role="assistant"]').count()

    // Type a simple message
    await chatInput.fill('hi')

    // Click the send button
    const sendButton = page.getByTestId('send-button')
    await expect(sendButton).toBeVisible()
    await sendButton.click()

    // Wait for a NEW assistant message to appear
    // Give Claude up to 60 seconds to respond (API can be slow)
    const assistantMessages = page.locator('[data-role="assistant"]')
    await expect(assistantMessages).toHaveCount(existingMessages + 1, { timeout: 60000 })

    // Verify the new response has some content
    const newMessage = assistantMessages.nth(existingMessages)
    const responseText = await newMessage.textContent()
    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(0)
  })
})
