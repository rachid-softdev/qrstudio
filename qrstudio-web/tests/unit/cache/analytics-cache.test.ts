import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPipeline = vi.hoisted(() => ({
  del: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([1, 1, 1, 1]),
}))

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  setex: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  pipeline: vi.fn(() => mockPipeline),
}))

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(function() { return mockRedis }),
}))

import {
  readWithCache,
  invalidateAnalyticsCache,
  invalidateDashboardCache,
  analyticsCacheKey,
  dashboardCacheKey,
  ANALYTICS_TTL,
  DASHBOARD_TTL,
} from "@/server/cache/analytics-cache"

describe("analytics-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("readWithCache", () => {
    it("should return cached value when cache hit", async () => {
      const expected = { totalScans: 10, scansByDay: [] }
      mockRedis.get.mockResolvedValue(expected)

      const result = await readWithCache("test-key", 60, async () => ({ totalScans: 0, scansByDay: [] }))

      expect(result).toEqual(expected)
      expect(mockRedis.get).toHaveBeenCalledWith("test-key")
      // Compute should NOT be called on cache hit
    })

    it("should call compute on cache miss and write to cache", async () => {
      mockRedis.get.mockResolvedValue(null) // cache miss
      const computeFn = vi.fn().mockResolvedValue({ totalScans: 5 })

      const result = await readWithCache("test-key", 60, computeFn)

      expect(result).toEqual({ totalScans: 5 })
      expect(computeFn).toHaveBeenCalledOnce()
      expect(mockRedis.setex).toHaveBeenCalledWith("test-key", 60, JSON.stringify({ totalScans: 5 }))
    })

    it("should handle compute failure gracefully (propagate error)", async () => {
      mockRedis.get.mockResolvedValue(null) // cache miss
      const computeFn = vi.fn().mockRejectedValue(new Error("Compute failed"))

      await expect(readWithCache("test-key", 60, computeFn)).rejects.toThrow("Compute failed")
      // Should not write to cache on compute failure
      expect(mockRedis.setex).not.toHaveBeenCalled()
    })
  })

  describe("invalidateAnalyticsCache", () => {
    it("should delete all period keys for a QR code", async () => {
      await invalidateAnalyticsCache("qr-1")

      expect(mockRedis.pipeline).toHaveBeenCalledOnce()
      const pipeline = mockRedis.pipeline()
      expect(pipeline.del).toHaveBeenCalledTimes(4)
      expect(pipeline.del).toHaveBeenCalledWith("analytics:qr-1:7d")
      expect(pipeline.del).toHaveBeenCalledWith("analytics:qr-1:30d")
      expect(pipeline.del).toHaveBeenCalledWith("analytics:qr-1:90d")
      expect(pipeline.del).toHaveBeenCalledWith("analytics:qr-1:all")
      expect(pipeline.exec).toHaveBeenCalledOnce()
    })
  })

  describe("invalidateDashboardCache", () => {
    it("should delete dashboard key for workspace", async () => {
      await invalidateDashboardCache("ws-1")

      expect(mockRedis.del).toHaveBeenCalledWith("dashboard:ws-1")
    })
  })

  describe("key helpers", () => {
    it("analyticsCacheKey should return formatted key", () => {
      expect(analyticsCacheKey("qr-1", "7d")).toBe("analytics:qr-1:7d")
      expect(analyticsCacheKey("qr-2", "all")).toBe("analytics:qr-2:all")
    })

    it("dashboardCacheKey should return formatted key", () => {
      expect(dashboardCacheKey("ws-1")).toBe("dashboard:ws-1")
    })
  })

  describe("constants", () => {
    it("ANALYTICS_TTL should be 60 seconds", () => {
      expect(ANALYTICS_TTL).toBe(60)
    })

    it("DASHBOARD_TTL should be 30 seconds", () => {
      expect(DASHBOARD_TTL).toBe(30)
    })
  })
})
