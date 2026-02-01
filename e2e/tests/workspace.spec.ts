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
    test('displays workspaces page with header', async ({ page }) => {
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
    test('modal shows "New Workspace" heading with type choice', async ({ page }) => {
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

      // Should show "New Workspace" heading
      const modalHeading = getModalHeading(page, 'New Workspace')
      await expect(modalHeading).toBeVisible({ timeout: 5000 })

      // Should show instruction text for choosing workspace type
      await expect(page.getByText('Choose how to create your workspace')).toBeVisible()

      // Should have "With Repository" and "Standalone" options
      await expect(page.getByTestId('create-with-repo')).toBeVisible()
      await expect(page.getByTestId('create-standalone')).toBeVisible()
    })

    test('clicking "With Repository" shows repo selection', async ({ page }) => {
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

      // Click "With Repository" option
      await page.getByTestId('create-with-repo').click()
      await page.waitForTimeout(300)

      // Should show repo selection step
      await expect(page.getByText('Select a git repository')).toBeVisible()

      // Should have "Add Git Repository" button
      await expect(page.getByText('Add Git Repository')).toBeVisible()
    })

    test('clicking "Standalone" shows name input', async ({ page }) => {
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

      // Click "Standalone" option
      await page.getByTestId('create-standalone').click()
      await page.waitForTimeout(300)

      // Should show standalone workspace heading
      const standaloneHeading = getModalHeading(page, 'Standalone Workspace')
      await expect(standaloneHeading).toBeVisible({ timeout: 5000 })

      // Should have name input
      await expect(page.getByTestId('standalone-name-input')).toBeVisible()
    })

    test('shows existing repos when available', async ({ page }) => {
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

      // Wait for modal and click "With Repository"
      const modalHeading = getModalHeading(page, 'New Workspace')
      await expect(modalHeading).toBeVisible({ timeout: 5000 })
      await page.getByTestId('create-with-repo').click()
      await page.waitForTimeout(300)

      // Check for repo list
      const repoList = page.getByTestId('repo-list')
      const hasRepos = await repoList.isVisible().catch(() => false)

      // Either way, add repo button should exist
      await expect(page.getByText('Add Git Repository')).toBeVisible()

      if (hasRepos) {
        // Should show "Recent Repositories" label
        await expect(page.getByText('Recent Repositories')).toBeVisible()

        // Repo list should contain buttons
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

      const modalHeading = getModalHeading(page, 'New Workspace')
      await expect(modalHeading).toBeVisible({ timeout: 5000 })

      // Click "With Repository" option first
      await page.getByTestId('create-with-repo').click()
      await page.waitForTimeout(300)

      // Check if there are existing repos to select
      const repoList = page.getByTestId('repo-list')
      const hasRepos = await repoList.isVisible().catch(() => false)

      if (hasRepos) {
        // Click first repo button
        const repoButtons = repoList.locator('button')
        await repoButtons.first().click()
        await page.waitForTimeout(300)

        // Should show branch creation step
        const branchHeading = getModalHeading(page, 'Create Branch')
        await expect(branchHeading).toBeVisible({ timeout: 5000 })

        // Check for branch name input with placeholder
        const branchInput = page.locator('input[placeholder*="feature"]')
        await expect(branchInput).toBeVisible()

        // Should show info about git worktree
        await expect(page.getByText('A git worktree will be created')).toBeVisible()
      } else {
        test.skip(true, 'No repos available to select')
      }
    })

    test('back button returns to repo selection from branch step', async ({ page }) => {
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

      // Click "With Repository" option
      await page.getByTestId('create-with-repo').click()
      await page.waitForTimeout(300)

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

        // Should be back at repo selection step (shows "Select a git repository")
        await expect(page.getByText('Select a git repository')).toBeVisible({ timeout: 5000 })
      } else {
        test.skip(true, 'No repos available')
      }
    })

    test('cancel button closes modal', async ({ page }) => {
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

      const modalHeading = getModalHeading(page, 'New Workspace')
      await expect(modalHeading).toBeVisible({ timeout: 5000 })

      // Click cancel
      await page.getByRole('button', { name: 'Cancel' }).click()
      await page.waitForTimeout(300)

      // Modal should be closed
      await expect(modalHeading).not.toBeVisible()
    })
  })

  test.describe('Create Workspace E2E', () => {
    test('creating repo-based workspace navigates to it and shows in list', async ({ page }) => {
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

      // Click "With Repository" option
      await page.getByTestId('create-with-repo').click()
      await page.waitForTimeout(300)

      // Check for repos
      const repoList = page.getByTestId('repo-list')
      const hasRepos = await repoList.isVisible().catch(() => false)

      if (!hasRepos) {
        test.skip(true, 'No repos available - cannot test full create flow')
        return
      }

      // Select first repo
      const repoButtons = repoList.locator('button')
      await repoButtons.first().click()
      await page.waitForTimeout(300)

      // Enter unique branch name
      const branchName = `e2e-test-${Date.now()}`
      const branchInput = page.locator('input[placeholder*="feature"]')
      await expect(branchInput).toBeVisible({ timeout: 5000 })
      await branchInput.fill(branchName)

      // Click create
      await page.getByRole('button', { name: 'Create Workspace' }).click()

      // Wait for navigation to workspace view
      await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 })

      // Should show workspace view with chat
      await expect(page.getByTestId('agent-chat-container')).toBeVisible({ timeout: 10000 })

      // Go back to workspace list
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // The new workspace should appear in the list (use first() to avoid strict mode violation
      // since name appears in both sidebar and main content)
      await expect(page.getByText(branchName).first()).toBeVisible({ timeout: 10000 })
    })

    test('creating standalone workspace shows connect repo prompt', async ({ page }) => {
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

      // Click "Standalone" option
      await page.getByTestId('create-standalone').click()
      await page.waitForTimeout(300)

      // Enter unique workspace name
      const workspaceName = `e2e-standalone-${Date.now()}`
      const nameInput = page.getByTestId('standalone-name-input')
      await expect(nameInput).toBeVisible({ timeout: 5000 })
      await nameInput.fill(workspaceName)

      // Click create
      await page.getByTestId('create-standalone-button').click()

      // Wait for navigation to workspace view
      await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 })

      // Should show "Connect Repository" button (standalone workspace)
      const connectButton = page.getByTestId('connect-repo-button')
      await expect(connectButton).toBeVisible({ timeout: 10000 })

      // Should show the workspace name (use first() to avoid strict mode violation
      // since name appears in both sidebar and main content)
      await expect(page.getByText(workspaceName).first()).toBeVisible()

      // Should show instruction text
      await expect(page.getByText('Connect a repository to start chatting')).toBeVisible()
    })

    test('standalone workspace connect flow works end-to-end', async ({ page }) => {
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

      // Create standalone workspace
      await page.getByTestId('create-standalone').click()
      await page.waitForTimeout(300)

      const workspaceName = `e2e-connect-${Date.now()}`
      const nameInput = page.getByTestId('standalone-name-input')
      await nameInput.fill(workspaceName)
      await page.getByTestId('create-standalone-button').click()

      // Wait for workspace view
      await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 })

      // Click connect repo button
      const connectButton = page.getByTestId('connect-repo-button')
      await expect(connectButton).toBeVisible({ timeout: 10000 })
      await connectButton.click()

      // Should show repo selection
      await expect(page.getByText('Select Repository')).toBeVisible({ timeout: 5000 })

      // Check if there are existing repos
      const repoButtons = page.locator('button').filter({ hasText: /^\// }) // repos have paths starting with /
      const hasRepos = await repoButtons.count() > 0

      if (!hasRepos) {
        test.skip(true, 'No repos available to test connect flow')
        return
      }

      // Click first repo
      await repoButtons.first().click()
      await page.waitForTimeout(300)

      // Should show branch creation
      await expect(page.getByText('Create Branch')).toBeVisible({ timeout: 5000 })

      // Enter branch name
      const branchName = `e2e-branch-${Date.now()}`
      const branchInput = page.getByTestId('branch-name-input')
      await expect(branchInput).toBeVisible()
      await branchInput.fill(branchName)

      // Click create
      await page.getByTestId('create-branch-button').click()

      // Should navigate to the new worktree (URL changes to worktree ID)
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 })

      // Should now show the chat (not the connect prompt)
      await expect(page.getByTestId('agent-chat-container')).toBeVisible({ timeout: 10000 })
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
      } else {
        test.skip(true, 'No workspaces to open')
      }
    })

    test('workspace view shows chat container', async ({ page }) => {
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

        // Should show agent chat container
        await expect(page.getByTestId('agent-chat-container')).toBeVisible({ timeout: 10000 })
      } else {
        test.skip(true, 'No workspaces')
      }
    })
  })

  test.describe('Error States', () => {
    test('invalid workspace ID shows error state with back button', async ({ page }) => {
      // Navigate directly to a non-existent workspace
      await page.goto('/workspace/invalid-workspace-id-12345')
      await page.waitForLoadState('networkidle')

      // Should show error state
      await expect(page.getByText('Workspace not found')).toBeVisible({ timeout: 10000 })

      // Should have back button
      const backButton = page.getByRole('button', { name: 'Back to Workspaces' })
      await expect(backButton).toBeVisible()

      // Clicking back should navigate to home
      await backButton.click()
      await expect(page).toHaveURL('/')
    })
  })

  test.describe('Sidebar Integration', () => {
    test('sidebar shows workspaces heading', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      // Open a workspace to see the sidebar
      const workspaceCards = page.locator('button').filter({
        has: page.locator('h3'),
      })

      if ((await workspaceCards.count()) > 0) {
        await workspaceCards.first().click()
        await expect(page).toHaveURL(/\/workspace\//)

        // Sidebar should be visible with "Workspaces" text
        await expect(page.getByText('Workspaces').first()).toBeVisible({ timeout: 5000 })
      } else {
        test.skip(true, 'No workspaces to test sidebar')
      }
    })

    test('clicking workspace in sidebar navigates to it', async ({ page }) => {
      const loaded = await waitForWorkspacesPage(page)
      if (!loaded) {
        test.skip(true, 'Sidecar connection failed')
        return
      }

      // Open a workspace first
      const workspaceCards = page.locator('button').filter({
        has: page.locator('h3'),
      })

      const cardCount = await workspaceCards.count()
      if (cardCount < 2) {
        test.skip(true, 'Need at least 2 workspaces to test sidebar navigation')
        return
      }

      // Open first workspace
      await workspaceCards.first().click()
      await expect(page).toHaveURL(/\/workspace\//)
      const firstUrl = page.url()

      // Wait for sidebar to load
      await page.waitForTimeout(500)

      // Find workspace links in sidebar (they're <a> tags with href containing /workspace/)
      const sidebarLinks = page.locator('a[href*="/workspace/"]')
      const linkCount = await sidebarLinks.count()

      if (linkCount > 1) {
        // Click a different workspace in sidebar
        const secondLink = sidebarLinks.nth(1)
        await secondLink.click()

        // URL should change
        await page.waitForTimeout(500)
        expect(page.url()).not.toBe(firstUrl)
        await expect(page).toHaveURL(/\/workspace\//)
      } else {
        test.skip(true, 'Not enough workspaces in sidebar')
      }
    })
  })
})
