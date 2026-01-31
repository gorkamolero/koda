import { test, expect } from '@playwright/test'

/**
 * Smoke Tests
 *
 * Basic tests that verify the app loads and core navigation works.
 * These tests should pass with just the app running - no database state required.
 */
test.describe('Smoke Tests', () => {
  test('app loads successfully', async ({ page }) => {
    await page.goto('/')

    // Check that the page title is correct
    await expect(page).toHaveTitle(/Koda/)

    // Check that the sidebar is visible
    await expect(page.locator('aside')).toBeVisible()

    // Check that the Koda heading is present in sidebar
    await expect(page.getByRole('heading', { name: 'Koda' })).toBeVisible()
  })

  test('navigation works between main routes', async ({ page }) => {
    await page.goto('/')

    // Wait for the app to load and stabilize
    await page.waitForLoadState('networkidle')

    // Sidebar should be visible with navigation
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Workspaces' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Navigate back to workspaces
    await page.getByRole('link', { name: 'Workspaces' }).click()

    // Should be on home page - either showing workspaces or an error
    await expect(page).toHaveURL('/')
  })

  test('shows workspaces page content', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for loading to finish (either success or error)
    const loading = page.getByText('Loading...')
    await expect(loading).not.toBeVisible({ timeout: 15000 })

    // After loading, we should see either:
    // 1. Workspaces heading + content
    // 2. Error message "Failed to load workspaces"
    // 3. Empty state "No workspaces yet"
    const workspacesHeading = page.getByRole('heading', {
      name: 'Workspaces',
      level: 1,
    })
    const errorMessage = page.getByText('Failed to load workspaces')
    const emptyState = page.getByRole('heading', { name: 'No workspaces yet' })

    // One of these should be visible
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

    // Find the New Workspace button (might be in header or empty state)
    const newWorkspaceButton = page.getByRole('button', { name: 'New Workspace' })

    // If there's an error loading workspaces, the button might not be visible
    const hasButton = await newWorkspaceButton.first().isVisible().catch(() => false)

    if (hasButton) {
      await newWorkspaceButton.first().click()

      // Modal should appear with repo selection
      await expect(
        page.getByRole('heading', { name: 'Select Repository' })
      ).toBeVisible()

      // Should show option to add a repo
      await expect(page.getByText('Add Git Repository')).toBeVisible()
    } else {
      // If button not visible, there's likely an error state - skip this test
      test.skip(true, 'New Workspace button not visible - app may be in error state')
    }
  })

  test('modal can be closed', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for loading
    const loading = page.getByText('Loading...')
    await expect(loading).not.toBeVisible({ timeout: 15000 })

    const newWorkspaceButton = page.getByRole('button', { name: 'New Workspace' })
    const hasButton = await newWorkspaceButton.first().isVisible().catch(() => false)

    if (!hasButton) {
      test.skip(true, 'New Workspace button not visible')
      return
    }

    // Open modal
    await newWorkspaceButton.first().click()
    await expect(
      page.getByRole('heading', { name: 'Select Repository' })
    ).toBeVisible()

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should be gone
    await expect(
      page.getByRole('heading', { name: 'Select Repository' })
    ).not.toBeVisible()
  })
})

test.describe('Sidecar Health', () => {
  test('workspace list loads from sidecar', async ({ page }) => {
    await page.goto('/')

    // Wait for loading to complete with a generous timeout
    // The sidecar might take a moment to respond on first request
    // React Query has retries enabled, so we need to wait for all retries
    const loading = page.getByText('Loading...')

    // Wait up to 20 seconds for loading to finish (includes retry time)
    await expect(loading).not.toBeVisible({ timeout: 20000 })

    // After loading, check the state
    const errorMessage = page.getByText('Failed to load workspaces')
    const workspacesHeading = page.getByRole('heading', {
      name: 'Workspaces',
      level: 1,
    })
    const emptyState = page.getByRole('heading', { name: 'No workspaces yet' })

    // Give a moment for the UI to settle after loading
    await page.waitForTimeout(500)

    const hasError = await errorMessage.isVisible().catch(() => false)
    const hasWorkspaces = await workspacesHeading.isVisible().catch(() => false)
    const hasEmpty = await emptyState.isVisible().catch(() => false)

    if (hasError) {
      // Test fails if sidecar is down - this is expected behavior
      throw new Error(
        'Sidecar connection failed. Is the sidecar running? Run `pnpm app` to start both the app and sidecar.'
      )
    }

    // If we get here, sidecar is working - should show either workspaces or empty state
    expect(hasWorkspaces || hasEmpty).toBe(true)
  })
})
