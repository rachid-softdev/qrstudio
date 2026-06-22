import { test, expect } from "@playwright/test"

/* ──────────────────────────────────────────────────────────────
 * Smoke Test Suite — Critical User Journeys
 *
 * Runs in serial mode: each test builds on the previous one.
 * Shared state is kept in module-level variables so we avoid
 * re-logging in and re-creating data between tests.
 *
 * Timeouts: 10 s for navigations, 5 s for assertions.
 * ────────────────────────────────────────────────────────────── */
test.describe.configure({ mode: "serial" })

const DEMO_EMAIL = "demo@qrstudio.app"
const DEMO_PASSWORD = "demo-password"

// ── Shared state (filled incrementally) ──────────────────────
let testQRName: string
let testQRId: string

/* ──────────────────────────────────────────────────────────────
 *  PHASE 1 — Public Pages
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 1 — Public Pages", () => {
  test("SMK-01: Login page loads with email + password fields and submit button", async ({ page }) => {
    await page.goto("/login")
    const heading = page.getByRole("heading", { name: /connexion/i })
    await expect(heading).toBeVisible({ timeout: 5000 })

    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.locator('button[type="submit"]')

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toContainText("Se connecter")
  })

  test("SMK-02: Register page loads with name + email + password + confirm fields", async ({ page }) => {
    await page.goto("/register")
    const heading = page.getByRole("heading", { name: /créer un compte/i })
    await expect(heading).toBeVisible({ timeout: 5000 })

    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible()
  })

  test("SMK-03: Error page /qr-not-found renders with French error message", async ({ page }) => {
    await page.goto("/qr-not-found")
    const heading = page.getByRole("heading", { name: /qr code introuvable/i })
    await expect(heading).toBeVisible({ timeout: 5000 })

    const body = page.locator("body")
    await expect(body).toContainText(/n'existe pas|a été supprimé/i)
  })

  test("SMK-04: Error page /qr-paused renders properly", async ({ page }) => {
    await page.goto("/qr-paused")
    const heading = page.getByRole("heading", { name: /qr code en pause/i })
    await expect(heading).toBeVisible({ timeout: 5000 })

    const body = page.locator("body")
    await expect(body).toContainText(/mis en pause/i)
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 2 — Auth Flow
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 2 — Auth Flow", () => {
  test("SMK-05: Login with valid demo credentials → redirect to /dashboard", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', DEMO_EMAIL)
    await page.fill('input[name="password"]', DEMO_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for the dashboard to load
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    expect(page.url()).toContain("/dashboard")
  })

  test("SMK-06: Dashboard shows welcome header with user name", async ({ page }) => {
    const heading = page.getByRole("heading", { name: /bienvenue/i })
    await expect(heading).toBeVisible({ timeout: 5000 })
    // The heading contains "Bienvenue sur QR Studio, <Name>"
    await expect(heading).toContainText("Bienvenue")
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 3 — QR Creation
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 3 — QR Creation", () => {
  test("SMK-07: Navigate to QR creator → page loads without errors", async ({ page }) => {
    await page.goto("/dashboard/qr/new")
    const heading = page.getByRole("heading", { name: /nouveau qr code/i })
    await expect(heading).toBeVisible({ timeout: 5000 })
    // The step indicator should show "Type" as the first step
    await expect(page.getByText("Type")).toBeVisible()
    // The type selector should list QR type options
    await expect(page.getByText("Redirige vers une page web")).toBeVisible()
  })

  test("SMK-08: Create URL QR code → redirect to detail page", async ({ page }) => {
    // Ensure we are on the QR creator
    if (!page.url().includes("/dashboard/qr/new")) {
      await page.goto("/dashboard/qr/new")
      await expect(page.getByText("Redirige vers une page web")).toBeVisible({ timeout: 5000 })
    }

    // ── Step 1: Select type ──────────────────────────────────
    // Click the "URL" type card — its description is unique
    await page.getByText("Redirige vers une page web").click()
    await page.getByRole("button", { name: /suivant/i }).click()

    // ── Step 2: Fill content ─────────────────────────────────
    await expect(page.getByText("Contenu du QR code")).toBeVisible({ timeout: 5000 })
    await page.fill("#url", "https://example.com")
    await page.getByRole("button", { name: /suivant/i }).click()

    // ── Step 3: Skip design ──────────────────────────────────
    await expect(page.getByText("Personnalisation")).toBeVisible({ timeout: 5000 })
    await page.getByRole("button", { name: /suivant/i }).click()

    // ── Step 4: Finalize ─────────────────────────────────────
    await expect(page.getByText("Finaliser")).toBeVisible({ timeout: 5000 })
    testQRName = `E2E-SMK-${Date.now()}`
    await page.fill("#qr-name", testQRName)

    // Click create
    await page.getByRole("button", { name: /créer le qr code/i }).click()

    // Wait for redirect to the QR detail page
    await page.waitForURL(/\/dashboard\/qr\//, { timeout: 15000 })
    expect(page.url()).toMatch(/\/dashboard\/qr\//)

    // Extract the QR ID from the URL for later use
    const match = page.url().match(/\/dashboard\/qr\/([^/]+)/)
    testQRId = match ? match[1] : ""
    expect(testQRId).toBeTruthy()
  })

  test("SMK-09: QR detail page shows type badge, status, and name", async ({ page }) => {
    // We should already be on the detail page; navigate there if not
    if (!page.url().includes(`/dashboard/qr/${testQRId}`)) {
      await page.goto(`/dashboard/qr/${testQRId}`)
    }

    // Heading should show the created name
    const nameHeading = page.getByRole("heading", { name: testQRName })
    await expect(nameHeading).toBeVisible({ timeout: 5000 })

    // Type badge shows "URL"
    await expect(page.getByText("URL").first()).toBeVisible()

    // Status badge shows "Actif" (active after creation)
    await expect(page.getByText("Actif")).toBeVisible()
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 4 — QR List & Filters
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 4 — QR List & Filters", () => {
  test("SMK-10: QR list page shows created QR code", async ({ page }) => {
    await page.goto("/dashboard/qr-codes")
    // The page heading
    const heading = page.getByRole("heading", { name: /qr codes/i })
    await expect(heading).toBeVisible({ timeout: 5000 })

    // The QR card should be visible (name or short code)
    await expect(page.getByText(testQRName)).toBeVisible({ timeout: 10000 })
  })

  test("SMK-11: Search filter by name finds the QR code", async ({ page }) => {
    await page.goto("/dashboard/qr-codes")
    // Type part of the name into the search input
    const searchInput = page.getByPlaceholder("Rechercher...")
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    await searchInput.fill(testQRName)

    // Wait for debounced search (400 ms) + render
    await page.waitForTimeout(800)

    // The QR card should still appear
    const card = page.getByText(testQRName)
    await expect(card).toBeVisible({ timeout: 5000 })
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 5 — QR Edit
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 5 — QR Edit", () => {
  test("SMK-12: Edit QR destination → success toast appears", async ({ page }) => {
    // Navigate to edit page
    await page.goto(`/dashboard/qr/${testQRId}/edit`)

    // Verify edit page loaded
    await expect(page.getByText("Modifier le QR code")).toBeVisible({ timeout: 5000 })

    // The URL input should be visible for URL-type QR codes
    const urlInput = page.locator("#url")
    await expect(urlInput).toBeVisible()
    const currentValue = await urlInput.inputValue()
    expect(currentValue).toContain("example.com")

    // Change the destination URL
    await urlInput.fill("https://changed-example.com")

    // Click "Enregistrer"
    await page.getByRole("button", { name: /enregistrer/i }).click()

    // Wait for redirect back to detail page
    await page.waitForURL(`/dashboard/qr/${testQRId}`, { timeout: 10000 })

    // The success toast should appear (sonner toast)
    const toast = page.getByText("QR code mis à jour")
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test("SMK-13: Edit page shows correct QR type", async ({ page }) => {
    await page.goto(`/dashboard/qr/${testQRId}/edit`)
    // The page title should contain "Modifier"
    await expect(page.getByText("Modifier le QR code")).toBeVisible({ timeout: 5000 })

    // The content form should match URL type — check for the URL input
    await expect(page.locator("#url")).toBeVisible()

    // The destination tab should be active by default
    const destinationTab = page.getByRole("tab", { name: /destination/i })
    await expect(destinationTab).toHaveAttribute("data-state", "active")
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 6 — QR Status & Delete
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 6 — QR Status & Delete", () => {
  test("SMK-14: Pause QR code → status badge changes", async ({ page }) => {
    await page.goto(`/dashboard/qr/${testQRId}`)

    // Click the "Mettre en pause" button
    const pauseButton = page.getByRole("button", { name: /mettre en pause/i })
    await expect(pauseButton).toBeVisible({ timeout: 5000 })
    await pauseButton.click()

    // Wait for the status badge to change to "En pause"
    await expect(page.getByText("En pause")).toBeVisible({ timeout: 5000 })
  })

  test("SMK-15: Activate QR code → status badge changes back", async ({ page }) => {
    await page.goto(`/dashboard/qr/${testQRId}`)

    // Click the "Activer" button
    const activateButton = page.getByRole("button", { name: /activer/i })
    await expect(activateButton).toBeVisible({ timeout: 5000 })
    await activateButton.click()

    // Wait for the status badge to change back to "Actif"
    await expect(page.getByText("Actif")).toBeVisible({ timeout: 5000 })
  })

  test("SMK-16: Delete QR code → removed from list", async ({ page }) => {
    await page.goto(`/dashboard/qr/${testQRId}`)

    // Click the "Supprimer" button (triggers alert dialog)
    const deleteButton = page.getByRole("button", { name: /supprimer/i })
    await expect(deleteButton).toBeVisible({ timeout: 5000 })
    await deleteButton.click()

    // Wait for the alert dialog to appear, then confirm
    const confirmButton = page.getByRole("button", { name: /supprimer/i }).last()
    await expect(confirmButton).toBeVisible({ timeout: 3000 })
    await confirmButton.click()

    // After deletion the app navigates to "/" which calls redirect("/login").
    // Since we're still authenticated, middleware catches /login and
    // redirects to /dashboard.
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    // Navigate to QR list and verify the code is gone
    await page.goto("/dashboard/qr-codes")
    // Wait for list to load (tRPC query)
    await page.waitForTimeout(1500)
    // The deleted QR should not appear anywhere on the page
    await expect(page.getByText(testQRName)).not.toBeVisible({ timeout: 5000 })
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 7 — Team Page
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 7 — Team Page", () => {
  test("SMK-17: Team page loads with member list", async ({ page }) => {
    await page.goto("/dashboard/team")
    const heading = page.getByRole("heading", { name: /équipe/i })
    await expect(heading).toBeVisible({ timeout: 5000 })

    // There should be at least one member (the demo user)
    const body = page.locator("body")
    await expect(body).toContainText(/membre/i)
  })

  test("SMK-18: Team invitation form is visible for OWNER", async ({ page }) => {
    await page.goto("/dashboard/team")
    // The demo user is likely an OWNER, so the invite form should be visible
    const inviteSection = page.getByText(/inviter/i)
    await expect(inviteSection).toBeVisible({ timeout: 5000 })

    // Check for the email input used for invitations
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible()
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 8 — Settings & Billing
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 8 — Settings & Billing", () => {
  test("SMK-19: Settings page loads with profile form", async ({ page }) => {
    await page.goto("/dashboard/settings")
    const heading = page.getByRole("heading", { name: /paramètres/i })
    await expect(heading).toBeVisible({ timeout: 5000 })

    // Profile form should be visible
    await expect(page.getByText("Profil")).toBeVisible()
    await expect(page.getByText("Modifiez votre nom")).toBeVisible()
  })

  test("SMK-20: Billing page loads with plan info and usage meter", async ({ page }) => {
    await page.goto("/dashboard/billing")
    const heading = page.getByRole("heading", { name: /facturation/i })
    await expect(heading).toBeVisible({ timeout: 5000 })

    // Current plan banner should be visible
    await expect(page.getByText(/plan|gratuit|pro|agency/i)).toBeVisible()
  })

  test("SMK-21: Usage meter shows QR code count", async ({ page }) => {
    await page.goto("/dashboard/billing")
    // The UsageMeter component has a "QR codes" label
    await expect(page.getByText("QR codes")).toBeVisible({ timeout: 5000 })

    // The count display should show a number (even 0)
    const body = page.locator("body")
    await expect(body).toContainText(/\d+\s*\/\s*/)
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 9 — Logout & Security
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 9 — Logout & Security", () => {
  test("SMK-22: Logout → redirect to login page", async ({ page }) => {
    // The sidebar user dropdown trigger contains the user's email
    // Click on the email text to open the dropdown menu
    const userMenuTrigger = page.getByText(DEMO_EMAIL).first()
    await expect(userMenuTrigger).toBeVisible({ timeout: 5000 })
    await userMenuTrigger.click()

    // Wait for the dropdown to appear and click "Déconnexion"
    const logoutButton = page.getByRole("menuitem", { name: /déconnexion/i })
    await expect(logoutButton).toBeVisible({ timeout: 3000 })
    await logoutButton.click()

    // signOut({ callbackUrl: "/login" }) redirects to /login
    await page.waitForURL("/login", { timeout: 10000 })
    await expect(page.getByRole("heading", { name: /connexion/i })).toBeVisible({ timeout: 5000 })
  })

  test("SMK-23: After logout, accessing /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard")
    // Middleware should redirect unauthenticated users to /login?callbackUrl=/dashboard
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toContain("/login")
  })

  test("SMK-24: Re-login with same credentials works", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', DEMO_EMAIL)
    await page.fill('input[name="password"]', DEMO_PASSWORD)
    await page.click('button[type="submit"]')

    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    expect(page.url()).toContain("/dashboard")

    const heading = page.getByRole("heading", { name: /bienvenue/i })
    await expect(heading).toBeVisible({ timeout: 5000 })
  })
})

/* ──────────────────────────────────────────────────────────────
 *  PHASE 10 — Error Handling
 * ────────────────────────────────────────────────────────────── */
test.describe("Phase 10 — Error Handling", () => {
  test("SMK-25: Navigate to non-existent route → 404 page renders", async ({ page }) => {
    await page.goto("/non-existent-route-test")
    // Next.js renders the not-found page
    await expect(page.getByText("404")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/page introuvable/i)).toBeVisible()
  })

  test("SMK-26: Login with invalid credentials → error message", async ({ page }) => {
    // Clear any existing auth session so we can access /login without redirect
    await page.context().clearCookies()
    await page.goto("/login")
    // Double-check we landed on login (not redirected to dashboard)
    await expect(page.getByRole("heading", { name: /connexion/i })).toBeVisible({ timeout: 5000 })

    await page.fill('input[name="email"]', "wrong@email.com")
    await page.fill('input[name="password"]', "wrong-password")
    await page.click('button[type="submit"]')

    // Wait for the error toast to appear — sonner renders <li> toast elements
    const errorToast = page.getByText(/email ou mot de passe incorrect/i)
    await expect(errorToast).toBeVisible({ timeout: 8000 })
  })
})
