import { test, expect } from "@playwright/test"

test.describe("QR CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login")
    await page.fill('input[name="email"]', "demo@qrstudio.app")
    await page.fill('input[name="password"]', "demo-password")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  })

  test("create URL QR code → visible in list", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.fill('input[name="name"]', "E2E Test QR")
    await page.fill('input[name="destinationUrl"]', "https://example.com")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard\/qr/, { timeout: 10000 })
    await expect(page.locator("text=E2E Test QR")).toBeVisible()
  })

  test("modify QR destination → update persisted", async ({ page }) => {
    await page.goto("/dashboard/qr")
    await page.click("text=E2E Test QR")
    await page.fill('input[name="destinationUrl"]', "https://updated.example.com")
    await page.click('button[type="submit"]')
    await expect(page.locator("text=Mise à jour réussie")).toBeVisible({ timeout: 5000 })
  })
})
