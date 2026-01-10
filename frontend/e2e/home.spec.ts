import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test('displays the homepage with correct title', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/LiveLabs/)
    await expect(page.getByRole('heading', { name: 'Learn by Doing' })).toBeVisible()
  })

  test('shows login and signup buttons when not authenticated', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign Up' })).toBeVisible()
  })

  test('displays the LiveLabs logo in header', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'LiveLabs' })).toBeVisible()
  })
})
