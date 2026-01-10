import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('can navigate to login page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Login' }).click()

    await expect(page).toHaveURL('/login')
    // Verify login form is visible
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('can navigate to register page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign Up' }).click()

    await expect(page).toHaveURL('/register')
    // Verify register form is visible
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('login form has email and password fields', async ({ page }) => {
    await page.goto('/login')

    // Wait for form to load
    await page.waitForTimeout(500)

    // Check for input fields by placeholder or type
    await expect(page.locator('input[type="email"], input[placeholder*="mail"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('register form has input fields', async ({ page }) => {
    await page.goto('/register')

    // Wait for form to load
    await page.waitForTimeout(500)

    // Check form has multiple inputs
    const inputs = page.locator('input')
    await expect(inputs).toHaveCount(await inputs.count())
    expect(await inputs.count()).toBeGreaterThanOrEqual(3)
  })

  test('shows error on invalid login', async ({ page }) => {
    await page.goto('/login')

    // Fill in the form
    await page.locator('input[type="email"], input[placeholder*="mail"]').fill('invalid@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')

    // Click submit button in the main content area
    await page.locator('main button[type="submit"], form button').first().click()

    // Wait for error message
    await expect(page.getByText(/Invalid|error|failed/i)).toBeVisible({ timeout: 5000 })
  })
})
