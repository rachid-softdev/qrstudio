import { test, expect } from "@playwright/test"

test.describe("Dashboard & navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', "demo@qrstudio.app")
    await page.fill('input[name="password"]', "demo-password")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await page.waitForLoadState("networkidle")
  })

  // ─── Dashboard stats ─────────────────────────────────────────────────────

  test("1 — Dashboard loads with stats (total QR, scans count, team count)", async ({ page }) => {
    // The dashboard page shows either stats cards (if account has QR codes)
    // or an empty state with CTA (if no QR codes yet)
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 })
    await expect(page.locator("h1")).toContainText(/Bienvenue/i)

    // Stat cards are rendered by DashboardStatsClient: grid with 4 cards
    // Labels: "QR codes", "Scans total", "Scans aujourd'hui", "Membres"
    const statCards = page.locator(".grid.gap-4.sm\\:grid-cols-2.lg\\:grid-cols-4")
    const emptyState = page.getByRole("heading", { name: /Créez votre premier QR code/i })

    if (await emptyState.isVisible().catch(() => false)) {
      // Account has 0 QR codes — empty state is shown
      await expect(statCards).not.toBeVisible()
    } else {
      // Account has QR codes — stat cards should be visible
      await expect(statCards).toBeVisible({ timeout: 8000 })
      // Each stat card displays a value in .text-2xl.font-bold.tabular-nums
      const values = statCards.locator(".text-2xl")
      const count = await values.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  test("2 — Empty state shown for new account with no QR codes", async ({ page }) => {
    // When qrCodeCount === 0, the dashboard renders EmptyState
    // with title "Créez votre premier QR code" and a CTA button
    const emptyTitle = page.getByRole("heading", { name: /Créez votre premier QR code/i })

    if (await emptyTitle.isVisible().catch(() => false)) {
      // Empty state is rendered
      await expect(emptyTitle).toBeVisible()

      // CTA button should link to /dashboard/qr/new
      const cta = page.getByRole("link", { name: /Nouveau QR code/i })
      await expect(cta).toBeVisible()
      await expect(cta).toHaveAttribute("href", "/dashboard/qr/new")

      // Use cases cards should be visible (4 example cards)
      const useCases = page.locator(".grid.gap-3.sm\\:grid-cols-2 .rounded-xl")
      // There should be use case cards visible
      await expect(useCases.first()).toBeVisible()

      // Help link should be visible at bottom
      await expect(page.getByRole("link", { name: /Aide/i })).toBeVisible()
    } else {
      // Account has data — skip this test gracefully
      test.skip(true, "Demo account has QR codes — empty state not applicable")
    }
  })

  test("3 — Stat numbers use space as thousands separator", async ({ page }) => {
    // formatNumber(n) uses space as thousands separator: 1000 → "1 000"
    // Stat values are rendered inside .text-2xl.font-bold.tabular-nums elements
    const statValue = page.locator(".text-2xl.font-bold.tabular-nums").first()

    if (await statValue.isVisible().catch(() => false)) {
      const text = await statValue.textContent()
      // Should not contain English comma formatting
      expect(text).not.toContain(",")
      // If number is 0 or > 999, should use space separator
      if (text && parseInt(text.replace(/\s/g, ""), 10) > 999) {
        expect(text).toContain(" ")
      }
    } else {
      test.skip(true, "No stat cards visible — account may have 0 QR codes")
    }
  })

  // ─── Navigation sidebar ──────────────────────────────────────────────────

  test("4 — Click each sidebar link navigates to correct URL", async ({ page }) => {
    const sidebar = page.locator('nav[aria-label="Navigation principale"]')

    const links: { href: string; name: string }[] = [
      { href: "/dashboard", name: "Dashboard" },
      { href: "/dashboard/qr-codes", name: "QR Codes" },
      { href: "/dashboard/team", name: "Équipe" },
      { href: "/dashboard/billing", name: "Facturation" },
      { href: "/dashboard/settings", name: "Paramètres" },
      { href: "/dashboard/aide", name: "Aide" },
    ]

    for (const { href, name } of links) {
      const link = sidebar.getByRole("link", { name })
      await expect(link).toBeVisible()
      await link.click()
      await expect(page).toHaveURL(href, { timeout: 10000 })
      // Wait for page content to settle before next navigation
      await page.waitForLoadState("networkidle")
    }
  })

  test("5 — Active sidebar link has visual indication", async ({ page }) => {
    const sidebar = page.locator('nav[aria-label="Navigation principale"]')

    // Start on Dashboard — it should be active
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    const dashboardLink = sidebar.getByRole("link", { name: "Dashboard" })
    await expect(dashboardLink).toHaveAttribute("aria-current", "page")
    // Active link receives bg-primary/10 + text-primary classes
    await expect(dashboardLink).toHaveClass(/bg-primary\/10/)
    await expect(dashboardLink).toHaveClass(/text-primary/)

    // Navigate to QR Codes — it becomes active, Dashboard loses active state
    await sidebar.getByRole("link", { name: "QR Codes" }).click()
    await expect(page).toHaveURL("/dashboard/qr-codes", { timeout: 10000 })

    const qrLink = sidebar.getByRole("link", { name: "QR Codes" })
    await expect(qrLink).toHaveAttribute("aria-current", "page")
    await expect(qrLink).toHaveClass(/bg-primary\/10/)
    await expect(qrLink).toHaveClass(/text-primary/)

    // Dashboard link should no longer have aria-current
    await expect(dashboardLink).not.toHaveAttribute("aria-current", "page")
  })

  test("6 — Browser back/forward navigation works between pages", async ({ page }) => {
    const sidebar = page.locator('nav[aria-label="Navigation principale"]')

    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    // Navigate to Settings
    await sidebar.getByRole("link", { name: "Paramètres" }).click()
    await expect(page).toHaveURL("/dashboard/settings", { timeout: 10000 })

    // Navigate to Aide (to have a 2-step history)
    await sidebar.getByRole("link", { name: "Aide" }).click()
    await expect(page).toHaveURL("/dashboard/aide", { timeout: 10000 })

    // Go back once → Settings
    await page.goBack()
    await expect(page).toHaveURL("/dashboard/settings", { timeout: 10000 })

    // Go back again → Dashboard
    await page.goBack()
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 })

    // Go forward → Settings
    await page.goForward()
    await expect(page).toHaveURL("/dashboard/settings", { timeout: 10000 })

    // Active link should update to reflect current page
    await expect(sidebar.getByRole("link", { name: "Paramètres" })).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  // ─── Header / User menu ──────────────────────────────────────────────────

  test("7 — User name and email displayed in sidebar", async ({ page }) => {
    // The UserMenu component in the sidebar shows user name and email
    await expect(page.locator("aside").getByText("demo@qrstudio.app")).toBeVisible({
      timeout: 5000,
    })
    // User name should also be visible (the display name for demo account)
    const userName = page.locator("aside").locator("span.text-sm.font-medium.text-foreground")
    await expect(userName).toBeVisible()
  })

  test("8 — Logout from user menu redirects to /auth/login", async ({ page }) => {
    // Open the user dropdown menu by clicking the trigger area (avatar + name)
    const userTrigger = page.locator("aside").getByText("demo@qrstudio.app").first()
    await userTrigger.click()

    // Wait for dropdown to appear and click "Déconnexion"
    const logoutItem = page.getByRole("menuitem", { name: /Déconnexion/i })
    await expect(logoutItem).toBeVisible({ timeout: 5000 })
    await logoutItem.click()

    // Should redirect to login page via signOut({ callbackUrl: "/login" })
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

  test("9 — After logout, cannot access /dashboard (redirect to login)", async ({ page }) => {
    // Logout first
    const userTrigger = page.locator("aside").getByText("demo@qrstudio.app").first()
    await userTrigger.click()
    const logoutItem = page.getByRole("menuitem", { name: /Déconnexion/i })
    await expect(logoutItem).toBeVisible({ timeout: 5000 })
    await logoutItem.click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })

    // Try to access dashboard directly — middleware should redirect to login
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    // The callbackUrl should be set so user returns to dashboard after login
    expect(page.url()).toContain("callbackUrl=%2Fdashboard")
  })

  // ─── States & loading ────────────────────────────────────────────────────

  test("10 — Content renders after loading (QR codes list loads correctly)", async ({ page }) => {
    await page.goto("/dashboard/qr-codes")
    await page.waitForLoadState("networkidle")

    // The QRCodeListClient renders either a grid of QR cards,
    // skeleton loaders (during isLoading), or an empty state
    const grid = page.locator(".grid.grid-cols-1")
    const emptyState = page.getByRole("heading", { name: /Aucun QR code/i })
    const tablePlaceholder = page.locator("text=Créez votre premier QR code")

    // After loading, one of these should be visible
    await expect(
      grid.or(emptyState).or(tablePlaceholder).first(),
    ).toBeVisible({ timeout: 10000 })

    // Header should be present with correct title
    await expect(page.locator("h1")).toContainText(/QR Codes/i)
  })

  test("11 — Direct navigation to deep pages works correctly", async ({ page }) => {
    // Pages not in the sidebar should also load correctly
    await page.goto("/dashboard/qr/new")
    await expect(page.locator("h1")).toContainText(/Nouveau QR code/i, { timeout: 5000 })

    await page.goto("/dashboard/settings/security")
    await expect(page.locator("h1")).toContainText(/Sécurité/i, { timeout: 5000 })
  })

  // ─── Empty states ────────────────────────────────────────────────────────

  test("13 — /dashboard with 0 QR codes shows empty state + CTA", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    const emptyTitle = page.getByRole("heading", { name: /Créez votre premier QR code/i })

    if (await emptyTitle.isVisible().catch(() => false)) {
      // Verify full empty state structure
      await expect(emptyTitle).toBeVisible()

      // CTA button should be present
      const cta = page.getByRole("link", { name: /Nouveau QR code/i })
      await expect(cta).toBeVisible()
      await expect(cta).toHaveAttribute("href", "/dashboard/qr/new")

      // Use case examples should be visible (4 cards)
      const useCaseCards = page.locator(".grid.gap-3.sm\\:grid-cols-2 .rounded-xl")
      await expect(useCaseCards.first()).toBeVisible()
    } else {
      test.skip(true, "Demo account has QR codes — empty state not shown")
    }
  })

  test("14 — /dashboard/team with 0 members shows empty state", async ({ page }) => {
    await page.goto("/dashboard/team")
    await page.waitForLoadState("networkidle")

    // MemberList shows EmptyState when members.length === 0
    const emptyTitle = page.getByRole("heading", { name: /Aucun membre/i })
    const memberTable = page.locator("table")

    if (await emptyTitle.isVisible().catch(() => false)) {
      // No members — empty state with invite prompt
      await expect(emptyTitle).toBeVisible()
      await expect(page.getByText(/Invitez des collaborateurs/i)).toBeVisible()
    } else if (await memberTable.isVisible().catch(() => false)) {
      // Has members — table should be visible
      await expect(memberTable).toBeVisible()
    }

    // Header should always be present
    await expect(page.locator("h1")).toContainText(/Équipe/i)
  })

  // ─── Help page ───────────────────────────────────────────────────────────

  test("15 — /dashboard/aide loads and displays FAQ content", async ({ page }) => {
    await page.goto("/dashboard/aide")
    await page.waitForLoadState("networkidle")

    // Page title
    await expect(page.locator("h1")).toContainText("Aide", { timeout: 5000 })

    // All three FAQ sections should be present
    await expect(page.getByText("Généralités")).toBeVisible()
    await expect(page.getByText("Plans et facturation")).toBeVisible()
    await expect(page.getByText("Compte et équipe")).toBeVisible()

    // Check that FAQ items render (expandable accordion or visible content)
    await expect(page.getByText(/QR code dynamique/i).first()).toBeVisible()

    // Contact card should be present
    await expect(page.getByText(/support@qrstudio.app/i)).toBeVisible()
  })
})
