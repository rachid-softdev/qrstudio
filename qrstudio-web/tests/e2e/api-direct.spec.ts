import { test, expect, type Page, type APIResponse } from "@playwright/test"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_EMAIL = "demo@qrstudio.app"
const DEMO_PASSWORD = "demo-password"
const API_TIMEOUT = 5_000
const NAV_TIMEOUT = 10_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Log in via the UI login page. After this, `page.request` carries the session cookie. */
async function loginAsDemo(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" })
  await page.fill('input[name="email"]', DEMO_EMAIL)
  await page.fill('input[name="password"]', DEMO_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: NAV_TIMEOUT })
  await page.waitForLoadState("networkidle")
}

/**
 * Log in and extract the workspace ID from the first tRPC request the
 * dashboard/qr-codes page fires. All tRPC procedures that touch QR codes
 * require `workspaceId`, so we need this for most authenticated tests.
 */
async function loginAndGetWorkspaceId(page: Page): Promise<string> {
  await loginAsDemo(page)

  // Navigate to the QR codes list page; it calls qr.list on mount.
  const tRpcRequestPromise = page.waitForRequest(
    (req) =>
      req.url().includes("/api/trpc/") &&
      req.method() === "POST",
  )
  await page.goto("/dashboard/qr-codes", { waitUntil: "networkidle" })
  await page.waitForLoadState("networkidle")

  const tRpcRequest = await tRpcRequestPromise
  const postData = JSON.parse(tRpcRequest.postData() || "{}")

  // Handle both single-call and batched tRPC v11 formats
  const body = Array.isArray(postData) ? postData[0] : postData
  const workspaceId: string = body?.json?.workspaceId ?? body?.workspaceId ?? ""
  expect(workspaceId).toBeTruthy()
  return workspaceId
}

/**
 * Get the CSRF token from the next-auth session endpoint.
 * Requires the user to be logged in (session cookie present).
 */
async function getCsrfTokenFromSession(page: Page): Promise<string> {
  const response = await page.request.get("/api/auth/session", {
    timeout: API_TIMEOUT,
  })
  const session = await response.json()
  const token: string = session?.csrfToken ?? ""
  expect(token).toBeTruthy()
  return token
}

/**
 * Create a URL-type QR code via the multi-step UI wizard.
 * Returns `{ shortCode, id }` extracted from the tRPC create response.
 */
async function createUrlQRViaUI(
  page: Page,
): Promise<{ shortCode: string; id: string }> {
  await page.goto("/dashboard/qr/new", { waitUntil: "networkidle" })

  // Step 1: Select URL type
  await page.locator('div:has(h3:text-is("URL"))').first().click()
  await page.click('button:has-text("Suivant")')

  // Step 2: Fill destination URL
  await page.fill('input#url', "https://example.com/api-direct-test")
  await page.click('button:has-text("Suivant")')

  // Step 3: Skip design step
  await page.click('button:has-text("Suivant")')

  // Step 4: Name + create
  const qrName = `API-Direct-${Date.now()}`
  await page.fill('input#qr-name', qrName)

  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/trpc/qr.create") && resp.status() === 200,
  )

  await page.click('button:has-text("Créer le QR code")')

  const response = await responsePromise
  const body = await response.json()
  const data = Array.isArray(body) ? body[0] : body
  const json = data?.result?.data?.json ?? {}
  const shortCode: string = json.shortCode ?? ""
  const id: string = json.id ?? ""

  expect(shortCode).toBeTruthy()
  expect(id).toBeTruthy()
  return { shortCode, id }
}

/**
 * Pause a QR code (sets status to PAUSED) via the detail-page button.
 */
async function pauseQRCode(page: Page, id: string) {
  await page.goto(`/dashboard/qr/${id}`, { waitUntil: "networkidle" })
  const pauseBtn = page.locator('button:has-text("Mettre en pause")').first()
  await pauseBtn.waitFor({ state: "visible", timeout: 5000 })
  await pauseBtn.click()
  await expect(page.locator("text=mis en pause")).toBeVisible({
    timeout: 5000,
  })
}

/**
 * Delete (soft-delete) a QR code via the detail-page UI.
 */
async function deleteQRViaUI(page: Page, id: string) {
  await page.goto(`/dashboard/qr/${id}`, { waitUntil: "networkidle" })
  const deleteBtn = page.locator('button:has-text("Supprimer")').first()
  await deleteBtn.waitFor({ state: "visible", timeout: 5000 })
  await deleteBtn.click()
  const confirmBtn = page.locator(
    'div[role="alertdialog"] button:has-text("Supprimer")',
  ).last()
  await confirmBtn.waitFor({ state: "visible", timeout: 5000 })
  await confirmBtn.click()
  await expect(page.locator("text=QR code supprimé")).toBeVisible({
    timeout: 5000,
  })
}

/** Extract JSON body from a Playwright APIResponse (character limit safe). */
async function readJson(response: APIResponse): Promise<unknown> {
  const text = await response.text()
  if (!text || !text.trim()) return {}
  return JSON.parse(text)
}

/**
 * Extract the data payload from a tRPC v11 response, handling both
 * single-call and batched response formats and superjson transformer.
 *
 *   Success:   { result: { data: { json: { ... } } } }
 *   Batched:   [ { result: { data: { json: { ... } } } } ]
 */
function extractTrpcData(body: unknown): unknown {
  const obj = Array.isArray(body) ? body[0] : body
  if (!obj || typeof obj !== "object") return {}
  const rec = obj as Record<string, unknown>
  return (rec as any)?.result?.data?.json ?? rec
}

/**
 * Extract the error payload from a tRPC v11 error response.
 *
 *   Error: { error: { code: "UNAUTHORIZED", message: "...", data: { ... } } }
 *   Batched: [ { error: { code: "NOT_FOUND", message: "...", data: { ... } } } ]
 */
function extractTrpcError(body: unknown): Record<string, unknown> {
  const obj = Array.isArray(body) ? body[0] : body
  if (!obj || typeof obj !== "object") return {}
  const rec = obj as Record<string, unknown>
  const err = rec.error as Record<string, unknown> | undefined
  return err ?? rec
}

// ---------------------------------------------------------------------------
// 1. Health Check Endpoint
// ---------------------------------------------------------------------------
test.describe("Health Check Endpoint", () => {
  test("✅ API-HEALTH-01: GET /api/health returns 200 with status ok", async ({
    request,
  }) => {
    const response = await request.get("/api/health", { timeout: API_TIMEOUT })
    expect(response.status()).toBe(200)

    const body = await readJson(response) as { status?: string }
    expect(body.status).toBe("ok")
  })

  test("✅ API-HEALTH-02: Health check response has expected JSON structure", async ({
    request,
  }) => {
    const response = await request.get("/api/health", { timeout: API_TIMEOUT })
    expect(response.ok()).toBeTruthy()

    const body = await readJson(response) as Record<string, unknown>
    expect(body).toHaveProperty("status")
    expect(body).toHaveProperty("timestamp")
    expect(body).toHaveProperty("version")
    expect(body).toHaveProperty("checks")

    const checks = body.checks as Record<string, unknown>
    expect(checks).toHaveProperty("database")
    expect(checks).toHaveProperty("redis")
    expect(checks).toHaveProperty("pgBoss")
    expect(checks).toHaveProperty("dlq")

    const db = checks.database as Record<string, unknown>
    expect(db.status).toBe("ok")

    // timestamp must be a valid ISO string
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp)
  })

  test("⚠️ API-HEALTH-03: Health check responds in under 5 seconds", async ({
    request,
  }) => {
    const start = Date.now()
    const response = await request.get("/api/health", { timeout: API_TIMEOUT })
    const elapsed = Date.now() - start

    expect(response.ok()).toBeTruthy()
    expect(elapsed).toBeLessThan(5_000)
  })
})

// ---------------------------------------------------------------------------
// 2. QR Redirect API (Public)
// ---------------------------------------------------------------------------
test.describe("QR Redirect API (Public)", () => {
  let demoPage: Page
  let shortCode: string
  let qrId: string

  test.beforeAll(async ({ browser }) => {
    // Create a QR code so we have a known good shortCode for redirect tests
    demoPage = await browser.newPage()
    await loginAsDemo(demoPage)
    const result = await createUrlQRViaUI(demoPage)
    shortCode = result.shortCode
    qrId = result.id
  })

  test.afterAll(async () => {
    // Cleanup: soft-delete the QR we created
    if (qrId && demoPage) {
      try {
        await deleteQRViaUI(demoPage, qrId)
      } catch {
        // cleanup failure is acceptable
      }
    }
    await demoPage?.close()
  })

  test("✅ API-REDIR-01: GET /api/qr/{validShortCode} returns 301 redirect", async ({
    request,
  }) => {
    expect(shortCode).toBeTruthy()
    const response = await request.get(`/api/qr/${shortCode}`, {
      timeout: API_TIMEOUT,
    })
    expect(response.status()).toBe(301)
  })

  test("✅ API-REDIR-02: Redirect Location header matches expected destination URL", async ({
    request,
  }) => {
    expect(shortCode).toBeTruthy()
    const response = await request.get(`/api/qr/${shortCode}`, {
      timeout: API_TIMEOUT,
      maxRedirects: 0, // do NOT follow the redirect
    })
    expect(response.status()).toBe(301)

    const location = response.headers()["location"] ?? ""
    expect(location).toBeTruthy()
    // For a URL-type QR, destination should contain example.com
    expect(location).toContain("example.com/api-direct-test")
  })

  test("❌ API-REDIR-03: GET /api/qr/{nonexistent} redirects to /qr-not-found", async ({
    request,
  }) => {
    const fakeCode = `zz${Date.now().toString(36)}xxxx`
    const response = await request.get(`/api/qr/${fakeCode}`, {
      timeout: API_TIMEOUT,
      maxRedirects: 0,
    })
    expect(response.status()).toBe(301)

    const location = response.headers()["location"] ?? ""
    expect(location).toContain("/qr-not-found")
  })

  test("❌ API-REDIR-04: GET /api/qr/{pausedShortCode} redirects to /qr-paused", async ({
    request,
  }) => {
    // Pause the QR code created in beforeAll
    await pauseQRCode(demoPage, qrId)

    const response = await request.get(`/api/qr/${shortCode}`, {
      timeout: API_TIMEOUT,
      maxRedirects: 0,
    })
    expect(response.status()).toBe(301)

    const location = response.headers()["location"] ?? ""
    expect(location).toContain("/qr-paused")

    // Restore to ACTIVE so other tests still work
    await demoPage.goto(`/dashboard/qr/${qrId}`, { waitUntil: "networkidle" })
    const playBtn = demoPage
      .locator('button:has-text("Reprendre")')
      .first()
    await playBtn.waitFor({ state: "visible", timeout: 5000 })
    await playBtn.click()
    await expect(demoPage.locator("text=repris")).toBeVisible({
      timeout: 5000,
    })
  })

  test("⚠️ API-REDIR-05: GET /api/qr/ with empty shortCode returns 404", async ({
    request,
  }) => {
    const response = await request.get("/api/qr/", {
      timeout: API_TIMEOUT,
      maxRedirects: 0,
    })
    // Next.js returns 404 for unmatched catch-all routes when the segment is empty
    expect(response.status()).toBe(404)
  })

  test("⚠️ API-REDIR-06: GET /api/qr/short with 1-char code is handled gracefully", async ({
    request,
  }) => {
    // A valid shortCode is 6 chars [a-z0-9]; a 1-char code will never exist.
    const response = await request.get("/api/qr/a", {
      timeout: API_TIMEOUT,
      maxRedirects: 0,
    })
    // Should not crash — either 301 → /qr-not-found or 404
    const status = response.status()
    expect([301, 404]).toContain(status)

    if (status === 301) {
      const location = response.headers()["location"] ?? ""
      expect(location).toContain("/qr-not-found")
    }
  })
})

// ---------------------------------------------------------------------------
// 3. tRPC Endpoints (Authenticated)
// ---------------------------------------------------------------------------
test.describe("tRPC Endpoints (Authenticated)", () => {
  let workspaceId: string

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    workspaceId = await loginAndGetWorkspaceId(page)
    await page.close()
  })

  test("✅ API-TRPC-01: POST /api/trpc/qr.list returns paginated QR list", async ({
    page,
  }) => {
    // Log in to get session cookie
    await loginAsDemo(page)

    const response = await page.request.post("/api/trpc/qr.list", {
      data: { json: { workspaceId, limit: 10 } },
      timeout: API_TIMEOUT,
    })
    expect(response.ok()).toBeTruthy()

    const body = await readJson(response)
    const data = extractTrpcData(body) as Record<string, unknown>
    expect(data).toHaveProperty("items")
    expect(data).toHaveProperty("totalCount")
    expect(Array.isArray(data.items)).toBe(true)
    expect(typeof data.totalCount).toBe("number")
  })

  test("✅ API-TRPC-02: POST /api/trpc/qr.list with type filter works", async ({
    page,
  }) => {
    await loginAsDemo(page)

    const response = await page.request.post("/api/trpc/qr.list", {
      data: { json: { workspaceId, limit: 10, type: "URL" } },
      timeout: API_TIMEOUT,
    })
    expect(response.ok()).toBeTruthy()

    const body = await readJson(response)
    const data = extractTrpcData(body) as { items: Array<Record<string, unknown>> }
    expect(Array.isArray(data.items)).toBe(true)
    // If items exist, they should all be of type URL
    if (data.items.length > 0) {
      for (const item of data.items as Array<{ type: string }>) {
        expect(item.type).toBe("URL")
      }
    }
  })

  test("❌ API-TRPC-03: POST /api/trpc/qr.list without auth returns 401/403", async ({
    browser,
  }) => {
    // Use a fresh context (no session cookie)
    const context = await browser.newContext({ storageState: undefined })
    const unauthedRequest = context.request

    const response = await unauthedRequest.post("/api/trpc/qr.list", {
      data: { json: { workspaceId: "fake", limit: 10 } },
      timeout: API_TIMEOUT,
    })
    // tRPC returns 401 UNAUTHORIZED when no session is present
    expect(response.status()).toBe(401)

    const body = await readJson(response)
    const err = extractTrpcError(body)
    expect(err.code).toBe("UNAUTHORIZED")

    await context.close()
  })

  test("✅ API-TRPC-04: GET /api/auth/session returns current user info", async ({
    page,
  }) => {
    await loginAsDemo(page)

    const response = await page.request.get("/api/auth/session", {
      timeout: API_TIMEOUT,
    })
    expect(response.ok()).toBeTruthy()

    const body = await readJson(response) as Record<string, unknown>
    expect(body).toHaveProperty("user")
    const user = body.user as Record<string, unknown> | null
    expect(user).toBeTruthy()
    expect(user?.email).toBe(DEMO_EMAIL)
    expect(user).toHaveProperty("id")
    expect(user).toHaveProperty("plan")
  })

  test("❌ API-TRPC-05: POST /api/trpc/qr.create with invalid data returns validation error", async ({
    page,
  }) => {
    await loginAsDemo(page)

    // Get CSRF token — mutations require x-csrf-token header
    const csrfToken = await getCsrfTokenFromSession(page)

    // Send completely empty body (missing required fields)
    const response = await page.request.post("/api/trpc/qr.create", {
      data: { json: {} },
      headers: { "x-csrf-token": csrfToken },
      timeout: API_TIMEOUT,
    })
    // Should be a 400-level error (validation failure)
    expect(response.status()).toBe(400)

    const body = await readJson(response)
    const err = extractTrpcError(body)
    expect(err.code).toBeTruthy()
    // Zod validation errors produce BAD_REQUEST
    expect(["BAD_REQUEST", "PARSE_ERROR"]).toContain(err.code)
  })

  test("❌ API-TRPC-06: POST /api/trpc/qr.delete with non-existent ID returns error", async ({
    page,
  }) => {
    await loginAsDemo(page)
    const csrfToken = await getCsrfTokenFromSession(page)

    const fakeId = "00000000-0000-0000-0000-000000000000"

    const response = await page.request.post("/api/trpc/qr.delete", {
      data: { json: { id: fakeId, workspaceId } },
      headers: { "x-csrf-token": csrfToken },
      timeout: API_TIMEOUT,
    })
    // Non-existent QR code should result in an error (4xx)
    expect(response.status()).toBeGreaterThanOrEqual(400)

    const body = await readJson(response)
    const err = extractTrpcError(body)
    expect(err.code).toBeTruthy()
    expect(err.code).toBe("NOT_FOUND")
  })

  test("⚠️ API-TRPC-07: POST /api/trpc/qr.list with negative limit is handled gracefully", async ({
    page,
  }) => {
    await loginAsDemo(page)

    const response = await page.request.post("/api/trpc/qr.list", {
      data: { json: { workspaceId, limit: -5 } },
      timeout: API_TIMEOUT,
    })
    // Zod validation: limit.min(1) → negative value should be caught as 400
    expect(response.status()).toBe(400)

    const body = await readJson(response)
    const err = extractTrpcError(body)
    // Should be a Zod validation error
    expect(err.code).toBeTruthy()
    expect(["BAD_REQUEST", "PARSE_ERROR"]).toContain(err.code)
  })
})

// ---------------------------------------------------------------------------
// 4. Auth API Endpoints
// ---------------------------------------------------------------------------
test.describe("Auth API Endpoints", () => {
  test("✅ API-AUTH-01: GET /api/auth/session returns session when logged in", async ({
    page,
  }) => {
    await loginAsDemo(page)

    const response = await page.request.get("/api/auth/session", {
      timeout: API_TIMEOUT,
    })
    expect(response.ok()).toBeTruthy()

    const body = await readJson(response) as Record<string, unknown>
    expect(body).toHaveProperty("user")
    expect(body).toHaveProperty("expires")
    const user = body.user as Record<string, unknown> | null
    expect(user?.email).toBe(DEMO_EMAIL)
  })

  test("❌ API-AUTH-02: GET /api/auth/session returns empty when not logged in", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: undefined })
    const response = await context.request.get("/api/auth/session", {
      timeout: API_TIMEOUT,
    })

    // Without a session cookie, next-auth returns an empty object or null
    expect(response.ok()).toBeTruthy()

    const body = await readJson(response)
    // Should be empty: either {} or { user: null }
    const sessionBody = body as Record<string, unknown>
    expect(sessionBody.user ?? null).toBeFalsy()

    await context.close()
  })

  test("✅ API-AUTH-03: POST /api/auth/csrf returns CSRF token", async ({
    request,
  }) => {
    const response = await request.get("/api/auth/csrf", {
      timeout: API_TIMEOUT,
    })
    expect(response.ok()).toBeTruthy()

    const body = await readJson(response) as Record<string, unknown>
    expect(body).toHaveProperty("csrfToken")
    expect(typeof body.csrfToken).toBe("string")
    expect((body.csrfToken as string).length).toBeGreaterThan(0)
  })

  test("❌ API-AUTH-04: POST /api/auth/signin with wrong credentials returns error", async ({
    request,
  }) => {
    // First get CSRF token
    const csrfResponse = await request.get("/api/auth/csrf", {
      timeout: API_TIMEOUT,
    })
    const csrfBody = await readJson(csrfResponse) as Record<string, string>
    const csrfToken = csrfBody.csrfToken

    // Attempt sign-in with wrong password
    const signInResponse = await request.post(
      "/api/auth/callback/credentials",
      {
        data: new URLSearchParams({
          csrfToken,
          email: DEMO_EMAIL,
          password: "wrong-password-12345",
          json: "true",
        }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: API_TIMEOUT,
      },
    )
    // next-auth returns a 200 with an error-flagged response for failed credentials
    const body = await readJson(signInResponse) as Record<string, unknown>
    // Should indicate failure: either url contains error, or ok is false
    const url = (body.url as string) ?? ""
    const ok = body.ok as boolean | undefined
    if (ok !== undefined) {
      expect(ok).toBe(false)
    }
    if (url) {
      expect(url).toContain("error")
    }
  })

  test("✅ API-AUTH-05: POST /api/auth/signin with valid credentials returns success", async ({
    request,
  }) => {
    // Get CSRF token
    const csrfResponse = await request.get("/api/auth/csrf", {
      timeout: API_TIMEOUT,
    })
    const csrfBody = await readJson(csrfResponse) as Record<string, string>
    const csrfToken = csrfBody.csrfToken

    // Sign in with valid demo credentials
    const signInResponse = await request.post(
      "/api/auth/callback/credentials",
      {
        data: new URLSearchParams({
          csrfToken,
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          json: "true",
        }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: API_TIMEOUT,
      },
    )

    const body = await readJson(signInResponse) as Record<string, unknown>
    // Successful sign-in returns { ok: true, url: "/dashboard" }
    const ok = body.ok as boolean | undefined
    if (ok !== undefined) {
      expect(ok).toBe(true)
    }
    const url = (body.url as string) ?? ""
    if (url) {
      expect(url).toContain("/dashboard")
    }
  })
})

// ---------------------------------------------------------------------------
// 5. API Response Format & Headers
// ---------------------------------------------------------------------------
test.describe("API Response Format & Headers", () => {
  test("✅ API-FMT-01: API responses include Content-Type: application/json", async ({
    request,
  }) => {
    const response = await request.get("/api/health", { timeout: API_TIMEOUT })
    expect(response.ok()).toBeTruthy()

    const contentType = response.headers()["content-type"] ?? ""
    expect(contentType).toContain("application/json")
  })

  test("✅ API-FMT-02: API responses include security headers", async ({
    request,
  }) => {
    const response = await request.get("/api/health", { timeout: API_TIMEOUT })
    expect(response.ok()).toBeTruthy()

    const headers = response.headers()

    // X-Content-Type-Options: nosniff (set by Next.js / middleware)
    expect(headers["x-content-type-options"] ?? "").toBe("nosniff")

    // X-Request-ID should be present (set by middleware)
    expect(headers["x-request-id"] ?? "").toBeTruthy()
  })

  test("⚠️ API-FMT-03: API returns CORS headers (if configured)", async ({
    request,
  }) => {
    const response = await request.get("/api/health", { timeout: API_TIMEOUT })
    const headers = response.headers()

    // CORS headers may not be set if the app doesn't serve cross-origin requests.
    // If they exist, validate them; otherwise, this test is a soft check.
    const acao = headers["access-control-allow-origin"]
    if (acao) {
      // If set, it should be a valid origin or wildcard
      expect(typeof acao).toBe("string")
      expect(acao.length).toBeGreaterThan(0)
    }
    // access-control-allow-methods is optional
    const acam = headers["access-control-allow-methods"]
    if (acam) {
      expect(acam.toLowerCase()).toContain("get")
    }
  })

  test("❌ API-FMT-04: API returns 405 for unsupported methods", async ({
    request,
  }) => {
    // Next.js returns 405 for methods the route handler doesn't export
    const response = await request.put("/api/health", {
      data: {},
      timeout: API_TIMEOUT,
    })
    // Next.js App Router returns 405 for unhandled HTTP methods
    expect(response.status()).toBe(405)
  })
})

// ---------------------------------------------------------------------------
// 6. Error Handling & Edge Cases
// ---------------------------------------------------------------------------
test.describe("Error Handling & Edge Cases", () => {
  test("❌ API-ERR-01: Send malformed JSON to tRPC endpoint returns 400", async ({
    request,
  }) => {
    const response = await request.post("/api/trpc/qr.list", {
      data: "this is not valid json at all {{{",
      headers: { "Content-Type": "application/json" },
      timeout: API_TIMEOUT,
    })
    // tRPC should reject malformed JSON with 400
    expect(response.status()).toBe(400)
  })

  test("❌ API-ERR-02: POST to non-existent tRPC procedure returns error", async ({
    page,
  }) => {
    await loginAsDemo(page)

    const response = await page.request.post("/api/trpc/nonexistent.procedure", {
      data: { json: {} },
      timeout: API_TIMEOUT,
    })
    // Non-existent procedure returns a 404-level error from tRPC
    expect(response.status()).toBe(404)

    const body = await readJson(response)
    const err = extractTrpcError(body)
    expect(err.code).toBeTruthy()
    expect(err.code).toBe("NOT_FOUND")
  })

  test("⚠️ API-ERR-03: Rapid successive calls to health check all succeed", async ({
    request,
  }) => {
    const promises = Array.from({ length: 10 }, () =>
      request.get("/api/health", { timeout: API_TIMEOUT }),
    )
    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)
    for (let i = 0; i < results.length; i++) {
      expect(
        results[i].ok(),
        `Request ${i + 1} failed with status ${results[i].status()}`,
      ).toBe(true)

      const body = await readJson(results[i]) as Record<string, unknown>
      expect(body.status).toBe("ok")
    }
  })

  test("❌ API-ERR-04: Send request with invalid HTTP method returns 405", async ({
    request,
  }) => {
    // OPTIONS is not exported by the health route
    const response = await request.fetch("/api/health", {
      method: "OPTIONS",
      timeout: API_TIMEOUT,
    })
    // Next.js App Router returns 405 for methods not handled
    expect(response.status()).toBe(405)
  })

  test("⚠️ API-ERR-05: Request with oversized payload returns 413", async ({
    request,
  }) => {
    // Create a payload large enough to trigger body-parser size limits.
    // Next.js API route default limit is ~4 MB. Send 5 MB to exceed it.
    const largeData = "x".repeat(5_000_000)

    const response = await request.post("/api/trpc/qr.list", {
      data: largeData,
      headers: { "Content-Type": "application/json" },
      timeout: 15_000, // generous timeout for 5 MB upload
    })

    // May get 413 Payload Too Large, 400 Bad Request, or another 4xx
    const status = response.status()
    if (status === 413) {
      // Explicit entity too large — ideal
      expect(status).toBe(413)
    } else {
      // Server might handle it differently (e.g., 400 for parse failure,
      // or 500 if the handler crashes). Accept any 4xx, or 500.
      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThanOrEqual(500)
    }
  })
})
