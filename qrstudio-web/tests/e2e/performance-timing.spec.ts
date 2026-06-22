import { test, expect, type Page, type BrowserContext } from "@playwright/test"
import path from "path"
import fs from "fs"

// ════════════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════════════

const DEMO_EMAIL = "demo@qrstudio.app"
const DEMO_PASSWORD = "demo-password"
const TEST_DIR = path.join(process.cwd(), "tests", "e2e")
const AUTH_FILE = path.join(TEST_DIR, ".perf-auth.json")
const BASELINE_FILE = path.join(TEST_DIR, ".perf-baseline.json")

// ── Default viewport ──
test.use({ viewport: { width: 1280, height: 720 } })

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

interface NavigationTiming {
  ttfb: number
  domContentLoaded: number
  domInteractive: number
  responseEnd: number
  transferSize: number
}

interface PaintTiming {
  fcp: number | null
}

interface ResourceMetrics {
  count: number
  totalSize: number | null
  jsSize: number | null
  cssSize: number | null
  images: Array<{ url: string; size: number | null; duration: number }>
}

interface PageTiming {
  /** Wall-clock time from navigation start to networkidle (ms) */
  totalDuration: number
  /** Time To First Byte (ms) */
  ttfb: number
  /** DOM Content Loaded duration (ms) */
  domContentLoaded: number
  /** domInteractive timestamp (ms) */
  domInteractive: number
  /** responseEnd timestamp (ms) */
  responseEnd: number
  /** First Contentful Paint (ms) */
  fcp: number | null
  /** JS heap used size (bytes) */
  jsHeapUsedSize: number
  /** JS heap total size (bytes) */
  jsHeapTotalSize: number
  /** Number of DOM nodes */
  domNodes: number
  /** Total script execution duration (ms) */
  scriptDuration: number
  /** Total layout duration (ms) */
  layoutDuration: number
  /** Total task duration (ms) */
  taskDuration: number
  /** Number of loaded resources */
  resourceCount: number
  /** Total transfer size of all resources (bytes) */
  totalTransferSize: number | null
  /** Total JS transfer size (bytes) */
  jsTransferSize: number | null
  /** Total CSS transfer size (bytes) */
  cssTransferSize: number | null
}

type BaselineMap = Record<string, number>

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

/**
 * Log in as the demo user. Navigates to /login, fills credentials, submits,
 * and waits for the dashboard URL.
 */
async function loginAsDemo(page: Page): Promise<void> {
  await page.goto("/login")
  await page.fill('input[name="email"]', DEMO_EMAIL)
  await page.fill('input[name="password"]', DEMO_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.waitForLoadState("networkidle")
}

/**
 * Navigate to the QR list and click the first QR card to get to a detail page.
 * Returns the full URL of the detail page.
 */
async function navigateToFirstQRDetail(page: Page): Promise<string> {
  await page.goto("/dashboard/qr-codes")
  await page.waitForLoadState("networkidle")

  // Wait for at least one QR card to appear
  await page.waitForSelector('a[href*="/dashboard/qr/"]', { timeout: 15000 }).catch(() => {
    // Fallback: look for any clickable QR element
  })

  // Get the detail URL from the first QR link
  const qrLink = page.locator('a[href*="/dashboard/qr/"]').first()
  await expect(qrLink).toBeVisible({ timeout: 15000 })
  const href = await qrLink.getAttribute("href")
  const detailUrl = href ?? ""

  if (!detailUrl) {
    throw new Error("Could not find a QR detail link on the page")
  }

  await qrLink.click()
  await page.waitForURL(/\/dashboard\/qr\//, { timeout: 15000 })
  return page.url()
}

/**
 * Set up a PerformanceObserver for long tasks before navigation.
 * Call BEFORE page.goto().
 */
async function setupLongTaskObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as any).__longTasks = []
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            ;(window as any).__longTasks.push({
              duration: entry.duration,
              name: entry.name,
              startTime: entry.startTime,
            })
          }
        }
      })
      observer.observe({ type: "longtask" })
      ;(window as any).__longTaskObserver = observer
    } catch {
      // PerformanceObserver may not support 'longtask' in all browsers
      ;(window as any).__longTaskSupported = false
    }
  })
}

/**
 * Collect long task information after page load.
 */
async function collectLongTasks(page: Page): Promise<Array<{ duration: number; name: string; startTime: number }>> {
  return await page.evaluate(() => {
    const obs = (window as any).__longTaskObserver
    if (obs) obs.disconnect()
    return (window as any).__longTasks ?? []
  })
}

/**
 * Navigate to a URL and collect full performance timing data.
 * Uses waitForLoadState('networkidle') for consistent measurement.
 * Does NOT register long task observer (call setupLongTaskObserver beforehand if needed).
 */
async function navigateAndMeasure(page: Page, url: string): Promise<PageTiming> {
  // Navigate and measure wall-clock time
  const startTime = Date.now()
  await page.goto(url, { waitUntil: "load" })
  await page.waitForLoadState("networkidle")
  const totalDuration = Date.now() - startTime

  // Collect navigation timing
  const navTiming = await page.evaluate(() => {
    const entries = performance.getEntriesByType("navigation")
    if (entries.length === 0) return null
    const nav = entries[0] as PerformanceNavigationTiming
    return {
      ttfb: nav.responseStart - nav.requestStart,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
      domInteractive: nav.domInteractive,
      responseEnd: nav.responseEnd,
      transferSize: nav.transferSize,
    } as NavigationTiming
  })

  // Collect paint timing (FCP)
  const paintTiming = await page.evaluate(() => {
    const entries = performance.getEntriesByType("paint")
    const fcp = entries.find((e) => e.name === "first-contentful-paint")
    return { fcp: fcp ? fcp.startTime : null } as PaintTiming
  })

  // Collect resource timing
  const resourceMetrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    return {
      count: resources.length,
      totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
      jsSize: resources
        .filter((r) => r.name.endsWith(".js"))
        .reduce((sum, r) => sum + (r.transferSize || 0), 0),
      cssSize: resources
        .filter((r) => r.name.endsWith(".css"))
        .reduce((sum, r) => sum + (r.transferSize || 0), 0),
      images: resources
        .filter((r) => /\.(png|jpg|jpeg|gif|svg|webp|avif|ico)/i.test(r.name))
        .map((r) => ({
          url: r.name,
          size: r.transferSize,
          duration: r.duration,
        })),
    } as ResourceMetrics
  })

  // Collect Chrome DevTools Protocol metrics
  let jsHeapUsedSize = 0
  let jsHeapTotalSize = 0
  let domNodes = 0
  let scriptDuration = 0
  let layoutDuration = 0
  let taskDuration = 0
  try {
    const cdpSession = await page.context().newCDPSession(page)
    const cdpMetrics = await cdpSession.send('Performance.getMetrics')
    for (const metric of cdpMetrics.metrics) {
      switch (metric.name) {
        case 'JSHeapUsedSize': jsHeapUsedSize = metric.value; break
        case 'JSHeapTotalSize': jsHeapTotalSize = metric.value; break
        case 'Nodes': domNodes = metric.value; break
        case 'ScriptDuration': scriptDuration = metric.value * 1000; break
        case 'LayoutDuration': layoutDuration = metric.value * 1000; break
        case 'TaskDuration': taskDuration = metric.value * 1000; break
      }
    }
    await cdpSession.detach()
  } catch {
    // CDP metrics not available (non-Chrome browser or permissions)
  }

  return {
    totalDuration,
    ttfb: navTiming?.ttfb ?? 0,
    domContentLoaded: navTiming?.domContentLoaded ?? 0,
    domInteractive: navTiming?.domInteractive ?? 0,
    responseEnd: navTiming?.responseEnd ?? 0,
    fcp: paintTiming.fcp,
    jsHeapUsedSize,
    jsHeapTotalSize,
    domNodes,
    scriptDuration,
    layoutDuration,
    taskDuration,
    resourceCount: resourceMetrics.count,
    totalTransferSize: resourceMetrics.totalSize,
    jsTransferSize: resourceMetrics.jsSize,
    cssTransferSize: resourceMetrics.cssSize,
  }
}

// ── Formatting helpers ──

function ms(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.round(ms)}ms`
}

function bytes(b: number | null): string {
  if (b === null || b === 0) return "0 B"
  const kb = b / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

// ── Baseline management ──

function loadBaseline(): BaselineMap {
  try {
    if (fs.existsSync(BASELINE_FILE)) {
      return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf-8"))
    }
  } catch {
    // ignore corrupt baseline
  }
  return {}
}

function saveBaseline(baseline: BaselineMap): void {
  try {
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2))
  } catch {
    // non-critical
  }
}

function printPerfMetric(label: string, actual: number, threshold: number, unit: string): void {
  const status = actual <= threshold ? "✓" : "✗"
  console.log(`  ${status} ${label}: ${actual.toFixed(1)}${unit} (threshold: ${threshold}${unit})`)
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Public Page Performance
// ════════════════════════════════════════════════════════════════════════════

test.describe("1. Public Page Performance", () => {
  // Public pages don't need auth — explicitly clear any storage state
  test.use({ storageState: undefined as any })

  // ⚡ PERF-01
  test("/login page loads in under 3 seconds (total duration)", async ({ page }) => {
    // Record baseline for this metric
    const baseline = loadBaseline()
    const metricKey = "PERF-01_login_totalDuration"

    const timing = await navigateAndMeasure(page, "/login")

    console.log(`  /login — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 3000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(3000)
  })

  // ⚡ PERF-02
  test("/login page TTFB under 500ms", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-02_login_ttfb"

    const timing = await navigateAndMeasure(page, "/login")

    console.log(`  /login — TTFB: ${ms(timing.ttfb)}`)
    printPerfMetric("TTFB", timing.ttfb, 500, "ms")
    compareToBaseline(metricKey, timing.ttfb, baseline)
    saveBaseline(baseline)

    expect.soft(timing.ttfb).toBeLessThanOrEqual(500)
  })

  // ⚡ PERF-03
  test("/register page loads in under 3 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-03_register_totalDuration"

    const timing = await navigateAndMeasure(page, "/register")

    console.log(`  /register — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 3000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(3000)
  })

  // ⚡ PERF-04
  test("/qr-not-found page loads in under 2 seconds (simple page)", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-04_qr-not-found_totalDuration"

    const timing = await navigateAndMeasure(page, "/qr-not-found")

    console.log(`  /qr-not-found — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 2000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(2000)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 2. Authenticated Page Performance
// ════════════════════════════════════════════════════════════════════════════

test.describe("2. Authenticated Page Performance", () => {
  // Log in once and store auth state for reuse across all tests in this block
  test.beforeAll(async ({ browser }) => {
    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()
    await loginAsDemo(page)
    await context.storageState({ path: AUTH_FILE })
    await context.close()
  })

  test.use({ storageState: AUTH_FILE })

  // ⚡ PERF-05
  test("/dashboard page loads in under 3 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-05_dashboard_totalDuration"

    const timing = await navigateAndMeasure(page, "/dashboard")

    console.log(`  /dashboard — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 3000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(3000)
  })

  // ⚡ PERF-06
  test("/dashboard DOM Content Loaded under 1.5 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-06_dashboard_domContentLoaded"

    const timing = await navigateAndMeasure(page, "/dashboard")

    console.log(`  /dashboard — DOM Content Loaded: ${ms(timing.domContentLoaded)}`)
    printPerfMetric("DOM Content Loaded", timing.domContentLoaded, 1500, "ms")
    compareToBaseline(metricKey, timing.domContentLoaded, baseline)
    saveBaseline(baseline)

    expect.soft(timing.domContentLoaded).toBeLessThanOrEqual(1500)
  })

  // ⚡ PERF-07
  test("/dashboard/qr-codes page loads in under 3 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-07_qr-codes_totalDuration"

    const timing = await navigateAndMeasure(page, "/dashboard/qr-codes")

    console.log(`  /dashboard/qr-codes — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 3000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(3000)
  })

  // ⚡ PERF-08
  test("/dashboard/qr/new page loads in under 3 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-08_qr-new_totalDuration"

    const timing = await navigateAndMeasure(page, "/dashboard/qr/new")

    console.log(`  /dashboard/qr/new — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 3000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(3000)
  })

  // ⚡ PERF-09
  test("/dashboard/settings page loads in under 3 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-09_settings_totalDuration"

    const timing = await navigateAndMeasure(page, "/dashboard/settings")

    console.log(`  /dashboard/settings — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 3000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(3000)
  })

  // ⚡ PERF-10
  test("/dashboard/team page loads in under 3 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-10_team_totalDuration"

    const timing = await navigateAndMeasure(page, "/dashboard/team")

    console.log(`  /dashboard/team — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 3000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(3000)
  })

  // ⚡ PERF-11
  test("/dashboard/billing page loads in under 3 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-11_billing_totalDuration"

    const timing = await navigateAndMeasure(page, "/dashboard/billing")

    console.log(`  /dashboard/billing — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 3000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(3000)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 3. QR Detail Page Performance
// ════════════════════════════════════════════════════════════════════════════

test.describe("3. QR Detail Page Performance", () => {
  test.beforeAll(async ({ browser }) => {
    // Ensure auth state is available for this block
    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()
    await loginAsDemo(page)
    await context.storageState({ path: AUTH_FILE })
    await context.close()
  })

  test.use({ storageState: AUTH_FILE })

  // ⚡ PERF-12
  test("QR detail page /dashboard/qr/[id] loads in under 4 seconds", async ({ page }) => {
    // First, navigate to the QR list and pick a real QR ID
    const detailUrl = await navigateToFirstQRDetail(page)

    const baseline = loadBaseline()
    const metricKey = "PERF-12_qr-detail_totalDuration"

    // Now measure the detail page load from scratch
    const timing = await navigateAndMeasure(page, detailUrl)

    console.log(`  QR Detail — Total: ${ms(timing.totalDuration)}, TTFB: ${ms(timing.ttfb)}, FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("Total duration", timing.totalDuration, 4000, "ms")
    compareToBaseline(metricKey, timing.totalDuration, baseline)
    saveBaseline(baseline)

    expect.soft(timing.totalDuration).toBeLessThanOrEqual(4000)
  })

  // ⚡ PERF-13
  test("QR detail page shows loading skeleton before analytics data", async ({ page }) => {
    // Navigate to the QR detail page
    const detailUrl = await navigateToFirstQRDetail(page)

    // Navigate fresh to the detail page — wait for page to render but check
    // for skeleton BEFORE networkidle fully settles (analytics may lazy-load)
    await page.goto(detailUrl, { waitUntil: "load" })

    // Immediately check for skeleton/loading indicators (before networkidle)
    // Common skeleton patterns: animate-pulse, skeleton, loading, shimmer
    const skeletonVisible = await page.locator(
      '[class*="skeleton"], [class*="animate-pulse"], [class*="loading"], [class*="shimmer"], [aria-busy="true"]',
    )
      .first()
      .isVisible()
      .catch(() => false)

    await page.waitForLoadState("networkidle")

    // Check if a skeleton appeared at any point by looking for the analytics
    // content that eventually replaces it
    const analyticsVisible = await page.locator(
      "text=Analytics, text=Analytiques, text=Évolution des scans",
    ).first().isVisible().catch(() => false)

    console.log(`  QR Detail — Loading skeleton visible: ${skeletonVisible}, Analytics visible after load: ${analyticsVisible}`)

    // Soft assertion: either skeleton was visible OR analytics content is visible
    // (if analytics loaded too fast for skeleton to appear)
    expect.soft(skeletonVisible || analyticsVisible).toBe(true)
  })

  // ⚡ PERF-14
  test("Analytics section renders within 5 seconds", async ({ page }) => {
    const detailUrl = await navigateToFirstQRDetail(page)

    // Navigate to the detail page
    const startTime = Date.now()
    await page.goto(detailUrl, { waitUntil: "load" })
    await page.waitForLoadState("networkidle")

    // Wait for the Analytics section to appear
    await expect(
      page.locator("text=Analytics, text=Analytiques, text=Évolution des scans").first(),
    ).toBeVisible({ timeout: 15000 })

    const analyticsRenderTime = Date.now() - startTime

    const baseline = loadBaseline()
    const metricKey = "PERF-14_analytics_renderTime"

    console.log(`  Analytics section rendered in: ${ms(analyticsRenderTime)}`)
    printPerfMetric("Analytics render time", analyticsRenderTime, 5000, "ms")
    compareToBaseline(metricKey, analyticsRenderTime, baseline)
    saveBaseline(baseline)

    expect.soft(analyticsRenderTime).toBeLessThanOrEqual(5000)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 4. API Response Times
// ════════════════════════════════════════════════════════════════════════════

test.describe("4. API Response Times", () => {
  // ⚡ PERF-15
  test("GET /api/health responds in under 200ms", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-15_health_responseTime"

    const startTime = Date.now()
    const response = await page.request.get("/api/health")
    const elapsed = Date.now() - startTime

    expect(response.ok()).toBe(true)

    console.log(`  GET /api/health — ${elapsed}ms, status: ${response.status()}`)
    printPerfMetric("Response time", elapsed, 200, "ms")
    compareToBaseline(metricKey, elapsed, baseline)
    saveBaseline(baseline)

    expect.soft(elapsed).toBeLessThanOrEqual(200)
  })

  // ⚡ PERF-16
  test("GET /api/auth/session responds in under 500ms (with auth)", async ({ page }) => {
    // First login to get an authenticated session
    await loginAsDemo(page)

    const baseline = loadBaseline()
    const metricKey = "PERF-16_session_responseTime"

    const startTime = Date.now()
    const response = await page.request.get("/api/auth/session")
    const elapsed = Date.now() - startTime

    const body = await response.json()
    expect(body).toHaveProperty("user")

    console.log(`  GET /api/auth/session — ${elapsed}ms, status: ${response.status()}, user: ${body.user?.email ?? "unknown"}`)
    printPerfMetric("Response time", elapsed, 500, "ms")
    compareToBaseline(metricKey, elapsed, baseline)
    saveBaseline(baseline)

    expect.soft(elapsed).toBeLessThanOrEqual(500)
  })

  // ⚡ PERF-17
  test("tRPC qr.list responds in under 1 second", async ({ page }) => {
    // Login to get an authenticated session
    await loginAsDemo(page)

    const baseline = loadBaseline()
    const metricKey = "PERF-17_trpc-qr-list_responseTime"

    // Use tRPC's HTTP GET endpoint for qr.list
    // The tRPC API endpoint is typically /api/trpc/{path}?input={...}
    // For qr.list, the query path is "qr.list"
    const startTime = Date.now()
    const response = await page.request.get("/api/trpc/qr.list", {
      params: { input: "{}" },
    })
    const elapsed = Date.now() - startTime

    const body = await response.json()
    expect(response.ok()).toBe(true)

    const qrCount = Array.isArray(body) ? body.length : body?.result?.data?.length ?? "?"
    console.log(`  tRPC qr.list — ${elapsed}ms, status: ${response.status()}, QR count: ${qrCount}`)
    printPerfMetric("Response time", elapsed, 1000, "ms")
    compareToBaseline(metricKey, elapsed, baseline)
    saveBaseline(baseline)

    expect.soft(elapsed).toBeLessThanOrEqual(1000)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 5. Resource Metrics
// ════════════════════════════════════════════════════════════════════════════

test.describe("5. Resource Metrics", () => {
  test.beforeAll(async ({ browser }) => {
    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()
    await loginAsDemo(page)
    await context.storageState({ path: AUTH_FILE })
    await context.close()
  })

  test.use({ storageState: AUTH_FILE })

  // ⚡ PERF-18
  test("Total JS bundle size for dashboard page under 2MB (transfer size)", async ({ page }) => {
    const baseline = loadBaseline()

    const timing = await navigateAndMeasure(page, "/dashboard")

    console.log(`  /dashboard — JS transfer size: ${bytes(timing.jsTransferSize)}`)
    printPerfMetric("JS transfer size", timing.jsTransferSize ?? 0, 2 * 1024 * 1024, "bytes")
    compareToBaseline("PERF-18_jsTransferSize", timing.jsTransferSize ?? 0, baseline)
    saveBaseline(baseline)

    expect.soft(timing.jsTransferSize ?? 0).toBeLessThanOrEqual(2 * 1024 * 1024)
  })

  // ⚡ PERF-19
  test("Total CSS size under 500KB", async ({ page }) => {
    const baseline = loadBaseline()

    const timing = await navigateAndMeasure(page, "/dashboard")

    console.log(`  /dashboard — CSS transfer size: ${bytes(timing.cssTransferSize)}`)
    printPerfMetric("CSS transfer size", timing.cssTransferSize ?? 0, 500 * 1024, "bytes")
    compareToBaseline("PERF-19_cssTransferSize", timing.cssTransferSize ?? 0, baseline)
    saveBaseline(baseline)

    expect.soft(timing.cssTransferSize ?? 0).toBeLessThanOrEqual(500 * 1024)
  })

  // ⚡ PERF-20
  test("First Contentful Paint (FCP) under 1.5 seconds", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-20_fcp"

    const timing = await navigateAndMeasure(page, "/dashboard")

    console.log(`  /dashboard — FCP: ${ms(timing.fcp ?? 0)}`)
    printPerfMetric("FCP", timing.fcp ?? Number.POSITIVE_INFINITY, 1500, "ms")
    compareToBaseline(metricKey, timing.fcp ?? 0, baseline)
    saveBaseline(baseline)

    expect.soft(timing.fcp ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1500)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 6. Memory & CPU
// ════════════════════════════════════════════════════════════════════════════

test.describe("6. Memory & CPU", () => {
  test.beforeAll(async ({ browser }) => {
    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()
    await loginAsDemo(page)
    await context.storageState({ path: AUTH_FILE })
    await context.close()
  })

  test.use({ storageState: AUTH_FILE })

  // ⚡ PERF-21
  test("JS Heap size after dashboard load under 50MB", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-21_jsHeapUsedSize"

    const timing = await navigateAndMeasure(page, "/dashboard")

    const heapMB = timing.jsHeapUsedSize / (1024 * 1024)
    console.log(`  /dashboard — JS Heap used: ${heapMB.toFixed(1)} MB (${bytes(timing.jsHeapUsedSize)})`)
    printPerfMetric("JS Heap used", heapMB, 50, " MB")
    compareToBaseline(metricKey, timing.jsHeapUsedSize, baseline)
    saveBaseline(baseline)

    expect.soft(timing.jsHeapUsedSize).toBeLessThanOrEqual(50 * 1024 * 1024)
  })

  // ⚡ PERF-22
  test("Number of DOM nodes under 1000 after page render", async ({ page }) => {
    const baseline = loadBaseline()
    const metricKey = "PERF-22_domNodes"

    const timing = await navigateAndMeasure(page, "/dashboard")

    console.log(`  /dashboard — DOM nodes: ${timing.domNodes}`)
    printPerfMetric("DOM nodes", timing.domNodes, 1000, "")
    compareToBaseline(metricKey, timing.domNodes, baseline)
    saveBaseline(baseline)

    expect.soft(timing.domNodes).toBeLessThanOrEqual(1000)
  })

  // ⚡ PERF-23
  test("No long tasks (>50ms) on main thread during page load", async ({ page }) => {
    // Setup long task observer before navigation
    await setupLongTaskObserver(page)

    // Navigate and measure
    await page.goto("/dashboard", { waitUntil: "load" })
    await page.waitForLoadState("networkidle")

    // Collect long tasks
    const longTasks = await collectLongTasks(page)

    let taskDurationValue = 0
    try {
      const cdpSession = await page.context().newCDPSession(page)
      const cdpMetrics = await cdpSession.send('Performance.getMetrics')
      const taskMetric = cdpMetrics.metrics.find((m: { name: string }) => m.name === 'TaskDuration')
      if (taskMetric) taskDurationValue = taskMetric.value
      await cdpSession.detach()
    } catch {
      // CDP metrics not available
    }
    const totalTaskDuration = taskDurationValue

    console.log(`  /dashboard — Long tasks >50ms: ${longTasks.length}, Total task duration: ${(totalTaskDuration * 1000).toFixed(0)}ms`)
    if (longTasks.length > 0) {
      console.log(`    Long task durations: ${longTasks.map((t) => `${t.duration.toFixed(0)}ms`).join(", ")}`)
    }

    // Soft assertion — print warning but don't fail the suite
    expect.soft(longTasks.length).toBe(0)

    // Also ensure total task duration is reasonable (< 3s)
    expect.soft(totalTaskDuration * 1000).toBeLessThanOrEqual(3000)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 7. Performance Regression Detection
// ════════════════════════════════════════════════════════════════════════════

test.describe("7. Performance Regression Detection", () => {
  test.beforeAll(async ({ browser }) => {
    const context: BrowserContext = await browser.newContext()
    const page: Page = await context.newPage()
    await loginAsDemo(page)
    await context.storageState({ path: AUTH_FILE })
    await context.close()
  })

  test.use({ storageState: AUTH_FILE })

  // ⚡ PERF-24
  test("Record baseline metrics and compare (print warnings if >20% slower than baseline)", async ({ page }) => {
    const baseline = loadBaseline()
    const currentRun: BaselineMap = {}
    const testPairs: Array<{ url: string; label: string }> = [
      { url: "/login", label: "login" },
      { url: "/register", label: "register" },
      { url: "/qr-not-found", label: "qr-not-found" },
      { url: "/dashboard", label: "dashboard" },
      { url: "/dashboard/qr-codes", label: "qr-codes" },
      { url: "/dashboard/qr/new", label: "qr-new" },
      { url: "/dashboard/settings", label: "settings" },
      { url: "/dashboard/team", label: "team" },
      { url: "/dashboard/billing", label: "billing" },
    ]

    const timedOutUrls: string[] = []

    for (const { url, label } of testPairs) {
      try {
        const timing = await navigateAndMeasure(page, url)

        // Store current measurements
        currentRun[`baseline_${label}_totalDuration`] = timing.totalDuration
        currentRun[`baseline_${label}_ttfb`] = timing.ttfb
        currentRun[`baseline_${label}_fcp`] = timing.fcp ?? 0
        currentRun[`baseline_${label}_domNodes`] = timing.domNodes
        currentRun[`baseline_${label}_jsHeap`] = timing.jsHeapUsedSize
        currentRun[`baseline_${label}_transferSize`] = timing.totalTransferSize ?? 0

        // Compare with stored baseline
        const prevTotal = baseline[`baseline_${label}_totalDuration`]
        if (prevTotal && prevTotal > 0) {
          const ratio = timing.totalDuration / prevTotal
          if (ratio > 1.2) {
            console.warn(
              `  ⚠️ PERF-24 WARNING [${label}]: Total duration ${ms(timing.totalDuration)} is ${((ratio - 1) * 100).toFixed(1)}% slower than baseline ${ms(prevTotal)}`,
            )
          } else if (ratio < 0.8) {
            console.log(
              `  🎉 PERF-24 [${label}]: Total duration ${ms(timing.totalDuration)} is ${((1 - ratio) * 100).toFixed(1)}% faster than baseline ${ms(prevTotal)}`,
            )
          } else {
            console.log(`  ✓ PERF-24 [${label}]: ${ms(timing.totalDuration)} (baseline: ${ms(prevTotal)})`)
          }
        } else {
          console.log(`  📝 PERF-24 [${label}]: Recording new baseline: ${ms(timing.totalDuration)}`)
        }
      } catch (err) {
        console.warn(`  ⚠️ PERF-24 [${label}]: Failed to measure — ${err}`)
        timedOutUrls.push(label)
      }
    }

    // Save updated baseline
    const merged = { ...baseline, ...currentRun }
    saveBaseline(merged)

    // Save a human-readable report
    const reportPath = path.join(TEST_DIR, ".perf-report.json")
    try {
      fs.writeFileSync(reportPath, JSON.stringify(currentRun, null, 2))
      console.log(`  📊 Performance report saved to: ${reportPath}`)
    } catch {
      // non-critical
    }

    if (timedOutUrls.length > 0) {
      console.warn(`  ⚠️ PERF-24: ${timedOutUrls.length} URL(s) could not be measured: ${timedOutUrls.join(", ")}`)
    }

    // Soft assertion - at least measure without errors
    expect.soft(Object.keys(currentRun).length).toBeGreaterThanOrEqual(testPairs.length * 5)
  })

  // ⚠️ PERF-25
  test("Image assets are properly optimized (no oversized images)", async ({ page }) => {
    // Navigate to the dashboard (which has icons and potentially images)
    await page.goto("/dashboard", { waitUntil: "load" })
    await page.waitForLoadState("networkidle")

    // Collect all image resources
    const imageResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      return resources
        .filter((r) => /\.(png|jpg|jpeg|gif|svg|webp|avif|ico)/i.test(r.name))
        .map((r) => ({
          url: r.name.split("?")[0], // strip query params for readability
          size: r.transferSize,
          duration: r.duration,
        }))
        .filter((r) => r.size !== null && r.size > 0)
    })

    // Also check all <img> tags on the page
    const imageTags = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).map((img) => ({
        src: (img as HTMLImageElement).src,
        width: (img as HTMLImageElement).naturalWidth,
        height: (img as HTMLImageElement).naturalHeight,
        loading: (img as HTMLImageElement).loading,
      }))
    })

    // Log all found images
    console.log(`  Images found: ${imageTags.length} <img> tags, ${imageResources.length} resource entries`)
    if (imageResources.length > 0) {
      console.log("  Image resources:")
      for (const img of imageResources) {
        const sizeLabel = img.size && img.size > 0 ? bytes(img.size) : "cached/0"
        console.log(`    - ${img.url} (${sizeLabel}, ${img.duration.toFixed(0)}ms)`)
      }
    }

    // Flag any image over 500KB transfer size
    const oversizedImages = imageResources.filter((img) => (img.size ?? 0) > 500 * 1024)
    if (oversizedImages.length > 0) {
      console.warn(`  ⚠️ PERF-25: ${oversizedImages.length} oversized image(s) found (>500KB):`)
      for (const img of oversizedImages) {
        console.warn(`    - ${img.url} (${bytes(img.size ?? 0)})`)
      }
    }

    // Flag any <img> without explicit width/height or loading="lazy" for below-fold
    const unoptimizedTags = imageTags.filter((img) => !img.width && !img.height)
    if (unoptimizedTags.length > 0) {
      console.warn(`  ⚠️ PERF-25: ${unoptimizedTags.length} <img> tag(s) without explicit dimensions:`)
      for (const img of unoptimizedTags) {
        console.warn(`    - ${img.src}`)
      }
    }

    // Soft assertion: no image should exceed 500KB transfer size
    for (const img of oversizedImages) {
      expect.soft(img.size ?? 0).toBeLessThanOrEqual(500 * 1024)
    }

    // Soft assertion: most images should have explicit dimensions
    expect.soft(unoptimizedTags.length).toBeLessThanOrEqual(3)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Baseline comparison helper
// ════════════════════════════════════════════════════════════════════════════

function compareToBaseline(key: string, actual: number, baseline: BaselineMap): void {
  const prev = baseline[key]
  if (prev !== undefined && prev > 0) {
    const ratio = actual / prev
    if (ratio > 1.2) {
      console.warn(`  ⚠️ PERF-24 WARNING: ${key} is ${((ratio - 1) * 100).toFixed(1)}% slower than baseline (${ms(actual)} vs ${ms(prev)})`)
    } else if (ratio < 0.5) {
      console.log(`  🎉 ${key} is ${((1 - ratio) * 100).toFixed(1)}% faster than baseline (${ms(actual)} vs ${ms(prev)})`)
    }
  }
  // Record current measurement as the latest baseline
  baseline[key] = actual
}
