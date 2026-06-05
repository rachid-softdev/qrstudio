import { describe, it, expect, vi, beforeEach } from "vitest"
import { withRetry, RetryError } from "@/lib/retry"

describe("withRetry", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  describe("success cases", () => {
    it("should return result on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success")
      const result = await withRetry(fn)
      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should succeed after retries", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("temp failure"))
        .mockRejectedValueOnce(new Error("temp failure 2"))
        .mockResolvedValue("recovered")

      const result = await withRetry(fn, { maxRetries: 5, baseDelay: 10 })
      expect(result).toBe("recovered")
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe("retry on failure", () => {
    it("should retry and eventually throw when all attempts fail", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("persistent failure"))

      await expect(withRetry(fn, { maxRetries: 3, baseDelay: 5 })).rejects.toThrow(RetryError)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it("should throw RetryError with attempt count", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"))

      try {
        await withRetry(fn, { maxRetries: 2, baseDelay: 5 })
        expect.unreachable()
      } catch (error) {
        expect(error).toBeInstanceOf(RetryError)
        expect((error as RetryError).attempts).toBe(2)
        expect((error as RetryError).cause?.message).toBe("fail")
      }
    })

    it("should throw original error when shouldRetry returns false", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("non-retryable"))

      await expect(
        withRetry(fn, {
          maxRetries: 5,
          baseDelay: 5,
          shouldRetry: (err) => err.message !== "non-retryable",
        })
      ).rejects.toThrow(RetryError)

      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("timeout", () => {
    it("should throw if operation exceeds timeout", async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      )

      await expect(
        withRetry(fn, { timeout: 50, maxRetries: 1, baseDelay: 5 })
      ).rejects.toThrow(RetryError)
    })
  })

  describe("shouldRetry filter", () => {
    it("should retry only for specific errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("retryable"))
        .mockResolvedValue("ok")

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 5,
        shouldRetry: (err) => err.message === "retryable",
      })

      expect(result).toBe("ok")
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("should not retry when shouldRetry returns false", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fatal"))

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          baseDelay: 5,
          shouldRetry: () => false,
        })
      ).rejects.toThrow(RetryError)

      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("default options", () => {
    it("should default maxRetries to 3", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"))

      await expect(withRetry(fn, { baseDelay: 5 })).rejects.toThrow(RetryError)
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })
})
