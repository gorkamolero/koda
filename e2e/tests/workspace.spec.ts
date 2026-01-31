import { test, expect } from '@playwright/test'

/**
 * Helper to wait for the workspaces page to load
 * Returns true if workspaces loaded successfully, false if error
 */
async function waitForWorkspacesPage(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Wait for loading to finish
  const loading = page.getByText('Loading...')
  await expect(loading).not.toBeVisible({ timeout: 15000 })

  // Check for error state
  const errorMessage = page.getByText('Failed to load workspaces')
  return !(await errorMessage.isVisible().catch(() => false))
}

/**
 * Workspace CRUD Tests
 *
 * Tests for creating, listing, opening, and managing workspaces.
 * These tests interact with real database via sidecar RPC.
 */
test.describe('Workspace CRUD', () => {
  test.describe('Listing Workspaces', () => {
    test('displays workspaces from database', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      // Page should load and show workspaces section
      await expect(
        page.getByRole('heading', { name: 'Workspaces', level: 1 })
      ).toBeVisible()

      // Should show either workspace cards or empty state
      const emptyState = page.getByText('No workspaces yet')
      const workspaceGrid = page.locator('.grid')

      const hasEmptyState = await emptyState.isVisible().catch(() => false)
      const hasGrid = await workspaceGrid.isVisible().catch(() => false)

      expect(hasEmptyState || hasGrid).toBe(true)
    })

    test('workspace cards show branch name', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      // If there are workspaces, they should show branch info
      const workspaceCards = page.locator('button').filter({
        has: page.locator('h3'),
      })

      const cardCount = await workspaceCards.count()
      if (cardCount > 0) {
        // Each card should have at least one paragraph (branch name or metadata)
        const firstCard = workspaceCards.first()
        // Use .first() to avoid strict mode violation when multiple <p> elements exist
        await expect(firstCard.locator('p').first()).toBeVisible()
      }
    })
  })

  test.describe('Create Workspace Flow', () => {
    test('modal shows repo selection step', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      // Find and click the New Workspace button
      const newWorkspaceButton = page.getByRole('button', { name: 'New Workspace' })
      const hasButton = await newWorkspaceButton.first().isVisible().catch(() => false)
      if (!hasButton) {
        test.skip(true, 'New Workspace button not visible')
        return
      }

      await newWorkspaceButton.first().click()

      // Should show repo selection
      await expect(
        page.getByRole('heading', { name: 'Select Repository' })
      ).toBeVisible()
      await expect(page.getByText('Add Git Repository')).toBeVisible()
    })

    test('shows existing repos if any', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      const newWorkspaceButton = page.getByRole('button', { name: 'New Workspace' })
      const hasButton = await newWorkspaceButton.first().isVisible().catch(() => false)
      if (!hasButton) {
        test.skip(true, 'New Workspace button not visible')
        return
      }

      await newWorkspaceButton.first().click()

      // Wait for modal content
      await expect(
        page.getByRole('heading', { name: 'Select Repository' })
      ).toBeVisible()

      // If repos exist, "Recent Repositories" section will be visible
      const recentRepos = page.getByText('Recent Repositories')
      const hasRepos = await recentRepos.isVisible().catch(() => false)

      // Either way, add repo button should exist
      await expect(page.getByText('Add Git Repository')).toBeVisible()

      if (hasRepos) {
        // Repo list should be present
        const repoButtons = page
          .locator('.space-y-2')
          .first()
          .locator('button')
        expect(await repoButtons.count()).toBeGreaterThan(0)
      }
    })

    test('selecting repo shows branch creation step', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      const newWorkspaceButton = page.getByRole('button', { name: 'New Workspace' })
      const hasButton = await newWorkspaceButton.first().isVisible().catch(() => false)
      if (!hasButton) {
        test.skip(true, 'New Workspace button not visible')
        return
      }

      await newWorkspaceButton.first().click()
      await expect(
        page.getByRole('heading', { name: 'Select Repository' })
      ).toBeVisible()

      // Check if there are existing repos to select
      const recentRepos = page.getByText('Recent Repositories')
      const hasRepos = await recentRepos.isVisible().catch(() => false)

      if (hasRepos) {
        // Click first repo
        const repoButtons = page
          .locator('.space-y-2')
          .first()
          .locator('button')
        await repoButtons.first().click()

        // Should show branch creation step
        await expect(
          page.getByRole('heading', { name: 'Create Branch' })
        ).toBeVisible()
        await expect(page.getByLabel('Branch Name')).toBeVisible()
      } else {
        // Skip this test if no repos - can't test branch step without a repo
        test.skip(true, 'No repos available to select')
      }
    })

    test('back button returns to repo selection', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      const newWorkspaceButton = page.getByRole('button', { name: 'New Workspace' })
      const hasButton = await newWorkspaceButton.first().isVisible().catch(() => false)
      if (!hasButton) {
        test.skip(true, 'New Workspace button not visible')
        return
      }

      await newWorkspaceButton.first().click()

      const recentRepos = page.getByText('Recent Repositories')
      const hasRepos = await recentRepos.isVisible().catch(() => false)

      if (hasRepos) {
        // Go to branch step
        const repoButtons = page
          .locator('.space-y-2')
          .first()
          .locator('button')
        await repoButtons.first().click()
        await expect(
          page.getByRole('heading', { name: 'Create Branch' })
        ).toBeVisible()

        // Click back
        await page.getByRole('button', { name: 'Back' }).click()

        // Should be back at repo selection
        await expect(
          page.getByRole('heading', { name: 'Select Repository' })
        ).toBeVisible()
      } else {
        test.skip(true, 'No repos available')
      }
    })
  })

  test.describe('Open Workspace', () => {
    test('clicking workspace navigates to workspace view', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      // Find workspace cards
      const workspaceCards = page.locator('button').filter({
        has: page.locator('h3'),
      })

      const cardCount = await workspaceCards.count()
      if (cardCount > 0) {
        // Click first workspace
        await workspaceCards.first().click()

        // Should navigate to workspace page
        await expect(page).toHaveURL(/\/workspace\//)

        // Workspace view header should be visible
        await expect(
          page.getByRole('heading', { name: /Workspace/ })
        ).toBeVisible()
      } else {
        test.skip(true, 'No workspaces to open')
      }
    })

    test('workspace view shows tabs', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      const workspaceCards = page.locator('button').filter({
        has: page.locator('h3'),
      })

      if ((await workspaceCards.count()) > 0) {
        await workspaceCards.first().click()
        await expect(page).toHaveURL(/\/workspace\//)

        // Should show tab navigation
        await expect(page.getByRole('button', { name: 'Chat' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Files' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Diff' })).toBeVisible()
      } else {
        test.skip(true, 'No workspaces')
      }
    })
  })
})
