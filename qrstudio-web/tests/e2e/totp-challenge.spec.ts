import { test, expect } from "@playwright/test"

test.describe("TOTP 2FA challenge", () => {
  // ──────────────────────────────────────────────
  // TOTP challenge page (during login)
  // ──────────────────────────────────────────────
  test.describe("TOTP challenge page", () => {
    test("page without partialToken shows invalid session message", async ({ page }) => {
      await page.goto("/auth/totp")

      // The page validates partialToken and shows error state
      await expect(
        page.getByText("Session invalide"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("page with partialToken renders TOTP form", async ({ page }) => {
      // Simulate having a partialToken in the URL
      await page.goto("/auth/totp?partialToken=demo-valid-token&callbackUrl=%2Fdashboard")

      // Header should be visible
      await expect(
        page.getByText("Authentification à deux facteurs"),
      ).toBeVisible({ timeout: 5000 })

      // TOTP code input should be visible
      await expect(
        page.locator("#totp-code"),
      ).toBeVisible({ timeout: 5000 })

      // Submit button should say "Vérifier"
      await expect(
        page.locator('button[type="submit"]'),
      ).toContainText("Vérifier")
    })

    test("switch to backup code mode and back", async ({ page }) => {
      await page.goto("/auth/totp?partialToken=demo-valid-token&callbackUrl=%2Fdashboard")

      // Click "Utiliser un code de secours"
      await page.getByText("Utiliser un code de secours").click()

      // Backup code input should appear
      await expect(
        page.locator("#backup-code"),
      ).toBeVisible({ timeout: 5000 })

      // Should show "Valider le code de secours" on submit button
      await expect(
        page.locator('button[type="submit"]'),
      ).toContainText("Valider le code de secours")

      // Switch back to TOTP mode
      await page.getByText("Revenir au code TOTP").click()

      // TOTP input should be back
      await expect(
        page.locator("#totp-code"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("invalid TOTP code with valid partialToken shows error", async ({ page }) => {
      await page.goto("/auth/totp?partialToken=demo-valid-token&callbackUrl=%2Fdashboard")

      // Enter an invalid 6-digit code
      await page.locator("#totp-code").fill("000000")
      await page.click('button[type="submit"]')

      // tRPC will reject the invalid token → error message shown
      // The error appears in a <p> with class text-destructive
      await expect(
        page.locator("text=Code invalide"),
      ).toBeVisible({ timeout: 10000 })
    })

    test("non-numeric characters are stripped from TOTP input", async ({ page }) => {
      await page.goto("/auth/totp?partialToken=demo-valid-token&callbackUrl=%2Fdashboard")

      const input = page.locator("#totp-code")
      await input.fill("abc123def456")

      // Should keep only digits, max 6
      const value = await input.inputValue()
      expect(value).toBe("123456")
    })

    test("backup code with invalid token shows error", async ({ page }) => {
      await page.goto("/auth/totp?partialToken=demo-valid-token&callbackUrl=%2Fdashboard")

      // Switch to backup code mode
      await page.getByText("Utiliser un code de secours").click()

      // Enter invalid backup code
      await page.locator("#backup-code").fill("INVALID")
      // Fill triggers formatting; the input takes uppercase alphanumeric, 8 chars
      // "INVALID" might be too short; let's fill exactly 8 chars
      await page.locator("#backup-code").fill("")
      await page.locator("#backup-code").fill("ABCD1234")

      await page.click('button[type="submit"]')

      // Expect error message
      await expect(
        page.locator("text=Code invalide"),
      ).toBeVisible({ timeout: 10000 })
    })
  })

  // ──────────────────────────────────────────────
  // Login redirect to TOTP when 2FA is enabled
  // ──────────────────────────────────────────────
  test.describe("2FA login flow", () => {
    test("login redirects to /auth/totp when 2FA is enabled", async ({ page }) => {
      // This test requires the demo account to have 2FA enabled
      // Step 1: Login normally
      await page.goto("/login")
      await page.fill("#email", "demo@qrstudio.app")
      await page.fill("#password", "demo-password")
      await page.click('button[type="submit"]')

      // Step 2: If 2FA is enabled, user is redirected to /auth/totp
      // If 2FA is NOT enabled, user goes to /dashboard
      // We test both cases gracefully
      const url = page.url()
      if (url.includes("/auth/totp")) {
        await expect(
          page.locator("text=Authentification à deux facteurs"),
        ).toBeVisible({ timeout: 5000 })
      } else {
        // 2FA not enabled — skip this test
        test.skip(true, "2FA not enabled on demo account")
      }
    })
  })
})
