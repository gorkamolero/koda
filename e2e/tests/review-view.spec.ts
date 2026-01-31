import { test, expect, Page } from '@playwright/test'

/**
 * Review View E2E Tests
 *
 * Tests for the Code Review view functionality.
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
 * Navigate to Review view
 */
async function navigateToReviewView(
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

  // Navigate to Review tab
  await page.getByTestId('tab-review').click()
  await expect(page.getByTestId('review-view-container')).toBeVisible()

  return 'success'
}

test.describe('Review View', () => {
  test('displays review comments with mock data', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Should show file paths from mock comments
    await expect(page.getByText('src/components/TopBar.tsx')).toBeVisible()
    await expect(page.getByText('src/store/chat.ts')).toBeVisible()
  })

  test('displays filter tabs', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByTestId('review-filter-tabs')).toBeVisible()
    await expect(page.getByTestId('review-filter-all')).toBeVisible()
    await expect(page.getByTestId('review-filter-open')).toBeVisible()
    await expect(page.getByTestId('review-filter-resolved')).toBeVisible()
  })

  test('can filter to open comments only', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Click Open filter
    await page.getByTestId('review-filter-open').click()
    await expect(page.getByTestId('review-filter-open')).toHaveAttribute('data-active', 'true')

    // Open comment (TopBar.tsx) should be visible
    await expect(page.getByText('src/components/TopBar.tsx')).toBeVisible()
    // Resolved comment (chat.ts) should NOT be visible
    await expect(page.getByText('src/store/chat.ts')).not.toBeVisible()
  })

  test('can filter to resolved comments only', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Click Resolved filter
    await page.getByTestId('review-filter-resolved').click()
    await expect(page.getByTestId('review-filter-resolved')).toHaveAttribute('data-active', 'true')

    // Resolved comment (chat.ts) should be visible
    await expect(page.getByText('src/store/chat.ts')).toBeVisible()
    // Open comment (TopBar.tsx) should NOT be visible
    await expect(page.getByText('src/components/TopBar.tsx')).not.toBeVisible()
  })

  test('can expand comment to see content', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Click on first comment to expand
    await page.getByTestId('review-comment-toggle-comment-1').click()

    // Should show comment content
    await expect(
      page.getByText('Consider adding a loading state for the branch selector dropdown.')
    ).toBeVisible()
  })

  test('shows Resolve button for open comments', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Expand open comment
    await page.getByTestId('review-comment-toggle-comment-1').click()

    // Should show Resolve button (using testid for reliability)
    await expect(page.getByTestId('review-comment-resolve-comment-1')).toBeVisible()
  })

  test('shows Reopen button for resolved comments', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Expand resolved comment
    await page.getByTestId('review-comment-toggle-comment-2').click()

    // Should show Reopen button (using testid for reliability)
    await expect(page.getByTestId('review-comment-reopen-comment-2')).toBeVisible()
  })

  test('can toggle comment resolved state', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    // Expand open comment
    await page.getByTestId('review-comment-toggle-comment-1').click()

    // Click Resolve button
    await page.getByTestId('review-comment-resolve-comment-1').click()

    // Should now show Reopen instead (testid changes when state toggles)
    await expect(page.getByTestId('review-comment-reopen-comment-1')).toBeVisible()
  })

  test('shows Add comment button', async ({ page }) => {
    const result = await navigateToReviewView(page)
    if (result === 'sidecar-error') {
      test.skip(true, 'Sidecar connection failed')
      return
    }
    if (result === 'no-workspace') {
      test.skip(true, 'No workspaces available')
      return
    }

    await expect(page.getByText('Add comment')).toBeVisible()
  })
})
