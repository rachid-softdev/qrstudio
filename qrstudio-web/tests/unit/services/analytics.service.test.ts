import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) {
      m[method] = vi.fn()
    }
    return m
  }
  const m = {
    qRCode: model(),
    scan: model(["findUnique", "findFirst", "findMany", "create", "update", "count", "groupBy"]),
    workspaceMember: model(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn() as ReturnType<typeof vi.fn>,
  }
  m.$transaction.mockImplementation((fn: (tx: typeof m) => unknown) => fn(m))
  return m
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

    it("should wrap operations in a prisma.$transaction", async () => {
      prismaMock.scan.create.mockResolvedValue({ id: "scan-tx" } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)
      prismaMock.scan.findFirst.mockResolvedValue(null)

      await analyticsService.recordScan(scanInput)

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
      expect(typeof (prismaMock.$transaction.mock.calls[0] as [{ fn: unknown }])[0]).toBe("function")
    })

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

  describe("getAnalytics", () => {
    it("should return analytics for 7d period", async () => {
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 10, uniqueScans: 5 } as never)
      // $queryRaw est appelé 4x dans Promise.all : getScansByDay, getTopCountries, getTopDevices, getTopOs
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ date: "2024-01-15", count: BigInt(2) }])
        .mockResolvedValueOnce([{ country: "France", count: BigInt(2) }])
        .mockResolvedValueOnce([{ device: "desktop", count: BigInt(2) }])
        .mockResolvedValueOnce([{ os: "Windows", count: BigInt(2) }])

      const result = await analyticsService.getAnalytics("qr-1", "7d")

      expect(result.totalScans).toBe(10)
      expect(result.uniqueScans).toBe(5)
      expect(result.scansByDay).toHaveLength(1)
      expect(result.scansByDay[0].date).toBe("2024-01-15")
      expect(result.scansByDay[0].scans).toBe(2)
      expect(result.byCountry).toHaveLength(1)
      expect(result.byCountry[0].country).toBe("France")
      expect(result.byDevice).toHaveLength(1)
      expect(result.byOs).toHaveLength(1)
    })

    it("should return analytics for 30d period", async () => {
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 20, uniqueScans: 8 } as never)
      prismaMock.$queryRaw
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])

      const result = await analyticsService.getAnalytics("qr-1", "30d")

      expect(result.totalScans).toBe(20)
      expect(result.uniqueScans).toBe(8)
      expect(result.scansByDay).toEqual([])
    })

    it("should return analytics for 90d period", async () => {
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 50, uniqueScans: 25 } as never)
      prismaMock.$queryRaw
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])

      const result = await analyticsService.getAnalytics("qr-1", "90d")
      expect(result.totalScans).toBe(50)
    })

    it("should return analytics for 'all' period (no date filter)", async () => {
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 100, uniqueScans: 40 } as never)
      prismaMock.$queryRaw
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])

      const result = await analyticsService.getAnalytics("qr-1", "all")
      expect(result.totalScans).toBe(100)
    })

    it("should return zero values when qrCode is null", async () => {
      prismaMock.qRCode.findUnique.mockResolvedValue(null)
      prismaMock.$queryRaw
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])

      const result = await analyticsService.getAnalytics("nonexistent", "7d")
      expect(result.totalScans).toBe(0)
      expect(result.uniqueScans).toBe(0)
    })
  })

  describe("getDashboardStats", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("should return dashboard stats with computed values", async () => {
      const now = new Date("2024-06-01T12:00:00Z")
      vi.useFakeTimers()
      vi.setSystemTime(now)

      prismaMock.qRCode.count.mockResolvedValue(10)
      prismaMock.qRCode.findMany
        .mockResolvedValueOnce([
          { id: "qr-1", name: "Recent QR", shortCode: "a1", type: "URL", status: "ACTIVE", totalScans: 5, lastScannedAt: null, createdAt: new Date() },
        ] as never)
        .mockResolvedValueOnce([
          { id: "qr-2", name: "Top QR", shortCode: "b2", type: "URL", totalScans: 100, status: "ACTIVE", lastScannedAt: null, createdAt: new Date() },
        ] as never)
      prismaMock.scan.count.mockResolvedValue(3)
      prismaMock.workspaceMember.count.mockResolvedValue(2)
      // $queryRaw retourne les scans groupés par date pour les 7 derniers jours
      prismaMock.$queryRaw.mockResolvedValue([
        { date: "2024-05-26", count: BigInt(1) },
        { date: "2024-05-27", count: BigInt(2) },
      ])

      const result = await analyticsService.getDashboardStats("ws-1")

      expect(result.totalQRCodes).toBe(10)
      expect(result.totalScansToday).toBe(3)
      expect(result.totalMembers).toBe(2)
      expect(result.recentQRCodes).toHaveLength(1)
      expect(result.topQRCodes).toHaveLength(1)
      expect(result.scansLast7Days).toHaveLength(7)
      // 2024-06-01 is Saturday, 7 days before is 2024-05-26 (Sunday)
      expect(result.scansLast7Days[0].date).toBe("2024-05-26")
      expect(result.scansLast7Days[0].scans).toBe(1)
      expect(result.scansLast7Days[1].date).toBe("2024-05-27")
      expect(result.scansLast7Days[1].scans).toBe(2)
    })

    it("should return at least 1 for totalMembers", async () => {
      prismaMock.qRCode.count.mockResolvedValue(0)
      prismaMock.qRCode.findMany.mockResolvedValue([] as never)
      prismaMock.scan.count.mockResolvedValue(0)
      prismaMock.workspaceMember.count.mockResolvedValue(0)
      prismaMock.$queryRaw.mockResolvedValue([])

      const result = await analyticsService.getDashboardStats("ws-empty")
      expect(result.totalMembers).toBe(1)
      expect(result.totalQRCodes).toBe(0)
      expect(result.totalScansToday).toBe(0)
    })
  })

  describe("exportCSV", () => {
    it("should export CSV with header and rows", async () => {
      prismaMock.scan.findMany.mockResolvedValue([
        { scannedAt: new Date("2024-01-15T10:00:00Z"), ipHash: "abc123", country: "France", city: "Paris", deviceType: "mobile", os: "iOS", browser: "Safari", referer: "https://google.com" },
        { scannedAt: new Date("2024-01-16T14:00:00Z"), ipHash: "def456", country: "Germany", city: null, deviceType: "desktop", os: "Windows", browser: "Chrome", referer: null },
      ] as never)

      const csv = await analyticsService.exportCSV("qr-1", "30d")

      const lines = csv.split("\n")
      expect(lines[0]).toBe("Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent")
      expect(lines[1]).toContain("France")
      expect(lines[1]).toContain("Paris")
      expect(lines[1]).toContain("mobile")
      expect(lines[2]).toContain("Germany")
      expect(lines[2]).toContain("desktop")
      expect(lines).toHaveLength(3) // header + 2 data rows
    })

    it("should export CSV with only header when no scans", async () => {
      prismaMock.scan.findMany.mockResolvedValue([] as never)

      const csv = await analyticsService.exportCSV("qr-empty", "7d")
      expect(csv).toBe("Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent")
    })
  })
})
