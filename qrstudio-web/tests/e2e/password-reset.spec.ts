import { test, expect } from "@playwright/test"

test.describe("Password reset flow", () => {
  // ──────────────────────────────────────────────
  // Forgot password page
  // ──────────────────────────────────────────────
  test.describe("Forgot password", () => {
    test("page loads with correct title and form", async ({ page }) => {
      await page.goto("/forgot-password")

      await expect(page.locator("h1")).toContainText("Mot de passe oublié")
      await expect(page.locator("text=Envoyer le lien de réinitialisation")).toBeVisible()
    })

    test("empty email shows validation error", async ({ page }) => {
      await page.goto("/forgot-password")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Email invalide"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("invalid email format shows validation error", async ({ page }) => {
      await page.goto("/forgot-password")
      await page.fill("#email", "not-an-email")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Email invalide"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("submitting valid email shows success state", async ({ page }) => {
      await page.goto("/forgot-password")
      await page.fill("#email", "demo@qrstudio.app")
      await page.click('button[type="submit"]')

      // On success, component shows success state with "Email envoyé"
      await expect(
        page.getByText("Email envoyé"),
      ).toBeVisible({ timeout: 8000 })

      // "Retour à la connexion" button is present
      await expect(
        page.getByText("Retour à la connexion"),
      ).toBeVisible()
    })

    test("'retour à la connexion' link navigates to login", async ({ page }) => {
      await page.goto("/forgot-password")

      // Click the inline "Retour à la connexion" link
      await page.locator("text=Retour à la connexion").first().click()
      await expect(page).toHaveURL("/login", { timeout: 10000 })
    })
  })

  // ──────────────────────────────────────────────
  // Reset password page
  // ──────────────────────────────────────────────
  test.describe("Reset password", () => {
    test("invalid token shows error via toast", async ({ page }) => {
      await page.goto("/reset-password/invalid-token-12345")

      // The page loads with form
      await expect(page.locator("h1")).toContainText("Nouveau mot de passe")

      // Try submitting with a valid password — tRPC will reject the token
      await page.fill("#newPassword", "NewP@ss123")
      await page.fill("#confirmPassword", "NewP@ss123")
      await page.click('button[type="submit"]')

      // Expect error toast (sonner)
      await expect(
        page.locator("[data-sonner-toast]"),
      ).toBeVisible({ timeout: 8000 })
    })

    test("password too short shows validation error", async ({ page }) => {
      await page.goto("/reset-password/some-token")

      await page.fill("#newPassword", "Ab1")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Le mot de passe doit contenir au moins 8 caractères"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("password confirmation mismatch shows validation error", async ({ page }) => {
      await page.goto("/reset-password/some-token")

      await page.fill("#newPassword", "ValidP@ss1")
      await page.fill("#confirmPassword", "DifferentP@ss1")
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Les mots de passe ne correspondent pas"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("empty confirmation field shows validation error", async ({ page }) => {
      await page.goto("/reset-password/some-token")

      await page.fill("#newPassword", "ValidP@ss1")
      // Don't fill confirmPassword
      await page.click('button[type="submit"]')

      await expect(
        page.getByText("Veuillez confirmer le mot de passe"),
      ).toBeVisible({ timeout: 5000 })
    })
  })
})
