import { test, expect } from "@playwright/test"

test.describe("Auth flows", () => {
  test("register → workspace created → redirect to dashboard", async ({ page }) => {
    await page.goto("/auth/register")
    await page.fill('input[name="name"]', "Test User")
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[name="password"]', "password123")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.locator("h1")).toContainText(/tableau de bord|dashboard/i)
  })

  test("login with email/password → redirect to dashboard", async ({ page }) => {
    await page.goto("/auth/login")
    await page.fill('input[name="email"]', "demo@qrstudio.app")
    await page.fill('input[name="password"]', "demo-password")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.locator("h1")).toContainText(/tableau de bord|dashboard/i)
  })
})
