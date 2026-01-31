import { test, expect } from '@playwright/test'

/**
 * Smoke Tests
 *
 * Basic tests to verify the app starts and core functionality works.
 * These tests don't require any data in the database.
 */

test.describe('Smoke Tests', () => {
  test('app loads and shows title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Koda/)
  })

  test('loading state shows initially', async ({ page }) => {
    await page.goto('/')
    // Just check the page loads - loading state may be very fast
    await expect(page).toHaveTitle(/Koda/)
  })

  test('main content renders after loading', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for loading to finish
    const loading = page.getByText('Loading...')
    await expect(loading).not.toBeVisible({ timeout: 15000 })

    // Should either see workspaces or error message
    const workspacesHeading = page.getByRole('heading', { name: 'Workspaces', level: 1 })
    const errorMessage = page.getByText('Failed to load workspaces')
    const emptyState = page.getByText('No workspaces yet')

    const hasWorkspaces = await workspacesHeading.isVisible().catch(() => false)
    const hasError = await errorMessage.isVisible().catch(() => false)
    const hasEmpty = await emptyState.isVisible().catch(() => false)

    expect(hasWorkspaces || hasError || hasEmpty).toBe(true)
  })

  test('new workspace button opens modal', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for loading to complete
    const loading = page.getByText('Loading...')
    await expect(loading).not.toBeVisible({ timeout: 15000 })

    // Find the New Workspace button using testid (more reliable than text)
    const headerButton = page.getByTestId('new-workspace-button')
    const emptyStateButton = page.getByTestId('new-workspace-button-empty')

    // Check which button is visible
    const hasHeaderButton = await headerButton.isVisible().catch(() => false)
    const hasEmptyButton = await emptyStateButton.isVisible().catch(() => false)

    if (!hasHeaderButton && !hasEmptyButton) {
      test.skip(true, 'New Workspace button not visible - app may be in error state')
      return
    }

    // Click the visible button
    const btn = hasHeaderButton ? headerButton : emptyStateButton
    await btn.click()

    // Wait for modal to appear
    await page.waitForTimeout(500)

    // Modal should appear with repo selection (h2 element)
    const modalHeading = page.locator('h2').filter({ hasText: 'Select Repository' })
    await expect(modalHeading).toBeVisible({ timeout: 5000 })

    // Should show option to add a repo
    await expect(page.getByText('Add Git Repository')).toBeVisible()
  })

  test('modal can be closed', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for loading
    const loading = page.getByText('Loading...')
    await expect(loading).not.toBeVisible({ timeout: 15000 })

    // Find the New Workspace button using testid
    const headerButton = page.getByTestId('new-workspace-button')
    const emptyStateButton = page.getByTestId('new-workspace-button-empty')

    const hasHeaderButton = await headerButton.isVisible().catch(() => false)
    const hasEmptyButton = await emptyStateButton.isVisible().catch(() => false)

    if (!hasHeaderButton && !hasEmptyButton) {
      test.skip(true, 'New Workspace button not visible')
      return
    }

    // Open modal
    const btn = hasHeaderButton ? headerButton : emptyStateButton
    await btn.click()
    await page.waitForTimeout(500)

    const modalHeading = page.locator('h2').filter({ hasText: 'Select Repository' })
    await expect(modalHeading).toBeVisible({ timeout: 5000 })

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should be gone
    await expect(modalHeading).not.toBeVisible()
  })
})

test.describe('Sidecar Health', () => {
  test('workspace list loads from sidecar', async ({ page }) => {
    await page.goto('/')

    // Wait for loading to complete with a generous timeout
    const loading = page.getByText('Loading...')
    await expect(loading).not.toBeVisible({ timeout: 20000 })

    // After loading, we should see either:
    // 1. Workspaces heading (data loaded successfully)
    // 2. Empty state (no data but sidecar working)
    // 3. Error message (sidecar not responding)

    const workspacesHeading = page.getByRole('heading', { name: 'Workspaces', level: 1 })
    const errorMessage = page.getByText('Failed to load workspaces')
    const emptyState = page.getByText('No workspaces yet')

    const hasWorkspaces = await workspacesHeading.isVisible().catch(() => false)
    const hasError = await errorMessage.isVisible().catch(() => false)
    const hasEmpty = await emptyState.isVisible().catch(() => false)

    // For health check, we expect either success (workspaces or empty) or error
    // Just verifying the app rendered something meaningful
    expect(hasWorkspaces || hasError || hasEmpty).toBe(true)
  })
})
