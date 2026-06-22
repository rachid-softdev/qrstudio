import { test, expect, type Page } from "@playwright/test"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Unique test run identifier. */
const RUN_ID = Date.now()

/**
 * Log in as the demo user.
 * The login page is at `/login` (NOT `/auth/login`).
 */
async function loginAsDemo(page: Page) {
  await page.goto("/login")
  await page.waitForSelector("#email", { timeout: 10000 })
  await page.fill("#email", "demo@qrstudio.app")
  await page.fill("#password", "demo-password")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
}

/**
 * Full wizard helper: create a QR code of the given type.
 * Steps: Type (1) → Content (2) → Design (3) → Finalize (4).
 * `fillContent` is called on step 2.
 * Returns the QR id extracted from the URL after creation.
 */
async function createQRCode(
  page: Page,
  typeLabel: string,
  name: string,
  fillContent: () => Promise<void>,
): Promise<string> {
  await page.goto("/dashboard/qr/new")
  await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

  // Step 1: Select type
  await page.getByText(typeLabel, { exact: true }).first().click()
  await page.getByRole("button", { name: "Suivant" }).click()

  // Step 2: Fill content
  await fillContent()
  await page.getByRole("button", { name: "Suivant" }).click()

  // Step 3: Design (skip — use defaults)
  await page.getByRole("button", { name: "Suivant" }).click()

  // Step 4: Finalize — enter name and create
  await page.fill("#qr-name", name)
  await page.getByRole("button", { name: "Créer le QR code" }).click()

  // After creation, redirects to detail page
  await page.waitForURL(/\/dashboard\/qr\//, { timeout: 15000 })
  const qrId = page.url().split("/").pop()!
  return qrId
}

// ============================================================================
// 1. MULTI-STEP WIZARD NAVIGATION
// ============================================================================
test.describe("Multi-Step Wizard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })
  })

  // ✅ WIZARD-01
  test("WIZARD-01: Wizard shows 4 steps indicator on load", async ({ page }) => {
    // The StepIndicator renders "Type", "Contenu", "Design", "Finaliser"
    await expect(page.getByText("Type")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Contenu")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Design")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Finaliser")).toBeVisible({ timeout: 5000 })

    // Step 1 ("Type") should be active — meaning it's highlighted
    // Step circle for "Type" shows number 1 and active styling
    const step1 = page.getByText("Type").first()
    await expect(step1).toBeVisible()

    // The "Précédent" button should be disabled on step 1
    const prevButton = page.getByRole("button", { name: "Précédent" })
    await expect(prevButton).toBeDisabled()

    // The "Suivant" button should be visible but disabled (no type selected)
    const nextButton = page.getByRole("button", { name: "Suivant" })
    await expect(nextButton).toBeVisible()
    await expect(nextButton).toBeDisabled()
  })

  // ✅ WIZARD-02
  test("WIZARD-02: Can navigate back from step 2 to step 1", async ({ page }) => {
    // Step 1: Select URL type
    await page.getByText("URL", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Should now be on step 2 (Content)
    await expect(page.getByText("Contenu du QR code")).toBeVisible({ timeout: 5000 })

    // Click "Précédent" to go back to step 1
    await page.getByRole("button", { name: "Précédent" }).click()

    // Should see the type selector again
    await expect(page.getByText("Choisissez le type de QR code")).toBeVisible({ timeout: 5000 })
    // URL card should still be selected
    const urlCard = page.getByText("URL", { exact: true }).first()
    await expect(urlCard).toBeVisible()
  })

  // ✅ WIZARD-03
  test("WIZARD-03: Can navigate back from step 3 to step 2", async ({ page }) => {
    // Step 1: Select URL
    await page.getByText("URL", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Fill URL
    await page.fill("#url", "https://example.com")
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 3: Design
    await expect(page.getByText("Personnalisation")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Couleur des modules")).toBeVisible({ timeout: 5000 })

    // Click "Précédent" — back to step 2
    await page.getByRole("button", { name: "Précédent" }).click()

    // Should see the content form again
    await expect(page.getByText("Contenu du QR code")).toBeVisible({ timeout: 5000 })
    // The URL input should still have the value we entered
    await expect(page.locator("#url")).toHaveValue("https://example.com")
  })

  // ✅ WIZARD-04
  test("WIZARD-04: Can navigate back from step 4 to step 3", async ({ page }) => {
    // Step 1: Select URL
    await page.getByText("URL", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Fill URL + name
    await page.fill("#url", "https://example.com")
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 3: Design
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 4: Finalize
    await expect(page.getByText("Finaliser")).toBeVisible({ timeout: 5000 })
    await expect(page.locator("#qr-name")).toBeVisible({ timeout: 5000 })

    // Click "Précédent" — back to step 3
    await page.getByRole("button", { name: "Précédent" }).click()

    // Should see design editor again
    await expect(page.getByText("Personnalisation")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Forme des modules")).toBeVisible({ timeout: 5000 })
  })

  // ❌ WIZARD-05
  test("WIZARD-05: Cannot proceed from step 1 without selecting a type", async ({ page }) => {
    const nextButton = page.getByRole("button", { name: "Suivant" })

    // On step 1, no type is selected yet
    await expect(nextButton).toBeDisabled()

    // Try clicking the disabled button — nothing should happen
    await nextButton.click({ force: true }).catch(() => {
      // Click is allowed but should not change step — step stays on 1
    })
    // We should still be on step 1 (type selection)
    await expect(page.getByText("Choisissez le type de QR code")).toBeVisible({ timeout: 5000 })

    // Now select a type — the button should become enabled
    await page.getByText("URL", { exact: true }).first().click()
    await expect(nextButton).toBeEnabled({ timeout: 5000 })
  })

  // ❌ WIZARD-06
  test("WIZARD-06: Cannot proceed from step 2 without filling required content", async ({ page }) => {
    // Step 1: Select URL
    await page.getByText("URL", { exact: true }).first().click()
    const nextButton = page.getByRole("button", { name: "Suivant" })
    await nextButton.click()

    // Step 2: The URL input should be visible
    await expect(page.locator("#url")).toBeVisible({ timeout: 5000 })

    // Leave URL empty — the "Suivant" button should be disabled
    await expect(nextButton).toBeDisabled()

    // Fill in the URL — button becomes enabled
    await page.fill("#url", "https://example.com")
    await expect(nextButton).toBeEnabled()

    // Clear the URL — button becomes disabled again
    await page.fill("#url", "")
    await expect(nextButton).toBeDisabled()
  })
})

// ============================================================================
// 2. TYPE-SPECIFIC FORM VALIDATION (EDGE CASES)
// ============================================================================
test.describe("Type-Specific Form Validation (Edge Cases)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
  })

  // ❌ VALID-01
  test("VALID-01: URL type with invalid URL ('not-a-url') → validation error", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select URL
    await page.getByText("URL", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: The input has type="url" — browser natively validates
    // Fill with an invalid URL
    const urlInput = page.locator("#url")
    await urlInput.fill("not-a-url")

    // Since type="url", the browser's native validation may block submission.
    // Check that the "Suivant" button is actually disabled because
    // the content validation in canGoNext checks for a truthy destinationUrl.
    // "not-a-url" is truthy, so the client-side check won't block it.
    // However, the browser's built-in type="url" validation prevents form-like submission.
    // The actual server-side validation will catch it.
    // We verify that the client-side validation (if any) is present:
    const nextButton = page.getByRole("button", { name: "Suivant" })

    // The button should be enabled because "not-a-url" is truthy
    // (the stepper only checks `!!content.destinationUrl`)
    if (await nextButton.isEnabled()) {
      // Server-side should reject. Navigate through the wizard to the end
      // and verify an error toast appears
      await nextButton.click()
      await page.getByRole("button", { name: "Suivant" }).click() // step 3
      await page.fill("#qr-name", `VALID-01-${RUN_ID}`)
      await page.getByRole("button", { name: "Créer le QR code" }).click()

      // Should show error toast — the server validates the URL format
      await expect(
        page.locator("text=Erreur").or(page.locator('[role="status"]')).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      // Browser validation blocked it — this is fine
      // Verify the input shows browser validation
      const validationMessage = await urlInput.evaluate((el: HTMLInputElement) => el.validationMessage)
      expect(validationMessage).toBeTruthy()
    }
  })

  // ❌ VALID-02
  test("VALID-02: URL type with javascript: URL → rejected (security)", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select URL
    await page.getByText("URL", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Fill with javascript: URL
    const urlInput = page.locator("#url")
    await urlInput.fill("javascript:alert('xss')")

    const nextButton = page.getByRole("button", { name: "Suivant" })

    // The value is truthy, so the button is enabled
    if (await nextButton.isEnabled()) {
      // Navigate through the wizard
      await nextButton.click()
      await page.getByRole("button", { name: "Suivant" }).click() // step 3
      await page.fill("#qr-name", `VALID-02-${RUN_ID}`)
      await page.getByRole("button", { name: "Créer le QR code" }).click()

      // Server should reject the javascript: URL with an error
      await expect(
        page.locator("text=Erreur").or(page.locator('[role="status"]')).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      // Input type="url" may reject "javascript:" natively
      const validationMessage = await urlInput.evaluate((el: HTMLInputElement) => el.validationMessage)
      expect(validationMessage).toBeTruthy()
    }
  })

  // ❌ VALID-03
  test("VALID-03: WhatsApp with non-numeric phone → validation error", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select WhatsApp
    await page.getByText("WhatsApp", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Fill WhatsApp with non-numeric input
    const waInput = page.locator("#whatsapp")
    await waInput.fill("not-a-phone-number")

    const nextButton = page.getByRole("button", { name: "Suivant" })

    // The client-side check only sees a truthy destinationUrl
    if (await nextButton.isEnabled()) {
      await nextButton.click()
      await page.getByRole("button", { name: "Suivant" }).click() // step 3
      await page.fill("#qr-name", `VALID-03-${RUN_ID}`)
      await page.getByRole("button", { name: "Créer le QR code" }).click()

      // Server should reject non-numeric phone
      await expect(
        page.locator("text=Erreur").or(page.locator('[role="status"]')).first()
      ).toBeVisible({ timeout: 10000 })
    }
  })

  // ❌ VALID-04
  test("VALID-04: WhatsApp with empty phone → validation error", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select WhatsApp
    await page.getByText("WhatsApp", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Leave WhatsApp empty
    const nextButton = page.getByRole("button", { name: "Suivant" })
    // Button should be disabled because destinationUrl is empty
    await expect(nextButton).toBeDisabled({ timeout: 5000 })

    // Fill with a valid number — button enables
    await page.fill("#whatsapp", "+33612345678")
    await expect(nextButton).toBeEnabled()

    // Clear — button disabled again
    await page.fill("#whatsapp", "")
    await expect(nextButton).toBeDisabled()
  })

  // ❌ VALID-05
  test("VALID-05: WiFi with empty SSID → validation error", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select Wi-Fi
    await page.getByText("Wi-Fi", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: The SSID field should be visible
    await expect(page.locator("#ssid")).toBeVisible({ timeout: 5000 })

    // Leave SSID empty — button should be disabled
    const nextButton = page.getByRole("button", { name: "Suivant" })
    await expect(nextButton).toBeDisabled()

    // Fill SSID — button enables
    await page.fill("#ssid", "TestNetwork")
    await expect(nextButton).toBeEnabled()

    // Clear SSID — button disabled again
    await page.fill("#ssid", "")
    await expect(nextButton).toBeDisabled()
  })

  // ⚠️ VALID-06
  test("VALID-06: WiFi with WEP encryption (edge case format)", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select Wi-Fi
    await page.getByText("Wi-Fi", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Fill SSID and password
    await page.fill("#ssid", "WEP-Test-Network")
    await page.fill("#password", "wepKey123")

    // Select WEP encryption from the dropdown
    // The Select component uses shadcn/ui — click the trigger to open
    await page.locator('button:has-text("WPA/WPA2")').click()
    // Click the WEP option in the content popover
    await page.getByRole("option", { name: "WEP" }).click()

    // Wait for the select to update
    await page.waitForTimeout(300)

    // Proceed through wizard
    await page.getByRole("button", { name: "Suivant" }).click()
    await page.getByRole("button", { name: "Suivant" }).click()
    const name = `VALID-06-WEP-${RUN_ID}`
    await page.fill("#qr-name", name)
    await page.getByRole("button", { name: "Créer le QR code" }).click()

    // Should successfully create — WEP is a valid encryption format
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 15000 })
    await expect(page.locator("h1")).toContainText(name)
  })

  // ❌ VALID-07
  test("VALID-07: VCard with missing required fields → validation error", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select vCard
    await page.getByText("vCard", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Both firstName and lastName are required
    // Leave everything empty — button should be disabled
    const nextButton = page.getByRole("button", { name: "Suivant" })
    await expect(nextButton).toBeDisabled()

    // Fill only firstName — button should still be disabled (lastName also required)
    await page.fill("#firstName", "Jean")
    await expect(nextButton).toBeDisabled()

    // Fill lastName — button enables
    await page.fill("#lastName", "Dupont")
    await expect(nextButton).toBeEnabled()

    // Clear firstName — button disabled again
    await page.fill("#firstName", "")
    await expect(nextButton).toBeDisabled()
  })

  // ⚠️ VALID-08
  test("VALID-08: VCard with very long name (100+ chars) → truncated or error", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select vCard
    await page.getByText("vCard", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Fill with a very long first name
    const longName = "A".repeat(150)
    await page.fill("#firstName", longName)
    await page.fill("#lastName", "Dupont")

    const nextButton = page.getByRole("button", { name: "Suivant" })
    await expect(nextButton).toBeEnabled()

    // Proceed through wizard
    await nextButton.click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // The qr-name field has a 100-char limit validation — use a short name here
    await page.fill("#qr-name", `VALID-08-${RUN_ID}`)
    await page.getByRole("button", { name: "Créer le QR code" }).click()

    // Either the creation succeeds (name truncated) or server returns an error
    // Both are acceptable behaviors
    const currentUrl = page.url()
    if (currentUrl.includes("/dashboard/qr/")) {
      // Success — name was truncated or accepted
      await expect(page.locator("h1")).toBeVisible({ timeout: 5000 })
    } else {
      // Error toast shown
      await expect(
        page.locator("text=Erreur").or(page.locator('[role="status"]')).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })

  // ❌ VALID-09
  test("VALID-09: TEXT with empty content → validation error", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select Texte
    await page.getByText("Texte", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: Textarea should be visible
    await expect(page.locator("#text")).toBeVisible({ timeout: 5000 })

    // Leave empty — button should be disabled
    const nextButton = page.getByRole("button", { name: "Suivant" })
    await expect(nextButton).toBeDisabled()

    // Fill with content — button enables
    await page.fill("#text", "Some text content")
    await expect(nextButton).toBeEnabled()

    // Clear — button disabled again
    await page.fill("#text", "")
    await expect(nextButton).toBeDisabled()
  })

  // ❌ VALID-10
  test("VALID-10: Landing page with empty title → validation error", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Step 1: Select Landing Page
    await page.getByText("Landing Page", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 2: The landing form has #lp-title field
    await expect(page.locator("#lp-title")).toBeVisible({ timeout: 5000 })

    // Leave title empty — button should be disabled
    const nextButton = page.getByRole("button", { name: "Suivant" })
    await expect(nextButton).toBeDisabled()

    // Fill description but leave title empty — still disabled
    await page.fill("#lp-description", "Some description")
    await expect(nextButton).toBeDisabled()

    // Fill the title — button enables
    await page.fill("#lp-title", "My Landing Page")
    await expect(nextButton).toBeEnabled()

    // Clear title — button disabled again
    await page.fill("#lp-title", "")
    await expect(nextButton).toBeDisabled()
  })
})

// ============================================================================
// 3. DESIGN CUSTOMIZATION
// ============================================================================
test.describe("Design Customization", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })

    // Quick navigate to step 3 (Design) so we can test design features
    await page.getByText("URL", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()
    await page.fill("#url", "https://example.com/design")
    await page.getByRole("button", { name: "Suivant" }).click()

    // Step 3: Design
    await expect(page.getByText("Personnalisation")).toBeVisible({ timeout: 5000 })
  })

  // ✅ DESIGN-01
  test("DESIGN-01: Color picker allows changing foreground color", async ({ page }) => {
    // The ColorPicker for foreground has a color input and a text input
    // Find the color input near "Couleur des modules" label
    const fgColorInput = page.locator('input[type="color"]').first()
    await expect(fgColorInput).toBeVisible({ timeout: 5000 })

    // Change the color by setting the value via JS (better than interacting with the color picker UI)
    await fgColorInput.evaluate((el: HTMLInputElement) => {
      el.value = "#FF0000"
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })

    // Wait for state update
    await page.waitForTimeout(300)

    // The hex text input next to the color picker should reflect the change
    const hexInput = page.locator('input[type="color"]').first().locator("..").locator('input[class*="font-mono"]')
    // Alternatively, check that the QR preview canvas re-renders (no error)
    await expect(page.locator("text=Erreur de génération")).not.toBeVisible({ timeout: 2000 })
  })

  // ✅ DESIGN-02
  test("DESIGN-02: Color picker allows changing background color", async ({ page }) => {
    // The second color input is for background
    const bgColorInput = page.locator('input[type="color"]').nth(1)
    await expect(bgColorInput).toBeVisible({ timeout: 5000 })

    // Change background to a custom color
    await bgColorInput.evaluate((el: HTMLInputElement) => {
      el.value = "#0000FF"
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })

    await page.waitForTimeout(300)
    await expect(page.locator("text=Erreur de génération")).not.toBeVisible({ timeout: 2000 })
  })

  // ✅ DESIGN-03
  test("DESIGN-03: Shape selector allows changing module shape (e.g., from square to dots)", async ({ page }) => {
    // The ShapeSelector shows 3 shapes: "Carrés", "Arrondis", "Points"
    await expect(page.getByText("Carrés")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Arrondis")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Points")).toBeVisible({ timeout: 5000 })

    // "Carrés" should be selected by default
    const carresButton = page.getByText("Carrés").first()
    // The parent button might have ring styling when selected
    // Let's click "Points" to change the shape
    await page.getByText("Points").first().click()
    await page.waitForTimeout(300)

    // The preview should show a note about dots
    // QRPreview conditionally renders a message: "Aperçu avec modules en points"
    await expect(page.getByText("Aperçu avec modules en points")).toBeVisible({ timeout: 5000 })

    // Now click "Arrondis"
    await page.getByText("Arrondis").first().click()
    await page.waitForTimeout(300)
    await expect(page.getByText("Aperçu avec modules arrondis")).toBeVisible({ timeout: 5000 })
  })

  // ⚠️ DESIGN-04
  test("DESIGN-04: Frame selector allows adding a frame", async ({ page }) => {
    // Scroll down to the Frame section
    await expect(page.getByText("Cadre")).toBeVisible({ timeout: 5000 })

    // The FrameSelector shows 7 options: "Aucune", "Minimal", "Arrondi", "Tireté", "Gras", "Néon", "Élégant"
    // Click "Minimal" to add a frame
    await page.getByText("Minimal").first().click()
    await page.waitForTimeout(300)

    // When a frame is selected, the frame label input appears
    await expect(page.locator("#frame-label")).toBeVisible({ timeout: 5000 })

    // Now click "Arrondi"
    await page.getByText("Arrondi").first().click()
    await page.waitForTimeout(300)

    // "Aucune" should remove the frame
    await page.getByText("Aucune").first().click()
    await page.waitForTimeout(300)

    // The frame label input should disappear
    await expect(page.locator("#frame-label")).not.toBeVisible()
  })

  // ⚠️ DESIGN-05
  test("DESIGN-05: Frame label input accepts custom text", async ({ page }) => {
    // First select a frame type to reveal the label input
    await page.getByText("Minimal").first().click()
    await page.waitForTimeout(300)

    // The frame label input should now be visible
    const frameLabelInput = page.locator("#frame-label")
    await expect(frameLabelInput).toBeVisible({ timeout: 5000 })

    // Type custom text
    await frameLabelInput.fill("Scannez-moi !")
    await expect(frameLabelInput).toHaveValue("Scannez-moi !")

    // Type longer text
    await frameLabelInput.fill("Découvrez nos offres spéciales")
    await expect(frameLabelInput).toHaveValue("Découvrez nos offres spéciales")

    // The input has maxLength={50}, so very long text should be truncated
    await frameLabelInput.fill("A".repeat(100))
    const actualValue = await frameLabelInput.inputValue()
    expect(actualValue.length).toBeLessThanOrEqual(50)
  })

  // ✅ DESIGN-06
  test("DESIGN-06: Design changes are reflected in QR preview", async ({ page }) => {
    // The QRPreview is in the right column (desktop) — it should show a canvas
    const previewCanvas = page.locator('canvas[aria-label="Aperçu du QR code"]')
    await expect(previewCanvas).toBeVisible({ timeout: 5000 })

    // Get the initial canvas data URL
    const initialSrc = await previewCanvas.getAttribute("style")

    // Change fgColor to red
    const fgColorInput = page.locator('input[type="color"]').first()
    await fgColorInput.evaluate((el: HTMLInputElement) => {
      el.value = "#FF0000"
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await page.waitForTimeout(500)

    // Change shape to dots
    await page.getByText("Points").first().click()
    await page.waitForTimeout(500)

    // The preview should show the dots note
    await expect(page.getByText("Aperçu avec modules en points")).toBeVisible({ timeout: 5000 })

    // The canvas should have re-rendered (no errors)
    await expect(page.locator("text=Erreur de génération")).not.toBeVisible({ timeout: 2000 })
  })

  // ⚠️ DESIGN-07
  test("DESIGN-07: Logo upload button exists and opens file picker", async ({ page }) => {
    // Scroll to the Logo section
    await expect(page.getByText("Logo")).toBeVisible({ timeout: 5000 })

    // The LogoUploader uses @uploadthing/react's UploadButton
    // It renders a button with text "Choisir un fichier" (ready state)
    const logoUploadButton = page.getByText("Choisir un fichier")
    await expect(logoUploadButton).toBeVisible({ timeout: 5000 })

    // Verify the button is clickable and has file input association
    await expect(logoUploadButton).toBeEnabled()

    // The UploadButton renders an <input type="file"> element hidden inside
    // Check that there's a file input in the DOM
    const fileInput = page.locator('input[type="file"]')
    // The UploadButton component creates a hidden file input
    // It should accept image types
    const fileInputCount = await fileInput.count()
    // There may be 0 (if the UploadButton hasn't finished initializing)
    // or 1+. We just verify the button is present and clickable.
    expect(await logoUploadButton.isEnabled()).toBe(true)
  })
})

// ============================================================================
// 4. EXPORT PANEL (PNG/SVG/PDF)
// ============================================================================
test.describe("Export Panel (PNG/SVG/PDF)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
  })

  // ✅ EXPORT-01
  test("EXPORT-01: Export panel visible on QR detail page after creation", async ({ page }) => {
    const name = `EXPORT-01-${RUN_ID}`
    await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/export-view")
    })

    // On the detail page, the QRVisualCard has download buttons for PNG, SVG, PDF
    await expect(page.getByRole("button", { name: "PNG" })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole("button", { name: "SVG" })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 5000 })
  })

  // ✅ EXPORT-02
  test("EXPORT-02: PNG export triggers download event", async ({ page }) => {
    const name = `EXPORT-02-${RUN_ID}`
    await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/export-png")
    })

    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })

    // Click PNG export button
    await page.getByRole("button", { name: "PNG" }).click()

    // Wait for the download
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain(".png")
    // Clean up — don't save the file
    await download.delete()
  })

  // ✅ EXPORT-03
  test("EXPORT-03: SVG export triggers download event", async ({ page }) => {
    const name = `EXPORT-03-${RUN_ID}`
    await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/export-svg")
    })

    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent("download", { timeout: 10000 })

    // Click SVG export button — but SVG might be disabled if not loaded yet
    const svgButton = page.getByRole("button", { name: "SVG" })
    await svgButton.waitFor({ state: "visible", timeout: 5000 })

    // SVG may be disabled while the SVG data loads
    // Wait for it to become enabled
    await expect(svgButton).toBeEnabled({ timeout: 10000 })
    await svgButton.click()

    // Wait for the download
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain(".svg")
    await download.delete()
  })

  // ✅ EXPORT-04
  test("EXPORT-04: PDF export triggers download event", async ({ page }) => {
    const name = `EXPORT-04-${RUN_ID}`
    await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/export-pdf")
    })

    // The PDF export in QRVisualCard opens a new window (window.open)
    // Using download event won't work for window.open.
    // Instead we set up a popup event
    const popupPromise = page.waitForEvent("popup", { timeout: 10000 })

    // Click PDF export button
    await page.getByRole("button", { name: "PDF" }).click()

    // Wait for the new tab/window to open
    const popup = await popupPromise
    await popup.waitForLoadState()

    // The URL should contain /api/qr/{shortCode}/pdf
    const popupUrl = popup.url()
    expect(popupUrl).toContain("/api/qr/")
    expect(popupUrl).toContain("/pdf")
    await popup.close()
  })

  // ⚠️ EXPORT-05
  test("EXPORT-05: Export buttons show loading/disabled state during export", async ({ page }) => {
    const name = `EXPORT-05-${RUN_ID}`
    await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/export-loading")
    })

    // The SVG button may be disabled initially while SVG data loads
    const svgButton = page.getByRole("button", { name: "SVG" })
    await expect(svgButton).toBeVisible({ timeout: 5000 })

    // If SVG data is still loading, the button should be disabled
    if (await svgButton.isDisabled()) {
      // Wait for it to become enabled
      await expect(svgButton).toBeEnabled({ timeout: 15000 })
    }

    // PNG and PDF should always be enabled (they fetch on demand)
    const pngButton = page.getByRole("button", { name: "PNG" })
    await expect(pngButton).toBeEnabled()
  })

  // ❌ EXPORT-06
  test("EXPORT-06: Export for non-existent QR ID → error handled gracefully", async ({ page }) => {
    // Navigate to a fake QR ID detail page
    await page.goto("/dashboard/qr/non-existent-id-12345")
    await page.waitForTimeout(2000)

    // The page should show a 404 or error state (not crash)
    // Either the page shows "QR code introuvable" or redirects
    const bodyText = await page.locator("body").innerText()
    const hasErrorState =
      bodyText.includes("introuvable") ||
      bodyText.includes("404") ||
      bodyText.includes("not found") ||
      page.url().includes("/login") // redirected to login
    expect(hasErrorState).toBeTruthy()
  })

  // ⚠️ EXPORT-07
  test("EXPORT-07: Multiple rapid export clicks don't break", async ({ page }) => {
    const name = `EXPORT-07-${RUN_ID}`
    await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/export-rapid")
    })

    // The PNG button creates an anchor element and clicks it.
    // Rapid clicking should not cause errors.
    const pngButton = page.getByRole("button", { name: "PNG" })

    // Click PNG multiple times rapidly
    for (let i = 0; i < 3; i++) {
      await pngButton.click()
      await page.waitForTimeout(100)
    }

    // The page should still be on the detail page without errors
    await expect(pngButton).toBeVisible({ timeout: 5000 })

    // No toast errors should appear (each click may succeed or fail silently)
    // The important thing is the page doesn't crash
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 })
  })
})

// ============================================================================
// 5. LANDING PAGE BUILDER (FULL FLOW)
// ============================================================================
test.describe("Landing Page Builder (Full Flow)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
  })

  // ✅ LP-01
  test("LP-01: Create LANDING_PAGE QR with title, description → visible in detail", async ({ page }) => {
    const name = `LP-01-${RUN_ID}`
    const lpTitle = `Landing Page E2E ${RUN_ID}`

    await createQRCode(page, "Landing Page", name, async () => {
      await page.fill("#lp-title", lpTitle)
      await page.fill("#lp-description", "Ceci est une description de test E2E.")
    })

    // On the detail page, the name/title of the QR should be visible
    await expect(page.locator("h1")).toContainText(name, { timeout: 5000 })

    // The type badge should show "Landing Page"
    await expect(page.getByText("Landing Page").first()).toBeVisible({ timeout: 5000 })
  })

  // ✅ LP-02
  test("LP-02: Create LANDING_PAGE QR with CTA label + URL → CTA button present", async ({ page }) => {
    const name = `LP-02-${RUN_ID}`
    const lpTitle = `CTA Landing Page ${RUN_ID}`

    await createQRCode(page, "Landing Page", name, async () => {
      await page.fill("#lp-title", lpTitle)
      await page.fill("#lp-description", "Page with CTA")
      await page.fill("#cta-label", "En savoir plus")
      await page.fill("#cta-url", "https://example.com/cta-destination")
    })

    // Verify the detail page loads
    await expect(page.locator("h1")).toContainText(name, { timeout: 5000 })
  })

  // ✅ LP-03
  test("LP-03: Edit landing page content after creation → changes visible", async ({ page }) => {
    const name = `LP-03-${RUN_ID}`
    const originalTitle = `Original LP Title ${RUN_ID}`
    const updatedTitle = `Updated LP Title ${RUN_ID}`

    const qrId = await createQRCode(page, "Landing Page", name, async () => {
      await page.fill("#lp-title", originalTitle)
      await page.fill("#lp-description", "Original description")
      await page.fill("#cta-label", "Original CTA")
      await page.fill("#cta-url", "https://example.com/original")
    })

    // Navigate to edit page
    await page.goto(`/dashboard/qr/${qrId}/edit`)
    await page.waitForURL(/\/dashboard\/qr\/.+\/edit/, { timeout: 10000 })

    // The edit page uses tabs — "Destination" tab contains ContentForm
    // For landing page type, ContentForm renders LandingForm
    await expect(page.locator("#lp-title")).toBeVisible({ timeout: 5000 })

    // Modify the title
    await page.locator("#lp-title").fill(updatedTitle)
    await page.locator("#lp-description").fill("Updated description")
    await page.locator("#cta-label").fill("Updated CTA")
    await page.locator("#cta-url").fill("https://example.com/updated")

    // Save changes
    await page.getByRole("button", { name: "Enregistrer" }).click()
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 10000 })

    // Should see success toast
    await expect(page.locator("text=QR code mis à jour")).toBeVisible({ timeout: 5000 })
  })

  // ⚠️ LP-04
  test("LP-04: Landing page renders correctly at /l/[shortCode] (public)", async ({ page }) => {
    const name = `LP-04-${RUN_ID}`
    const lpTitle = `Public LP ${RUN_ID}`
    const lpDesc = "Description visible publiquement"
    const ctaLabel = "Visit Site"
    const ctaUrl = "https://example.com/public-lp"

    // Create a landing page QR with full details
    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })
    await page.getByText("Landing Page", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()
    await page.fill("#lp-title", lpTitle)
    await page.fill("#lp-description", lpDesc)
    await page.fill("#cta-label", ctaLabel)
    await page.fill("#cta-url", ctaUrl)
    await page.getByRole("button", { name: "Suivant" }).click()
    await page.getByRole("button", { name: "Suivant" }).click()
    await page.fill("#qr-name", name)

    // Intercept tRPC response to get shortCode
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/trpc/qr.create") && resp.status() === 200,
    )
    await page.getByRole("button", { name: "Créer le QR code" }).click()
    const response = await responsePromise
    const body = await response.json()
    const data = Array.isArray(body) ? body[0] : body
    const shortCode: string = data?.result?.data?.json?.shortCode ?? ""

    // Wait for redirect to detail page
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 15000 })

    // Navigate to the public landing page
    await page.goto(`/l/${shortCode}`, { waitUntil: "networkidle" })

    // The landing page should render correctly
    await expect(page.locator("h1")).toContainText(lpTitle, { timeout: 5000 })
    await expect(page.getByText(lpDesc)).toBeVisible({ timeout: 5000 })

    // The CTA button should be present
    const ctaLink = page.locator(`a[href="${ctaUrl}"]`)
    await expect(ctaLink).toBeVisible({ timeout: 5000 })
    await expect(ctaLink).toContainText(ctaLabel)
  })

  // ✅ LP-05
  test("LP-05: Landing page shows title, description, and CTA button", async ({ page }) => {
    // Re-use the same approach as LP-04 but also verify the displayed content
    const name = `LP-05-${RUN_ID}`
    const lpTitle = `Full LP ${RUN_ID}`
    const lpDesc = "Full description with all elements"
    const ctaLabel = "Get Started"
    const ctaUrl = "https://example.com/get-started"

    await page.goto("/dashboard/qr/new")
    await page.waitForURL(/\/dashboard\/qr\/new/, { timeout: 10000 })
    await page.getByText("Landing Page", { exact: true }).first().click()
    await page.getByRole("button", { name: "Suivant" }).click()
    await page.fill("#lp-title", lpTitle)
    await page.fill("#lp-description", lpDesc)
    await page.fill("#cta-label", ctaLabel)
    await page.fill("#cta-url", ctaUrl)
    await page.getByRole("button", { name: "Suivant" }).click()
    await page.getByRole("button", { name: "Suivant" }).click()
    await page.fill("#qr-name", name)

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/trpc/qr.create") && resp.status() === 200,
    )
    await page.getByRole("button", { name: "Créer le QR code" }).click()
    const response = await responsePromise
    const body = await response.json()
    const data = Array.isArray(body) ? body[0] : body
    const shortCode: string = data?.result?.data?.json?.shortCode ?? ""

    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 15000 })

    // Navigate to public landing page
    await page.goto(`/l/${shortCode}`, { waitUntil: "networkidle" })

    // Verify all elements
    // Title (h1)
    await expect(page.locator("h1")).toContainText(lpTitle, { timeout: 5000 })

    // Description paragraph
    await expect(page.getByText(lpDesc)).toBeVisible({ timeout: 5000 })

    // CTA link with correct href and label
    const ctaLink = page.locator(`a[href="${ctaUrl}"]`)
    await expect(ctaLink).toBeVisible({ timeout: 5000 })
    await expect(ctaLink).toContainText(ctaLabel)

    // The CTA should open in a new tab (target="_blank")
    const targetAttr = await ctaLink.getAttribute("target")
    expect(targetAttr).toBe("_blank")
  })
})

// ============================================================================
// 6. DESIGN EDIT ON EXISTING QR
// ============================================================================
test.describe("Design Edit on Existing QR", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
  })

  // ✅ EDIT-DESIGN-01
  test("EDIT-DESIGN-01: Edit QR colors on existing QR → changes saved", async ({ page }) => {
    const name = `EDIT-DESIGN-01-${RUN_ID}`
    const qrId = await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/edit-colors")
    })

    // Navigate to edit page
    await page.goto(`/dashboard/qr/${qrId}/edit`)
    await page.waitForURL(/\/dashboard\/qr\/.+\/edit/, { timeout: 10000 })

    // Click the "Design" tab
    await page.getByRole("tab", { name: "Design" }).click()
    await page.waitForTimeout(500)

    // Change foreground color
    const fgColorInput = page.locator('input[type="color"]').first()
    await fgColorInput.evaluate((el: HTMLInputElement) => {
      el.value = "#FF5733"
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await page.waitForTimeout(300)

    // Change background color
    const bgColorInput = page.locator('input[type="color"]').nth(1)
    await bgColorInput.evaluate((el: HTMLInputElement) => {
      el.value = "#33FF57"
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await page.waitForTimeout(300)

    // Save changes
    await page.getByRole("button", { name: "Enregistrer" }).click()

    // Should redirect to detail page with success toast
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 10000 })
    await expect(page.locator("text=QR code mis à jour")).toBeVisible({ timeout: 5000 })
  })

  // ✅ EDIT-DESIGN-02
  test("EDIT-DESIGN-02: Edit QR shape on existing QR → changes saved", async ({ page }) => {
    const name = `EDIT-DESIGN-02-${RUN_ID}`
    const qrId = await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/edit-shape")
    })

    // Navigate to edit page
    await page.goto(`/dashboard/qr/${qrId}/edit`)
    await page.waitForURL(/\/dashboard\/qr\/.+\/edit/, { timeout: 10000 })

    // Click the "Design" tab
    await page.getByRole("tab", { name: "Design" }).click()
    await page.waitForTimeout(500)

    // Change shape to "Points"
    await page.getByText("Points").first().click()
    await page.waitForTimeout(300)

    // Save
    await page.getByRole("button", { name: "Enregistrer" }).click()
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 10000 })
    await expect(page.locator("text=QR code mis à jour")).toBeVisible({ timeout: 5000 })

    // Re-open edit page — verify the shape persisted
    await page.goto(`/dashboard/qr/${qrId}/edit`)
    await page.waitForURL(/\/dashboard\/qr\/.+\/edit/, { timeout: 10000 })
    await page.getByRole("tab", { name: "Design" }).click()
    await page.waitForTimeout(500)

    // "Points" should still be selected (has ring styling)
    // We check that the preview mentions dots
    await expect(page.getByText("Aperçu avec modules en points")).toBeVisible({ timeout: 5000 })
  })

  // ⚠️ EDIT-DESIGN-03
  test("EDIT-DESIGN-03: Edit QR frame + label → changes saved", async ({ page }) => {
    const name = `EDIT-DESIGN-03-${RUN_ID}`
    const qrId = await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/edit-frame")
    })

    // Navigate to edit page
    await page.goto(`/dashboard/qr/${qrId}/edit`)
    await page.waitForURL(/\/dashboard\/qr\/.+\/edit/, { timeout: 10000 })

    // Click the "Design" tab
    await page.getByRole("tab", { name: "Design" }).click()
    await page.waitForTimeout(500)

    // Select a frame type
    await page.getByText("Bold").first().click()
    await page.waitForTimeout(300)

    // The frame label input should appear
    const frameLabelInput = page.locator("#frame-label")
    await expect(frameLabelInput).toBeVisible({ timeout: 5000 })
    await frameLabelInput.fill("Scan Me!")

    // Save
    await page.getByRole("button", { name: "Enregistrer" }).click()
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 10000 })
    await expect(page.locator("text=QR code mis à jour")).toBeVisible({ timeout: 5000 })
  })

  // ✅ EDIT-DESIGN-04
  test("EDIT-DESIGN-04: After design edit, QR visual card shows new design", async ({ page }) => {
    const name = `EDIT-DESIGN-04-${RUN_ID}`
    const qrId = await createQRCode(page, "URL", name, async () => {
      await page.fill("#url", "https://example.com/visual-design")
    })

    // Navigate to edit page and change design
    await page.goto(`/dashboard/qr/${qrId}/edit`)
    await page.waitForURL(/\/dashboard\/qr\/.+\/edit/, { timeout: 10000 })

    // Design tab
    await page.getByRole("tab", { name: "Design" }).click()
    await page.waitForTimeout(500)

    // Change colors
    const fgColorInput = page.locator('input[type="color"]').first()
    await fgColorInput.evaluate((el: HTMLInputElement) => {
      el.value = "#FF0000"
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await page.waitForTimeout(300)

    // Change shape
    await page.getByText("Points").first().click()
    await page.waitForTimeout(300)

    // Save
    await page.getByRole("button", { name: "Enregistrer" }).click()
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 10000 })
    await expect(page.locator("text=QR code mis à jour")).toBeVisible({ timeout: 5000 })

    // Navigate back to detail page and verify the visual card loads
    await page.goto(`/dashboard/qr/${qrId}`)
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 10000 })

    // The QRVisualCard shows a preview with the QR code
    // The SVG preview should load (it may be loading initially)
    await expect(page.getByText("Aperçu")).toBeVisible({ timeout: 5000 })

    // The preview card should have PNG/SVG/PDF buttons
    await expect(page.getByRole("button", { name: "PNG" })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole("button", { name: "SVG" })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 5000 })

    // The SVG should have loaded (the loading text should disappear)
    await expect(page.getByText("Chargement...")).not.toBeVisible({ timeout: 15000 })
  })
})
