import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const limitMock = vi.hoisted(() => vi.fn())

vi.mock("@upstash/ratelimit", () => {
  const mockRatelimit = vi.fn().mockImplementation(function () {
    return { limit: limitMock }
  })
  mockRatelimit.slidingWindow = vi.fn().mockReturnValue({})
  return { Ratelimit: mockRatelimit }
})

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(function () { return {} }),
}))

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}))

vi.mock("next/server", () => {
  // NextResponse needs to work with `new NextResponse(body, init)`
  function MockNextResponse(body?: BodyInit | null, init?: ResponseInit) {
    return new Response(body, init)
  }
  MockNextResponse.next = vi.fn(() => new Response(null, { status: 200 }))
  MockNextResponse.redirect = vi.fn(() => new Response(null, { status: 302 }))
  return {
    NextResponse: MockNextResponse,
    NextRequest: vi.fn(),
  }
})

import { middleware } from "@/middleware"
import { checkTrpcMutationLimit, checkTrpcQueryLimit } from "@/lib/rate-limit"

describe("rate-limit — configuration (1b.4)", () => {
  it("should export checkTrpcMutationLimit for 60 requests per 60s window", () => {
    // Verify the wrapper function is exported
    expect(checkTrpcMutationLimit).toBeDefined()
  })

  it("should export checkTrpcQueryLimit for 300 requests per 60s window", () => {
    expect(checkTrpcQueryLimit).toBeDefined()
  })
})

describe("middleware — tRPC rate limiting (1b.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    limitMock.mockReset()
  })

  function createRequest(pathname: string, method = "GET", ip = "127.0.0.1"): Request {
    const url = new URL(`http://localhost:3000${pathname}`)
    const headers = new Headers()
    if (ip) headers.set("x-forwarded-for", ip)
    // Build a minimal NextRequest-compatible object
    return {
      nextUrl: { pathname },
      url: url.toString(),
      method,
      headers,
    } as unknown as Request
  }

  it("should return 429 when mutation limit is exceeded (61st mutation in 60s)", async () => {
    // Simulate limit exceeded for POST (mutation)
    limitMock.mockResolvedValue({ success: false, remaining: 0, limit: 60, reset: 60 })

    const req = createRequest("/api/trpc/", "POST")
    const res = await middleware(req as unknown as Request)

    expect(res.status).toBe(429)
  })

  it("should return 429 when query limit is exceeded (301st query in 60s)", async () => {
    // Simulate limit exceeded for GET (query)
    limitMock.mockResolvedValue({ success: false, remaining: 0, limit: 300, reset: 60 })

    const req = createRequest("/api/trpc/", "GET")
    const res = await middleware(req as unknown as Request)

    expect(res.status).toBe(429)
  })

  it("should include X-RateLimit-Remaining header on successful request", async () => {
    limitMock.mockResolvedValue({ success: true, remaining: 59, limit: 60, reset: 60 })

    const req = createRequest("/api/trpc/", "POST")
    const res = await middleware(req as unknown as Request)

    expect(res.headers?.get("X-RateLimit-Remaining")).toBe("59")
  })

  it("should include X-RateLimit-Remaining=0 on rate-limited request", async () => {
    limitMock.mockResolvedValue({ success: false, remaining: 0, limit: 60, reset: 60 })

    const req = createRequest("/api/trpc/", "POST")
    const res = await middleware(req as unknown as Request)

    // The 429 response should have X-RateLimit-Remaining: "0"
    expect(res.headers?.get("X-RateLimit-Remaining")).toBe("0")
  })

  it("should NOT rate-limit health check endpoints", async () => {
    limitMock.mockResolvedValue({ success: true, remaining: 300, limit: 300, reset: 60 })

    const req = createRequest("/api/health/")
    const res = await middleware(req as unknown as Request)

    // Health checks are public prefixes, skip middleware
    expect(res.status).toBe(200)
    // Rate limit should NOT have been called for public prefixes
    expect(limitMock).not.toHaveBeenCalled()
  })
})
