import { test, expect } from '@playwright/test'

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

    // Should start at workspaces page
    await expect(page.getByRole('heading', { name: 'Workspaces', exact: true })).toBeVisible()

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Navigate back to workspaces
    await page.getByRole('link', { name: 'Workspaces' }).click()
    await expect(page.getByRole('heading', { name: 'Workspaces', exact: true })).toBeVisible()
  })

  test('empty state is shown', async ({ page }) => {
    await page.goto('http://localhost:1420')

    // Check for empty state
    await expect(page.getByText('No workspaces yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Workspace' })).toBeVisible()
  })
})
