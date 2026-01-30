import { test, expect } from './fixtures'

test.describe('Smoke Tests', () => {

  test('app loads successfully', async ({ page }) => {
    await page.goto('http://localhost:1420')

    // Check that the page title is correct
    await expect(page).toHaveTitle(/Koda/)

    // Check that the sidebar is visible
    await expect(page.locator('aside')).toBeVisible()

    // Check that the Koda heading is present
    await expect(page.getByRole('heading', { name: 'Koda' })).toBeVisible()
  })

  test('navigation works', async ({ page }) => {
    await page.goto('http://localhost:1420')

    // Wait for the app to load
    await page.waitForLoadState('networkidle')

    // Should start at workspaces page - check for the main h1 heading
    await expect(page.getByRole('heading', { name: 'Workspaces', level: 1 })).toBeVisible()

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Navigate back to workspaces
    await page.getByRole('link', { name: 'Workspaces' }).click()
    await expect(page.getByRole('heading', { name: 'Workspaces', level: 1 })).toBeVisible()
  })

  test('empty state is shown when no workspaces', async ({ page }) => {
    await page.goto('http://localhost:1420')

    // Wait for the app to load
    await page.waitForLoadState('networkidle')

    // Check for empty state heading
    await expect(page.getByRole('heading', { name: 'No workspaces yet' })).toBeVisible()
    // Check for at least one "New Workspace" button
    await expect(page.getByRole('button', { name: 'New Workspace' }).first()).toBeVisible()
  })

  test('create workspace modal opens', async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')

    // Click new workspace button (use the one in the header)
    await page.getByRole('button', { name: 'New Workspace' }).first().click()

    // Modal should appear
    await expect(page.getByRole('heading', { name: 'Select Repository' })).toBeVisible()

    // Should show add repo button
    await expect(page.getByText('Add Git Repository')).toBeVisible()
  })
})
