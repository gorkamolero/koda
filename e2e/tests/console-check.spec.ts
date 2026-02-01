import { test, expect } from '@playwright/test'

test('capture console errors', async ({ page }) => {
  const consoleMessages: string[] = []
  const consoleErrors: string[] = []

  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
  })

  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  await page.goto('/')
  await page.waitForTimeout(3000)

  console.log('\n=== CONSOLE MESSAGES ===')
  consoleMessages.forEach(m => console.log(m))

  console.log('\n=== PAGE ERRORS ===')
  consoleErrors.forEach(e => console.log(e))

  console.log('\n=== PAGE CONTENT ===')
  const content = await page.content()
  console.log(content.substring(0, 2000))

  expect(true).toBe(true)
})
