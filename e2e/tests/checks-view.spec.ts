import { test, expect, Page } from '@playwright/test'

/**
 * Checks View E2E Tests
 *
 * Tests for the CI/CD Checks view functionality.
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
 * Navigate to Checks view
 */
async function navigateToChecksView(
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

  // Navigate to Checks tab
  await page.getByTestId('tab-checks').click()
  await expect(page.getByTestId('checks-view-container')).toBeVisible()

  return 'success'
}

test.describe('Checks View', () => {
  test('displays checks list with mock data', async ({ page }) => {
    const result = await navigateToChecksView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Should show check items
    await expect(page.getByText('TypeScript')).toBeVisible()
    await expect(page.getByText('ESLint')).toBeVisible()
    await expect(page.getByText('Tests')).toBeVisible()
    await expect(page.getByText('Build')).toBeVisible()
  })

  test('displays status summary', async ({ page }) => {
    const result = await navigateToChecksView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Should show passed and pending counts
    await expect(page.getByText(/\d+ passed/)).toBeVisible()
    await expect(page.getByText(/\d+ pending/)).toBeVisible()
  })

  test('can expand check to see details', async ({ page }) => {
    const result = await navigateToChecksView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Click on TypeScript check to expand
    await page.getByTestId('check-button-typecheck').click()

    // Should show description
    await expect(page.getByText('Type checking passed')).toBeVisible()
  })

  test('can collapse expanded check', async ({ page }) => {
    const result = await navigateToChecksView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Expand
    await page.getByTestId('check-button-typecheck').click()
    await expect(page.getByText('Type checking passed')).toBeVisible()

    // Collapse
    await page.getByTestId('check-button-typecheck').click()
    await expect(page.getByText('Type checking passed')).not.toBeVisible()
  })

  test('shows Re-run all button', async ({ page }) => {
    const result = await navigateToChecksView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByText('Re-run all')).toBeVisible()
  })

  test('check items have correct status attributes', async ({ page }) => {
    const result = await navigateToChecksView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // TypeScript should have success status
    const typecheckItem = page.getByTestId('check-item-typecheck')
    await expect(typecheckItem).toHaveAttribute('data-status', 'success')

    // Tests should have pending status
    const testItem = page.getByTestId('check-item-test')
    await expect(testItem).toHaveAttribute('data-status', 'pending')
  })
})
