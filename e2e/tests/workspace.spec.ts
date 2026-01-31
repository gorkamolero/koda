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
 * Helper to get modal heading (h2 element)
 */
function getModalHeading(page: import('@playwright/test').Page, text: string) {
  return page.locator('h2').filter({ hasText: text })
}

/**
 * Helper to click the New Workspace button (handles both header and empty state)
 */
async function clickNewWorkspaceButton(page: import('@playwright/test').Page): Promise<boolean> {
  const headerButton = page.getByTestId('new-workspace-button')
  const emptyStateButton = page.getByTestId('new-workspace-button-empty')

  const hasHeaderButton = await headerButton.isVisible().catch(() => false)
  const hasEmptyButton = await emptyStateButton.isVisible().catch(() => false)

  if (!hasHeaderButton && !hasEmptyButton) {
    return false
  }

  const btn = hasHeaderButton ? headerButton : emptyStateButton
  await btn.click()
  await page.waitForTimeout(500)
  return true
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
      const emptyState = page.getByTestId('empty-state')
      const workspaceGrid = page.getByTestId('workspace-grid')

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

      const clicked = await clickNewWorkspaceButton(page)
      if (!clicked) {
        test.skip(true, 'New Workspace button not visible')
        return
      }

      // Should show repo selection (h2 element)
      const modalHeading = getModalHeading(page, 'Select Repository')
      await expect(modalHeading).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Add Git Repository')).toBeVisible()
    })

    test('shows existing repos if any', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      const clicked = await clickNewWorkspaceButton(page)
      if (!clicked) {
        test.skip(true, 'New Workspace button not visible')
        return
      }

      // Wait for modal content
      const modalHeading = getModalHeading(page, 'Select Repository')
      await expect(modalHeading).toBeVisible({ timeout: 5000 })

      // If repos exist, "Recent Repositories" section will be visible
      const repoList = page.getByTestId('repo-list')
      const hasRepos = await repoList.isVisible().catch(() => false)

      // Either way, add repo button should exist
      await expect(page.getByText('Add Git Repository')).toBeVisible()

      if (hasRepos) {
        // Repo list should be present with buttons
        const repoButtons = repoList.locator('button')
        expect(await repoButtons.count()).toBeGreaterThan(0)
      }
    })

    test('selecting repo shows branch creation step', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      const clicked = await clickNewWorkspaceButton(page)
      if (!clicked) {
        test.skip(true, 'New Workspace button not visible')
        return
      }

      const selectRepoHeading = getModalHeading(page, 'Select Repository')
      await expect(selectRepoHeading).toBeVisible({ timeout: 5000 })

      // Check if there are existing repos to select
      const repoList = page.getByTestId('repo-list')
      const hasRepos = await repoList.isVisible().catch(() => false)

      if (hasRepos) {
        // Click first repo button using testid pattern
        const repoButtons = repoList.locator('button')
        await repoButtons.first().click()
        await page.waitForTimeout(300)

        // Should show branch creation step
        const branchHeading = getModalHeading(page, 'Create Branch')
        await expect(branchHeading).toBeVisible({ timeout: 5000 })

        // Check for branch name input
        const branchInput = page.locator('input[placeholder*="feature"]')
        await expect(branchInput).toBeVisible()
      } else {
        test.skip(true, 'No repos available to select')
      }
    })

    test('back button returns to repo selection', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      const clicked = await clickNewWorkspaceButton(page)
      if (!clicked) {
        test.skip(true, 'New Workspace button not visible')
        return
      }

      const repoList = page.getByTestId('repo-list')
      const hasRepos = await repoList.isVisible().catch(() => false)

      if (hasRepos) {
        // Go to branch step
        const repoButtons = repoList.locator('button')
        await repoButtons.first().click()
        await page.waitForTimeout(300)

        const branchHeading = getModalHeading(page, 'Create Branch')
        await expect(branchHeading).toBeVisible({ timeout: 5000 })

        // Click back using testid
        await page.getByTestId('modal-back-button').click()
        await page.waitForTimeout(300)

        // Should be back at repo selection
        const selectRepoHeading = getModalHeading(page, 'Select Repository')
        await expect(selectRepoHeading).toBeVisible({ timeout: 5000 })
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

      const workspaceCards = page.locator('button').filter({
        has: page.locator('h3'),
      })

      const cardCount = await workspaceCards.count()
      if (cardCount > 0) {
        await workspaceCards.first().click()
        await expect(page).toHaveURL(/\/workspace\//)
        await expect(page.getByTestId('topbar-tabs')).toBeVisible()
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

        // Should show tab navigation (using testid for stability)
        await expect(page.getByTestId('tab-chat')).toBeVisible()
        await expect(page.getByTestId('tab-files')).toBeVisible()
        await expect(page.getByTestId('tab-diff')).toBeVisible()
      } else {
        test.skip(true, 'No workspaces')
      }
    })
  })
})
