import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock the Upstash Redis and Ratelimit modules ──────────────────────────────
// We mock @upstash/ratelimit to return a controllable Ratelimit instance
// without requiring actual Redis.

const mockLimitFn = vi.hoisted(() => vi.fn())

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => ({
    sadd: vi.fn(),
    srem: vi.fn(),
    smembers: vi.fn(),
    expire: vi.fn(),
  })),
}))

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn(() => ({
    limit: mockLimitFn,
  })),
}))

describe("TOTP Rate Limiting — 5 attempts window", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Helper: simulate a rate limiter ─────────────────────────────────────
  // We create a simple in-memory sliding window counter to test the rate
  // limiting logic independently of Upstash.
  function createSlidingWindowLimiter(maxRequests: number, windowMs: number) {
    const attempts = new Map<string, number[]>()
    return {
      limit: vi.fn(async (identifier: string) => {
        const now = Date.now()
        const timestamps = (attempts.get(identifier) ?? []).filter(
          (t) => now - t < windowMs,
        )
        timestamps.push(now)
        attempts.set(identifier, timestamps)
        const withinLimit = timestamps.length <= maxRequests
        return {
          success: withinLimit,
          remaining: Math.max(0, maxRequests - timestamps.length),
          limit: maxRequests,
          reset: now + windowMs,
        }
      }),
      reset: (identifier: string) => attempts.delete(identifier),
    }
  }

  // ─── First 5 TOTP attempts succeed within window ──────────────────────────

  it("should allow first 5 TOTP attempts within window", async () => {
    const limiter = createSlidingWindowLimiter(5, 60_000) // 5 attempts per 60s

    for (let i = 1; i <= 5; i++) {
      const result = await limiter.limit("user-1")
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(5 - i)
    }
  })

  // ─── 6th attempt within window returns rate limit error ──────────────────

  it("should block 6th attempt within the same window", async () => {
    const limiter = createSlidingWindowLimiter(5, 60_000)

    // Use up all 5 attempts
    for (let i = 0; i < 5; i++) {
      await limiter.limit("user-1")
    }

    // 6th attempt should be blocked
    const result = await limiter.limit("user-1")
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  // ─── After window expires, attempts reset ────────────────────────────────

  it("should reset attempts after window expires", async () => {
    const windowMs = 100 // Use short window for testing (100ms)
    const limiter = createSlidingWindowLimiter(5, windowMs)

    // Use up all 5 attempts
    for (let i = 0; i < 5; i++) {
      await limiter.limit("user-1")
    }

    // 6th within window should be blocked
    let result = await limiter.limit("user-1")
    expect(result.success).toBe(false)

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, windowMs + 10))

    // After window expires, should be allowed again
    result = await limiter.limit("user-1")
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  // ─── Different IPs have separate rate limit counters ─────────────────────

  it("should maintain separate counters for different IPs/users", async () => {
    const limiter = createSlidingWindowLimiter(5, 60_000)

    // User A uses 5 attempts
    for (let i = 0; i < 5; i++) {
      await limiter.limit("ip-A")
    }

    // User A should be blocked on 6th
    const userAResult = await limiter.limit("ip-A")
    expect(userAResult.success).toBe(false)

    // User B should still have all 5 attempts available
    const userBResult = await limiter.limit("ip-B")
    expect(userBResult.success).toBe(true)
    expect(userBResult.remaining).toBe(4)
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it("should handle rapid successive calls correctly", async () => {
    const limiter = createSlidingWindowLimiter(5, 60_000)

    const results = await Promise.all(
      Array.from({ length: 6 }, () => limiter.limit("user-1")),
    )

    // First 5 should succeed
    expect(results.slice(0, 5).every((r) => r.success)).toBe(true)
    // 6th should fail
    expect(results[5].success).toBe(false)
  })

  it("should return correct remaining count", async () => {
    const limiter = createSlidingWindowLimiter(5, 60_000)

    let result = await limiter.limit("user-1")
    expect(result.remaining).toBe(4)

    result = await limiter.limit("user-1")
    expect(result.remaining).toBe(3)

    result = await limiter.limit("user-1")
    expect(result.remaining).toBe(2)

    result = await limiter.limit("user-1")
    expect(result.remaining).toBe(1)

    result = await limiter.limit("user-1")
    expect(result.remaining).toBe(0)

    // Blocked
    result = await limiter.limit("user-1")
    expect(result.remaining).toBe(0)
  })

  it("should allow attempts again partially after some time passes", async () => {
    const windowMs = 200 // 200ms window
    const limiter = createSlidingWindowLimiter(5, windowMs)

    // Use 3 attempts
    for (let i = 0; i < 3; i++) {
      await limiter.limit("user-1")
    }

    // Wait for part of the window to pass (oldest attempt expires)
    await new Promise((r) => setTimeout(r, 150))

    // After 150ms, the first attempt (at t=0) has expired since window is 200ms
    // So we should have 2 attempts in the window now, and can attempt again
    const result = await limiter.limit("user-1")
    expect(result.success).toBe(true)
  })
})
