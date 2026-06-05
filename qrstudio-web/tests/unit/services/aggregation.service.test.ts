import { describe, it, expect, vi, beforeEach } from "vitest"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "upsert", "delete", "deleteMany", "count", "groupBy"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) {
      m[method] = vi.fn()
    }
    return m
  }
  const m = {
    scanDaily: model(),
    aggregationWatermark: model(),
    scan: model(["findUnique", "findFirst", "findMany", "create", "update", "count", "groupBy"]),
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  }
  return m
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/server/cache/analytics-cache", () => ({
  invalidateAnalyticsCache: vi.fn().mockResolvedValue(undefined),
}))

import { aggregationService } from "@/server/services/aggregation.service"

describe("aggregationService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("aggregateNextBatch", () => {
    it("should return 0 when watermark is at current time (buffer)", async () => {
      const now = new Date()
      prismaMock.aggregationWatermark.findUnique.mockResolvedValue({
        queueName: "aggregate-scans",
        lastProcessedAt: new Date(now.getTime() - 30_000), // 30s ago, within buffer
      } as never)

      const result = await aggregationService.aggregateNextBatch()

      expect(result).toBe(0)
      expect(prismaMock.$executeRawUnsafe).not.toHaveBeenCalled()
    })

    it("should return 0 when watermark is ahead of buffer", async () => {
      const now = new Date()
      prismaMock.aggregationWatermark.findUnique.mockResolvedValue({
        queueName: "aggregate-scans",
        lastProcessedAt: new Date(now.getTime() + 1000), // future
      } as never)

      const result = await aggregationService.aggregateNextBatch()

      expect(result).toBe(0)
    })

    it("should process new Scan rows and upsert into ScanDaily", async () => {
      prismaMock.aggregationWatermark.findUnique.mockResolvedValue({
        queueName: "aggregate-scans",
        lastProcessedAt: new Date("2024-01-01T00:00:00Z"),
      } as never)
      prismaMock.$executeRawUnsafe.mockResolvedValue(5)
      prismaMock.aggregationWatermark.upsert.mockResolvedValue({} as never)
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { qrCodeId: "qr-1" },
        { qrCodeId: "qr-2" },
      ])

      const result = await aggregationService.aggregateNextBatch()

      expect(result).toBe(5)
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledOnce()
      expect(prismaMock.aggregationWatermark.upsert).toHaveBeenCalledOnce()
      expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledOnce()
    })

    it("should update watermark after processing", async () => {
      prismaMock.aggregationWatermark.findUnique.mockResolvedValue({
        queueName: "aggregate-scans",
        lastProcessedAt: new Date("2024-01-01T00:00:00Z"),
      } as never)
      prismaMock.$executeRawUnsafe.mockResolvedValue(3)
      prismaMock.aggregationWatermark.upsert.mockResolvedValue({} as never)
      prismaMock.$queryRawUnsafe.mockResolvedValue([])

      await aggregationService.aggregateNextBatch()

      expect(prismaMock.aggregationWatermark.upsert).toHaveBeenCalledWith({
        where: { queueName: "aggregate-scans" },
        create: expect.objectContaining({ queueName: "aggregate-scans" }),
        update: expect.objectContaining({ lastProcessedAt: expect.any(Date) }),
      })
    })

    it("should invalidate cache for affected QR codes", async () => {
      const { invalidateAnalyticsCache } = await import("@/server/cache/analytics-cache")

      prismaMock.aggregationWatermark.findUnique.mockResolvedValue({
        queueName: "aggregate-scans",
        lastProcessedAt: new Date("2024-01-01T00:00:00Z"),
      } as never)
      prismaMock.$executeRawUnsafe.mockResolvedValue(10)
      prismaMock.aggregationWatermark.upsert.mockResolvedValue({} as never)
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { qrCodeId: "qr-1" },
        { qrCodeId: "qr-2" },
        { qrCodeId: "qr-3" },
      ])

      await aggregationService.aggregateNextBatch()

      expect(invalidateAnalyticsCache).toHaveBeenCalledTimes(3)
      expect(invalidateAnalyticsCache).toHaveBeenCalledWith("qr-1")
      expect(invalidateAnalyticsCache).toHaveBeenCalledWith("qr-2")
      expect(invalidateAnalyticsCache).toHaveBeenCalledWith("qr-3")
    })

    it("should handle empty Scan table gracefully", async () => {
      prismaMock.aggregationWatermark.findUnique.mockResolvedValue({
        queueName: "aggregate-scans",
        lastProcessedAt: new Date("2024-01-01T00:00:00Z"),
      } as never)
      prismaMock.$executeRawUnsafe.mockResolvedValue(0)
      prismaMock.aggregationWatermark.upsert.mockResolvedValue({} as never)
      prismaMock.$queryRawUnsafe.mockResolvedValue([])

      const result = await aggregationService.aggregateNextBatch()

      expect(result).toBe(0)
      // Watermark should still be updated
      expect(prismaMock.aggregationWatermark.upsert).toHaveBeenCalled()
    })

    it("should handle watermark being null (first run)", async () => {
      prismaMock.aggregationWatermark.findUnique.mockResolvedValue(null)
      prismaMock.$executeRawUnsafe.mockResolvedValue(0)
      prismaMock.aggregationWatermark.upsert.mockResolvedValue({} as never)
      prismaMock.$queryRawUnsafe.mockResolvedValue([])

      const result = await aggregationService.aggregateNextBatch()

      // Should process using epoch as start
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalled()
      expect(result).toBe(0)
    })
  })

  describe("backfillAll", () => {
    it("should process all Scan rows in batches", async () => {
      const batch1 = Array.from({ length: 2 }, (_, i) => ({
        id: `scan-${i}`,
        qrCodeId: "qr-1",
        scannedAt: new Date("2024-01-15T10:00:00Z"),
        ipHash: `ip${i}`,
        country: "France",
        deviceType: "mobile",
        os: "iOS",
        browser: "Safari",
      }))
      const batch2 = Array.from({ length: 1 }, (_, i) => ({
        id: `scan-${i + 2}`,
        qrCodeId: "qr-2",
        scannedAt: new Date("2024-01-16T10:00:00Z"),
        ipHash: `ip${i + 2}`,
        country: "Germany",
        deviceType: "desktop",
        os: "Windows",
        browser: "Chrome",
      }))

      prismaMock.scanDaily.deleteMany.mockResolvedValue({ count: 0 } as never)
      prismaMock.aggregationWatermark.deleteMany.mockResolvedValue({ count: 0 } as never)
      prismaMock.scan.findMany
        .mockResolvedValueOnce(batch1 as never)
        .mockResolvedValueOnce(batch2 as never)
        .mockResolvedValueOnce([] as never) // signal end
      prismaMock.scanDaily.upsert.mockResolvedValue({} as never)
      prismaMock.aggregationWatermark.upsert.mockResolvedValue({} as never)

      const result = await aggregationService.backfillAll()

      expect(result.processed).toBe(3)
      expect(prismaMock.scanDaily.deleteMany).toHaveBeenCalledOnce()
      expect(prismaMock.aggregationWatermark.deleteMany).toHaveBeenCalledOnce()
      expect(prismaMock.scanDaily.upsert).toHaveBeenCalledTimes(2) // 2 groups (qr-1 + qr-2)
      expect(prismaMock.aggregationWatermark.upsert).toHaveBeenCalledOnce()
    })

    it("should handle empty Scan table", async () => {
      prismaMock.scanDaily.deleteMany.mockResolvedValue({ count: 0 } as never)
      prismaMock.aggregationWatermark.deleteMany.mockResolvedValue({ count: 0 } as never)
      prismaMock.scan.findMany.mockResolvedValue([] as never)
      prismaMock.aggregationWatermark.upsert.mockResolvedValue({} as never)

      const result = await aggregationService.backfillAll()

      expect(result.processed).toBe(0)
      expect(prismaMock.scan.findMany).toHaveBeenCalledOnce()
      expect(prismaMock.aggregationWatermark.upsert).toHaveBeenCalledOnce()
    })
  })

  describe("getAffectedQrCodes", () => {
    it("should return distinct QR code IDs in the time range", async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { qrCodeId: "qr-1" },
        { qrCodeId: "qr-2" },
        { qrCodeId: "qr-1" }, // duplicate should not happen in DISTINCT SQL, but test the mapping
      ])

      const result = await aggregationService.getAffectedQrCodes(
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      )

      expect(result).toHaveLength(3) // we map all returned rows
      expect(result).toContain("qr-1")
      expect(result).toContain("qr-2")
      expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("SELECT DISTINCT"),
        expect.any(Date),
        expect.any(Date),
      )
    })

    it("should return empty array when no scans in range", async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([])

      const result = await aggregationService.getAffectedQrCodes(
        new Date("2024-01-01"),
        new Date("2024-01-02"),
      )

      expect(result).toEqual([])
    })
  })

  describe("_groupBatchForUpsert", () => {
    it("should group scans by qrCodeId and date", () => {
      const batch = [
        { qrCodeId: "qr-1", scannedAt: new Date("2024-01-15T10:00:00Z"), ipHash: "ip1", country: "France", deviceType: "mobile", os: "iOS", browser: "Safari" },
        { qrCodeId: "qr-1", scannedAt: new Date("2024-01-15T11:00:00Z"), ipHash: "ip2", country: "France", deviceType: "mobile", os: "iOS", browser: "Safari" },
        { qrCodeId: "qr-2", scannedAt: new Date("2024-01-15T10:00:00Z"), ipHash: "ip3", country: "Germany", deviceType: "desktop", os: "Windows", browser: "Chrome" },
        { qrCodeId: "qr-1", scannedAt: new Date("2024-01-16T10:00:00Z"), ipHash: "ip1", country: "USA", deviceType: "tablet", os: "Android", browser: "Firefox" },
      ]

      const result = aggregationService._groupBatchForUpsert(batch)

      expect(result.size).toBe(3) // qr-1:2024-01-15, qr-2:2024-01-15, qr-1:2024-01-16

      const key1 = "qr-1:2024-01-15"
      const entry1 = result.get(key1)
      expect(entry1).toBeDefined()
      expect(entry1!.total).toBe(2)
      expect(entry1!.uniqueIps.size).toBe(2)
      expect(entry1!.byCountry.get("France")).toBe(2)

      const key2 = "qr-2:2024-01-15"
      const entry2 = result.get(key2)
      expect(entry2).toBeDefined()
      expect(entry2!.total).toBe(1)

      const key3 = "qr-1:2024-01-16"
      const entry3 = result.get(key3)
      expect(entry3).toBeDefined()
      expect(entry3!.total).toBe(1)
      expect(entry3!.byCountry.get("USA")).toBe(1)
    })

    it("should handle null values gracefully", () => {
      const batch = [
        { qrCodeId: "qr-1", scannedAt: new Date("2024-01-15T10:00:00Z"), ipHash: null, country: null, deviceType: null, os: null, browser: null },
      ]

      const result = aggregationService._groupBatchForUpsert(batch)

      expect(result.size).toBe(1)
      const entry = result.get("qr-1:2024-01-15")
      expect(entry).toBeDefined()
      expect(entry!.total).toBe(1)
      expect(entry!.uniqueIps.size).toBe(0) // null ipHash not added
      expect(entry!.byCountry.size).toBe(0)
      expect(entry!.byDevice.size).toBe(0)
    })
  })

  describe("_upsertBatch", () => {
    it("should upsert grouped data into ScanDaily", async () => {
      prismaMock.scanDaily.upsert.mockResolvedValue({} as never)

      const grouped = new Map()
      grouped.set("qr-1:2024-01-15", {
        date: "2024-01-15",
        total: 5,
        uniqueIps: new Set(["ip1", "ip2"]),
        byCountry: new Map([["France", 3]]),
        byDevice: new Map([["mobile", 5]]),
        byOs: new Map([["iOS", 5]]),
        byBrowser: new Map([["Safari", 5]]),
      })

      await aggregationService._upsertBatch(grouped)

      expect(prismaMock.scanDaily.upsert).toHaveBeenCalledWith({
        where: { qrCodeId_date: { qrCodeId: "qr-1", date: expect.any(Date) } },
        create: {
          qrCodeId: "qr-1",
          date: expect.any(Date),
          totalScans: 5,
          uniqueIps: 2,
          byCountry: { France: 3 },
          byDevice: { mobile: 5 },
          byOs: { iOS: 5 },
          byBrowser: { Safari: 5 },
        },
        update: {
          totalScans: { increment: 5 },
          uniqueIps: { increment: 2 },
          byCountry: { France: 3 },
          byDevice: { mobile: 5 },
          byOs: { iOS: 5 },
          byBrowser: { Safari: 5 },
        },
      })
    })
  })
})
