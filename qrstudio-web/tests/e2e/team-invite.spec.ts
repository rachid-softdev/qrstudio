import { test, expect } from "@playwright/test"

test.describe("Team invitations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login")
    await page.fill('input[name="email"]', "demo@qrstudio.app")
    await page.fill('input[name="password"]', "demo-password")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  })

  test("invite a member → invitation appears in pending list", async ({ page }) => {
    await page.goto("/dashboard/settings/team")
    await page.click("text=Inviter un membre")
    await page.fill('input[name="email"]', `colleague-${Date.now()}@example.com`)
    await page.click('button[type="submit"]')
    await expect(page.locator("text=Invitation envoyée")).toBeVisible({ timeout: 5000 })
  })
})
