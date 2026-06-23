import { test, expect } from "@playwright/test"
import { authenticator } from "otplib"

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Login as the demo user. `password` can be overridden after a password change.
 */
async function loginAs(
  page: import("@playwright/test").Page,
  password = "demo-password",
) {
  await page.goto("/login")
  await page.fill('input[name="email"]', "demo@qrstudio.app")
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
}

// ── Suite ────────────────────────────────────────────────────────────────────

let currentPassword = "demo-password"

test.describe.serial("Billing & settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, currentPassword)
  })

  // ── Profile settings ────────────────────────────────────────────────────

  test.describe("Profile settings", () => {
    test("1 — Profile page loads with pre-filled user data", async ({ page }) => {
      await page.goto("/dashboard/settings")

      // Header is visible
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5000 })

      // Name input is pre-filled
      const nameInput = page.locator("#name")
      await expect(nameInput).toBeVisible()
      const currentValue = await nameInput.inputValue()
      expect(currentValue.trim().length).toBeGreaterThan(0)

      // Email information is rendered somewhere (may be in sidebar or header)
      await expect(page.locator("text=Paramètres").first()).toBeVisible()
    })

    test("2 — Update display name → saved successfully", async ({ page }) => {
      await page.goto("/dashboard/settings")

      const nameInput = page.locator("#name")
      const originalName = await nameInput.inputValue()

      const newName = `Demo ${Date.now()}`
      await nameInput.fill(newName)
      await page.click('button:has-text("Enregistrer")')

      // Toast confirms update
      await expect(page.locator("text=Profil mis à jour")).toBeVisible({ timeout: 5000 })

      // Reload and verify persistence
      await page.reload()
      await expect(page.locator("#name")).toHaveValue(newName)

      // Restore original name
      await page.locator("#name").fill(originalName)
      await page.click('button:has-text("Enregistrer")')
      await expect(page.locator("text=Profil mis à jour")).toBeVisible({ timeout: 5000 })
    })

    test("3 — Cancel edit → original values restored", async ({ page }) => {
      await page.goto("/dashboard/settings")

      const nameInput = page.locator("#name")
      const originalName = await nameInput.inputValue()

      // Modify the input without saving
      await nameInput.fill(`Temporary ${Date.now()}`)

      // Navigate away (to dashboard)
      await page.goto("/dashboard")
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5000 })

      // Navigate back to settings
      await page.goto("/dashboard/settings")

      // Original value is preserved (server-rendered, not client-side dirty state)
      await expect(nameInput).toHaveValue(originalName)
    })

    test("4 — Empty name (< 2 chars) → validation error", async ({ page }) => {
      await page.goto("/dashboard/settings")

      const nameInput = page.locator("#name")
      await nameInput.fill("A")
      await page.click('button:has-text("Enregistrer")')

      await expect(
        page.locator("text=Le nom doit contenir au moins 2 caractères"),
      ).toBeVisible({ timeout: 5000 })
    })
  })

  // ── Security - Password ─────────────────────────────────────────────────

  test.describe("Security - Password", () => {
    test("5 — Change password → success toast", async ({ page }) => {
      await page.goto("/dashboard/settings")

      const newPw = "DemoP@ss1"

      await page.fill("#currentPassword", currentPassword)
      await page.fill("#newPassword", newPw)
      await page.fill("#confirmPassword", newPw)
      await page.click('button:has-text("Changer le mot de passe")')

      await expect(
        page.locator("text=Mot de passe modifié avec succès"),
      ).toBeVisible({ timeout: 8000 })

      // Update global password so subsequent tests (TOTP disable, etc.) still work
      currentPassword = newPw
    })

    test("6 — Wrong old password → error toast", async ({ page }) => {
      await page.goto("/dashboard/settings")

      await page.fill("#currentPassword", "wrong-old-password")
      await page.fill("#newPassword", "DemoP@ss2")
      await page.fill("#confirmPassword", "DemoP@ss2")
      await page.click('button:has-text("Changer le mot de passe")')

      await expect(
        page.locator("text=Mot de passe actuel incorrect"),
      ).toBeVisible({ timeout: 8000 })
    })

    test("7 — New password too short (< 8) → validation error", async ({ page }) => {
      await page.goto("/dashboard/settings")

      await page.fill("#currentPassword", currentPassword)
      await page.fill("#newPassword", "Ab1")
      await page.fill("#confirmPassword", "Ab1")
      await page.click('button:has-text("Changer le mot de passe")')

      await expect(
        page.locator("text=Le mot de passe doit contenir au moins 8 caractères"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("8 — Password confirmation mismatch → error", async ({ page }) => {
      await page.goto("/dashboard/settings")

      await page.fill("#currentPassword", currentPassword)
      await page.fill("#newPassword", "ValidP@ss1")
      await page.fill("#confirmPassword", "DifferentP@ss1")
      await page.click('button:has-text("Changer le mot de passe")')

      await expect(
        page.locator("text=Les mots de passe ne correspondent pas"),
      ).toBeVisible({ timeout: 5000 })
    })
  })

  // ── Security - TOTP/2FA ─────────────────────────────────────────────────

  test.describe("Security - TOTP/2FA", () => {
    test("9 — Enable TOTP → QR code displayed", async ({ page }) => {
      await page.goto("/dashboard/settings/security")

      // Click "Activer" button
      await page.click('button:has-text("Activer")')

      // Dialog opens; wait for QR image to appear
      await expect(
        page.locator('img[alt*="QR code"]'),
      ).toBeVisible({ timeout: 10000 })

      // Secret key is also displayed
      const secretElement = page.locator("code").first()
      await expect(secretElement).toBeVisible()
      const secret = await secretElement.textContent()
      expect(secret?.trim().length).toBeGreaterThan(0)
    })

    test("10 — Invalid TOTP code → error message", async ({ page }) => {
      await page.goto("/dashboard/settings/security")

      // Enable flow
      await page.click('button:has-text("Activer")')
      await expect(
        page.locator('img[alt*="QR code"]'),
      ).toBeVisible({ timeout: 10000 })

      // Proceed to verify step
      await page.click('button:has-text("Code scanné")')

      // Enter an invalid 6-digit code
      await page.fill("#verify-totp-code", "000000")
      await page.click('button:has-text("Vérifier et activer")')

      // Expect server-side error
      await expect(
        page.locator("text=Code invalide"),
      ).toBeVisible({ timeout: 8000 })
    })

    test("11 — Valid TOTP code → 2FA enabled", async ({ page }) => {
      await page.goto("/dashboard/settings/security")

      // Open the enable dialog
      await page.click('button:has-text("Activer")')
      await expect(
        page.locator('img[alt*="QR code"]'),
      ).toBeVisible({ timeout: 10000 })

      // Read secret from the <code> element
      const secretEl = page.locator("code").first()
      const secret = (await secretEl.textContent())?.trim() ?? ""

      // Proceed to verify
      await page.click('button:has-text("Code scanné")')

      // Generate a valid TOTP code from the secret
      const validCode = authenticator.generate(secret)
      await page.fill("#verify-totp-code", validCode)
      await page.click('button:has-text("Vérifier et activer")')

      // Wait for backup-codes step (step 3)
      await expect(
        page.locator("text=J'ai sauvegardé mes codes de secours"),
      ).toBeVisible({ timeout: 10000 })

      // Check confirmation checkbox and confirm
      await page.check("#confirm-backup-codes")
      await page.click('button:has-text("Confirmer")')

      // Dialog closes and 2FA becomes active
      await expect(
        page.locator("text=2FA activée"),
      ).toBeVisible({ timeout: 5000 })
    })

    test("12 — Disable TOTP → confirmation → disabled", async ({ page }) => {
      await page.goto("/dashboard/settings/security")

      // Click "Désactiver" (TOTP is already enabled from previous test)
      await page.click('button:has-text("Désactiver")')

      // Alert dialog asks for password
      await page.fill("#disable-password", currentPassword)
      await page.click('button:has-text("Désactiver")')

      // Toast confirms
      await expect(
        page.locator("text=Authentification à deux facteurs désactivée"),
      ).toBeVisible({ timeout: 8000 })

      // Status should reflect disabled
      await expect(
        page.locator("text=2FA désactivée"),
      ).toBeVisible({ timeout: 5000 })
    })
  })

  // ── Billing ─────────────────────────────────────────────────────────────

  test.describe("Billing", () => {
    test("13 — Billing page shows current plan info (Free)", async ({ page }) => {
      await page.goto("/dashboard/billing")

      // Plan banner shows "Gratuit"
      await expect(
        page.locator("text=Gratuit").first(),
      ).toBeVisible({ timeout: 5000 })

      // Usage meter is present
      await expect(page.locator("text=Utilisation")).toBeVisible()
      await expect(page.locator("text=QR codes")).toBeVisible()
      await expect(page.locator("text=Membres de l'équipe")).toBeVisible()
    })

    test("14 — Plan features / limits displayed", async ({ page }) => {
      await page.goto("/dashboard/billing")

      // Plan-card grid is visible (FREE plan shows upgrade options)
      await expect(page.locator("text=Gratuit")).toBeVisible()
      await expect(page.locator("text=Pro")).toBeVisible()
      await expect(page.locator("text=Agency")).toBeVisible()

      // Feature text in plan cards
      await expect(page.locator("text=Jusqu'à 5 QR codes")).toBeVisible()
      await expect(page.locator("text=Jusqu'à 100 QR codes")).toBeVisible()
      await expect(page.locator("text=QR codes illimités")).toBeVisible()
    })

    test("15 — Upgrade button → confirmation dialog with Stripe info", async ({ page }) => {
      await page.goto("/dashboard/billing")

      // Click "Passer à Pro" on the Pro card
      await page.click('button:has-text("Passer à Pro")')

      // Confirmation dialog appears
      await expect(
        page.locator("text=Passer au plan Pro"),
      ).toBeVisible({ timeout: 5000 })

      // Dialog shows pricing and Stripe redirection info
      await expect(
        page.locator("text=Continuer vers Stripe"),
      ).toBeVisible()

      // Click "Annuler" to close (don't actually redirect)
      await page.click('button:has-text("Annuler")')
      await expect(page.locator("text=Passer au plan Pro")).not.toBeVisible({ timeout: 5000 })
    })
  })

  // ── API Keys ────────────────────────────────────────────────────────────

  test.describe("API Keys", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/settings")
    })

    test("16 — Empty state: no API keys → 'Aucune clé API' message", async ({ page }) => {
      // The API section is only visible for Pro / Agency plans
      const apiSection = page.locator("text=Clés API")
      const sectionVisible = await apiSection.isVisible()

      test.skip(!sectionVisible, "API keys section is hidden for FREE plan users")

      await expect(page.locator("text=Aucune clé API")).toBeVisible()
    })

    test("17 — Create API key → key value displayed once", async ({ page }) => {
      const apiSection = page.locator("text=Clés API")
      const sectionVisible = await apiSection.isVisible()

      test.skip(!sectionVisible, "API keys section is hidden for FREE plan users")

      // Click "Nouvelle clé"
      await page.click('button:has-text("Nouvelle clé")')

      // Modal opens; enter a key name
      await page.fill("#keyName", "E2E test key")
      await page.click('button:has-text("Générer")')

      // Key value is displayed in the modal
      await expect(
        page.locator("text=Clé générée"),
      ).toBeVisible({ timeout: 8000 })
      await expect(page.locator("code").first()).toBeVisible()
    })

    test("18 — Delete API key → removed from list", async ({ page }) => {
      const apiSection = page.locator("text=Clés API")
      const sectionVisible = await apiSection.isVisible()

      test.skip(!sectionVisible, "API keys section is hidden for FREE plan users")

      // A key must exist; we created one in the previous test (serial suite)
      const deleteButtons = page.locator('button[aria-label="Révoquer cette clé API"]')
      const count = await deleteButtons.count()

      test.skip(count === 0, "No API key to revoke")

      await deleteButtons.first().click()
      await expect(
        page.locator("text=Clé API révoquée"),
      ).toBeVisible({ timeout: 8000 })
    })

    test("19 — Empty key name → validation error", async ({ page }) => {
      const apiSection = page.locator("text=Clés API")
      const sectionVisible = await apiSection.isVisible()

      test.skip(!sectionVisible, "API keys section is hidden for FREE plan users")

      await page.click('button:has-text("Nouvelle clé")')
      await page.click('button:has-text("Générer")')

      await expect(
        page.locator("text=Veuillez donner un nom à la clé"),
      ).toBeVisible({ timeout: 5000 })
    })
  })

  // ── Help page ───────────────────────────────────────────────────────────

  test.describe("Help page", () => {
    test("20 — /dashboard/aide page loads correctly", async ({ page }) => {
      await page.goto("/dashboard/aide")

      // Title / header
      await expect(page.locator("h1, h2").first()).toBeVisible()
      await expect(page.locator("text=Aide").first()).toBeVisible()

      // FAQ sections are present
      await expect(page.locator("text=Généralités")).toBeVisible()
      await expect(page.locator("text=Plans et facturation")).toBeVisible()
      await expect(page.locator("text=Compte et équipe")).toBeVisible()

      // At least one FAQ answer is visible (expanded by default or clickable)
      await expect(
        page.locator("text=Qu'est-ce qu'un QR code dynamique ?"),
      ).toBeVisible()

      // Contact information present
      await expect(
        page.locator("text=support@qrstudio.app"),
      ).toBeVisible()
    })
  })
})
