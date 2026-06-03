import { describe, it, expect, vi, beforeEach } from "vitest"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) {
      m[method] = vi.fn()
    }
    return m
  }
  return {
    qRCode: model(),
    scan: model(["findUnique", "findFirst", "findMany", "create", "update", "count", "groupBy"]),
  }
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/geo", () => ({ getCountry: vi.fn().mockResolvedValue("France") }))
vi.mock("@/lib/user-agent", () => ({
  parseDevice: vi.fn().mockReturnValue("desktop"),
  parseOs: vi.fn().mockReturnValue("Windows"),
  parseBrowser: vi.fn().mockReturnValue("Chrome"),
}))

import { analyticsService } from "@/server/services/analytics.service"

describe("analyticsService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("recordScan", () => {
    const scanInput = {
      qrCodeId: "qr-1",
      ip: "192.168.1.1",
      userAgent: "Mozilla/5.0 Chrome",
      referer: "https://google.com",
    }

    it("should create a scan record and increment totalScans", async () => {
      prismaMock.scan.create.mockResolvedValue({ id: "scan-1" } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)
      prismaMock.scan.findFirst.mockResolvedValue(null)

      await analyticsService.recordScan(scanInput)

      expect(prismaMock.scan.create).toHaveBeenCalledTimes(1)
      const createData = (prismaMock.scan.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data
      expect(createData.qrCodeId).toBe("qr-1")
      expect(createData.ipHash).toBeDefined()
      expect(createData.country).toBe("France")

      // totalScans incremented + uniqueScans incremented = 2 calls
      expect(prismaMock.qRCode.update).toHaveBeenCalledTimes(2)
      const totalUpdate = (prismaMock.qRCode.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data
      expect(totalUpdate.totalScans).toEqual({ increment: 1 })
      const uniqueUpdate = (prismaMock.qRCode.update.mock.calls[1] as [{ data: Record<string, unknown> }])[0].data
      expect(uniqueUpdate.uniqueScans).toEqual({ increment: 1 })
    })

    it("should NOT increment uniqueScans if same ipHash scanned within 24h", async () => {
      prismaMock.scan.create.mockResolvedValue({ id: "scan-2" } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)
      prismaMock.scan.findFirst.mockResolvedValue({ id: "recent-scan" } as never)

      await analyticsService.recordScan(scanInput)

      // Only 1 update (totalScans), no uniqueScans increment
      expect(prismaMock.qRCode.update).toHaveBeenCalledTimes(1)
    })

    it("should handle missing IP gracefully (no dedup)", async () => {
      prismaMock.scan.create.mockResolvedValue({ id: "scan-3" } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      await analyticsService.recordScan({
        qrCodeId: "qr-1",
        userAgent: "Mozilla/5.0",
      })

      const createData = (prismaMock.scan.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data
      expect(createData.ipHash).toBeNull()
      // No ipHash -> no uniqueScans check -> only 1 update
      expect(prismaMock.qRCode.update).toHaveBeenCalledTimes(1)
    })
  })
})
