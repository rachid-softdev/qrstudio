import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { withRetry, RetryError } from "@/lib/retry"

describe("withRetry — Prisma Query Timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Queries that exceed timeout throw an error ───────────────────────────

  it("should throw RetryError when a query exceeds the timeout", async () => {
    vi.useRealTimers()

    // Simulate a query that never completes (hangs indefinitely)
    const slowQuery = vi.fn().mockImplementation(
      () => new Promise((_resolve) => {
        /* never resolves */
      }),
    )

    await expect(
      withRetry(slowQuery, {
        maxRetries: 1,
        baseDelay: 10,
        timeout: 50,
      }),
    ).rejects.toThrow(RetryError)
  }, 5000)

  it("should throw timeout error message when timeout is hit", async () => {
    vi.useRealTimers() // Use real timers for this test

    const slowQuery = vi.fn().mockImplementation(
      () => new Promise((_resolve) => {
        // Never resolves
      }),
    )

    const promise = withRetry(slowQuery, {
      maxRetries: 1,
      baseDelay: 10,
      timeout: 50,
    })

    await expect(promise).rejects.toThrow(RetryError)
    // The underlying cause should mention timeout
    const retryError = await promise.catch((e: unknown) => e) as RetryError
    expect(retryError.cause?.message).toMatch(/expir(e|ée)/i)
  }, 5000)

  // ─── Normal queries still work ────────────────────────────────────────────

  it("should return the result of a normal query that completes in time", async () => {
    const fastQuery = vi.fn().mockResolvedValue({ id: "user-1", name: "Test" })

    const result = await withRetry(fastQuery, {
      maxRetries: 2,
      timeout: 5000,
    })

    expect(result).toEqual({ id: "user-1", name: "Test" })
    expect(fastQuery).toHaveBeenCalledTimes(1)
  })

  it("should succeed on retry if first attempt times out but second succeeds", async () => {
    vi.useRealTimers()

    const query = vi.fn()
      .mockRejectedValueOnce(new Error("Operation timed out"))
      .mockResolvedValueOnce({ id: "user-1" })

    const result = await withRetry(query, {
      maxRetries: 2,
      baseDelay: 10,
      timeout: 5000,
    })

    expect(result).toEqual({ id: "user-1" })
    expect(query).toHaveBeenCalledTimes(2)
  }, 10000)

  it("should stop retrying if shouldRetry returns false", async () => {
    const query = vi.fn().mockRejectedValue(new Error("Fatal error"))

    await expect(
      withRetry(query, {
        maxRetries: 3,
        baseDelay: 10,
        timeout: 5000,
        shouldRetry: (err) => err.message !== "Fatal error",
      }),
    ).rejects.toThrow(RetryError)

    expect(query).toHaveBeenCalledTimes(1)
  })

  it("should work without a timeout configured (no timeout)", async () => {
    const query = vi.fn().mockResolvedValue("ok")

    const result = await withRetry(query, {
      maxRetries: 2,
      baseDelay: 10,
    })

    expect(result).toBe("ok")
    expect(query).toHaveBeenCalledTimes(1)
  })

  // ─── Timeout configuration is applied ─────────────────────────────────────

  it("should use the configured timeout value", async () => {
    vi.useRealTimers()

    const slowQuery = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("data"), 200)),
    )

    // Timeout of 50ms should fail since query takes 200ms
    await expect(
      withRetry(slowQuery, {
        maxRetries: 1,
        baseDelay: 10,
        timeout: 50,
      }),
    ).rejects.toThrow(RetryError)
  }, 5000)

  it("should succeed with a generous timeout", async () => {
    vi.useRealTimers()

    const moderateQuery = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("data"), 50)),
    )

    const result = await withRetry(moderateQuery, {
      maxRetries: 1,
      baseDelay: 10,
      timeout: 500,
    })

    expect(result).toBe("data")
  }, 5000)

  it("should propagate the cause error from timeout in RetryError", async () => {
    vi.useRealTimers()

    const badQuery = vi.fn().mockImplementation(
      () => new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("DB connection failed")), 10),
      ),
    )

    try {
      await withRetry(badQuery, {
        maxRetries: 1,
        baseDelay: 10,
        timeout: 5000,
      })
      expect.fail("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(RetryError)
      expect((err as RetryError).cause?.message).toBe("DB connection failed")
      expect((err as RetryError).attempts).toBe(1)
    }
  }, 5000)
})
