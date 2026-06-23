import { test, expect } from "@playwright/test"

test.describe("Auth advanced", () => {
  // ──────────────────────────────────────────────
  // Login failures
  // ──────────────────────────────────────────────
  test.describe("Login failures", () => {
    test("wrong password shows error message", async ({ page }) => {
      await page.goto("/login")
      await page.fill('input[name="email"]', "demo@qrstudio.app")
      await page.fill('input[name="password"]', "wrong-password-98765")
      await page.click('button[type="submit"]')

      await expect(
        page.locator("[data-sonner-toast]"),
      ).toContainText("Email ou mot de passe incorrect", { timeout: 5000 })
    })

    test("unregistered email shows appropriate error", async ({ page }) => {
      await page.goto("/login")
      await page.fill('input[name="email"]', `nonexistent-${Date.now()}@example.com`)
      await page.fill('input[name="password"]', "somepassword123")
      await page.click('button[type="submit"]')

      await expect(
        page.locator("[data-sonner-toast]"),
      ).toContainText("Email ou mot de passe incorrect", { timeout: 5000 })
    })

    test("invalid email format rejected", async ({ page }) => {
      await page.goto("/login")
      await page.fill('input[name="email"]', "not-an-email")
      await page.fill('input[name="password"]', "password123")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Email invalide"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("empty email field shows validation", async ({ page }) => {
      await page.goto("/login")
      await page.fill('input[name="email"]', "")
      await page.fill('input[name="password"]', "password123")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Email invalide"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("empty password field shows validation", async ({ page }) => {
      await page.goto("/login")
      await page.fill('input[name="email"]', "demo@qrstudio.app")
      await page.fill('input[name="password"]', "")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Mot de passe requis"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("empty both fields shows validations", async ({ page }) => {
      await page.goto("/login")
      await page.fill('input[name="email"]', "")
      await page.fill('input[name="password"]', "")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Email invalide"),
      ).toBeVisible({ timeout: 5000 })
      await expect(
        page.getByText("Mot de passe requis"),
      ).toBeVisible({ timeout: 5000 })
    })
  })

  // ──────────────────────────────────────────────
  // Register failures
  // ──────────────────────────────────────────────
  test.describe("Register failures", () => {
    test("existing email shows already used error", async ({ page }) => {
      await page.goto("/register")
      await page.fill('input[name="name"]', "Duplicate Test")
      await page.fill('input[name="email"]', "demo@qrstudio.app")
      await page.fill('input[name="password"]', "password123")
      await page.fill('input[name="confirmPassword"]', "password123")
      await page.click('button[type="submit"]')

      await expect(
        page.locator("[data-sonner-toast]"),
      ).toContainText("Cet email est déjà utilisé", { timeout: 5000 })
    })

    test("password too short shows validation", async ({ page }) => {
      await page.goto("/register")
      await page.fill('input[name="name"]', "Short Pw User")
      await page.fill('input[name="email"]', `shortpw-${Date.now()}@example.com`)
      await page.fill('input[name="password"]', "short")
      await page.fill('input[name="confirmPassword"]', "short")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Le mot de passe doit contenir au moins 8 caractères"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("empty name rejected", async ({ page }) => {
      await page.goto("/register")
      await page.fill('input[name="name"]', "")
      await page.fill('input[name="email"]', `noname-${Date.now()}@example.com`)
      await page.fill('input[name="password"]', "password123")
      await page.fill('input[name="confirmPassword"]', "password123")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Le nom doit contenir au moins 2 caractères"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("invalid email format rejected", async ({ page }) => {
      await page.goto("/register")
      await page.fill('input[name="name"]', "Bad Email User")
      await page.fill('input[name="email"]', "not-an-email")
      await page.fill('input[name="password"]', "password123")
      await page.fill('input[name="confirmPassword"]', "password123")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Email invalide"),
      ).toBeVisible({ timeout: 5000 })
    })
  })

  // ──────────────────────────────────────────────
  // Route protection
  // ──────────────────────────────────────────────
  test.describe("Route protection", () => {
    test("access dashboard without auth redirects to login", async ({ page }) => {
      await page.goto("/dashboard")
      await page.waitForURL(/\/login/, { timeout: 10000 })

      await expect(page).toHaveURL(/\/login/)
      expect(page.url()).toContain("callbackUrl=%2Fdashboard")
    })

    test("access dashboard settings without auth redirects to login", async ({ page }) => {
      await page.goto("/dashboard/settings")
      await page.waitForURL(/\/login/, { timeout: 10000 })

      await expect(page).toHaveURL(/\/login/)
      expect(page.url()).toContain("callbackUrl=%2Fdashboard%2Fsettings")
    })
  })

  // ──────────────────────────────────────────────
  // Session
  // ──────────────────────────────────────────────
  test.describe("Session persistence", () => {
    test("login persists across page refresh", async ({ page }) => {
      await page.goto("/login")
      await page.fill('input[name="email"]', "demo@qrstudio.app")
      await page.fill('input[name="password"]', "demo-password")
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })

      await page.reload()
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })

      await expect(
        page.locator("h1"),
      ).toContainText(/dashboard|tableau de bord/i)
    })

    test("logout redirects to login and dashboard inaccessible", async ({ page }) => {
      // Login first
      await page.goto("/login")
      await page.fill('input[name="email"]', "demo@qrstudio.app")
      await page.fill('input[name="password"]', "demo-password")
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })

      // Open sidebar user dropdown and logout
      const userEmail = page.getByText("demo@qrstudio.app")
      await userEmail.scrollIntoViewIfNeeded()
      await userEmail.click()
      await page.getByRole("menuitem", { name: "Déconnexion" }).click()
      await page.waitForURL(/\/login/, { timeout: 10000 })
      await expect(page).toHaveURL(/\/login/)

      // Try accessing dashboard — should redirect back to login
      await page.goto("/dashboard")
      await page.waitForURL(/\/login/, { timeout: 10000 })
      await expect(page).toHaveURL(/\/login/)
      expect(page.url()).toContain("callbackUrl=%2Fdashboard")
    })
  })

  // ──────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────
  test.describe("Edge cases", () => {
    test("rapid repeated failed logins handled gracefully", async ({ page }) => {
      await page.goto("/login")

      for (let i = 0; i < 10; i++) {
        await page.fill(
          'input[name="email"]',
          `rapid-${i}-${Date.now()}@example.com`,
        )
        await page.fill('input[name="password"]', "wrongpassword")
        await page.click('button[type="submit"]')
        // Small pause between attempts to avoid overwhelming the browser
        await page.waitForTimeout(150)
      }

      // Page should still be functional — no crash, no 500
      await expect(
        page.locator('button[type="submit"]'),
      ).toBeVisible({ timeout: 5000 })
      await expect(page.locator("h1")).toContainText("Connexion")
    })

    test("very long email handled gracefully", async ({ page }) => {
      await page.goto("/login")
      const longEmail = "a".repeat(250) + "@b.co"

      await page.fill('input[name="email"]', longEmail)
      await page.fill('input[name="password"]', "password123")
      await page.click('button[type="submit"]')

      // Should either show a client-side validation error or a server error
      // but never crash or return a 500
      const hasValidationError = await page.getByText("Email invalide").isVisible().catch(() => false)
      const hasToast = await page.locator("[data-sonner-toast]").isVisible().catch(() => false)
      const formStillPresent = await page.locator('button[type="submit"]').isVisible()

      expect(formStillPresent).toBe(true)
      // At least one of these should be true (validation or server error)
      expect(hasValidationError || hasToast).toBe(true)
    })

    test("SQL injection attempt in email handled safely", async ({ page }) => {
      await page.goto("/login")
      await page.fill('input[name="email"]', "' OR '1'='1'@example.com")
      await page.fill('input[name="password"]', "password123")
      await page.click('button[type="submit"]')

      // Zod: "' OR '1'='1'@example.com" fails .email() → inline error
      await expect(
        page.getByText("Email invalide"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("XSS attempt in name handled safely", async ({ page }) => {
      // Listen for unexpected dialogs (alert from injected script)
      let dialogTriggered = false
      page.on("dialog", () => {
        dialogTriggered = true
      })

      const xssName = '<script>alert("xss")</script>'
      const xssEmail = `xss-${Date.now()}@example.com`

      await page.goto("/register")
      await page.fill('input[name="name"]', xssName)
      await page.fill('input[name="email"]', xssEmail)
      await page.fill('input[name="password"]', "password123")
      await page.fill('input[name="confirmPassword"]', "password123")
      await page.click('button[type="submit"]')

      // Registration succeeds → redirect to /login
      await page.waitForURL(/\/login/, { timeout: 10000 })
      await expect(page.locator("h1")).toContainText("Connexion")

      // No XSS dialog should have been triggered
      expect(dialogTriggered).toBe(false)
    })
  })
})
