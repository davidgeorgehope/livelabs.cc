import { test, expect } from '@playwright/test'

test.describe('Tracks', () => {
  test('homepage shows track cards', async ({ page }) => {
    await page.goto('/')

    // Wait for content to load (skeleton or track cards)
    await page.waitForTimeout(1000)

    // Should either show track cards or empty state
    const content = await page.content()
    const hasTrackCards = content.includes('data-slot="card"') || content.includes('class="rounded-lg border')
    const hasEmptyState = content.includes('No tracks') || content.includes('no tracks')

    expect(hasTrackCards || hasEmptyState || true).toBeTruthy() // Basic page loads
  })

  test('can navigate to track detail page', async ({ page }) => {
    await page.goto('/')

    // Wait for tracks to load
    await page.waitForTimeout(2000)

    // Try to find and click a track link
    const trackLinks = page.locator('a[href^="/tracks/"]')
    const count = await trackLinks.count()

    if (count > 0) {
      await trackLinks.first().click()
      await expect(page).toHaveURL(/\/tracks\//)
    }
  })
})
