import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count", "groupBy"]) => {
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
    scanDaily: model(),
    aggregationWatermark: model(),
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
// Mock cache layer so tests don't need Redis
vi.mock("@/server/cache/analytics-cache", () => ({
  readWithCache: vi.fn((_key: string, _ttl: number, compute: () => Promise<unknown>) => compute()),
  invalidateAnalyticsCache: vi.fn(),
  analyticsCacheKey: vi.fn((id: string, period: string) => `analytics:${id}:${period}`),
  dashboardCacheKey: vi.fn((id: string) => `dashboard:${id}`),
  ANALYTICS_TTL: 60,
  DASHBOARD_TTL: 30,
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
    beforeEach(() => {
      // ScanDaily returns empty → triggers fallback to raw Scan queries
      prismaMock.scanDaily.findMany.mockResolvedValue([])
    })

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
      // Use ISO date string to avoid local-timezone date shift
      const now = new Date("2024-06-01T12:00:00Z")
      vi.useFakeTimers()
      vi.setSystemTime(now)

      // Compute expected dates from the same algorithm as computeDashboardFromSummaries
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0)
      const expectedDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo)
        d.setDate(d.getDate() + i + 1)
        return d.toISOString().split("T")[0]
      })

      prismaMock.qRCode.count.mockResolvedValue(10)
      prismaMock.qRCode.findMany
        .mockResolvedValueOnce([
          { id: "qr-1" },
        ] as never)
        .mockResolvedValueOnce([
          { id: "qr-1", name: "Recent QR", shortCode: "a1", type: "URL", status: "ACTIVE", totalScans: 5, lastScannedAt: null, createdAt: new Date() },
        ] as never)
        .mockResolvedValueOnce([
          { id: "qr-2", name: "Top QR", shortCode: "b2", type: "URL", totalScans: 100, status: "ACTIVE", lastScannedAt: null, createdAt: new Date() },
        ] as never)
      prismaMock.scan.count.mockResolvedValue(3)
      prismaMock.workspaceMember.count.mockResolvedValue(2)
      // ScanDaily.groupBy returns aggregated daily totals (dates as UTC midnight)
      prismaMock.scanDaily.groupBy.mockResolvedValue([
        { date: new Date(expectedDates[0] + "T00:00:00Z"), _sum: { totalScans: 1 } },
        { date: new Date(expectedDates[1] + "T00:00:00Z"), _sum: { totalScans: 2 } },
      ] as never)
      // $queryRaw for today's partial data (today not in ScanDaily)
      prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(0) }])

      const result = await analyticsService.getDashboardStats("ws-1")

      expect(result.totalQRCodes).toBe(10)
      expect(result.totalScansToday).toBe(3)
      expect(result.totalMembers).toBe(2)
      expect(result.recentQRCodes).toHaveLength(1)
      expect(result.topQRCodes).toHaveLength(1)
      expect(result.scansLast7Days).toHaveLength(7)
      expect(result.scansLast7Days[0].date).toBe(expectedDates[0])
      expect(result.scansLast7Days[0].scans).toBe(1)
      expect(result.scansLast7Days[1].date).toBe(expectedDates[1])
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

  describe("exportCSVPage", () => {
    it("should return first page with header row + data rows", async () => {
      prismaMock.scan.findMany.mockResolvedValue([
        { scannedAt: new Date("2024-01-15T10:00:00Z"), ipHash: "abc123", country: "France", city: "Paris", deviceType: "mobile", os: "iOS", browser: "Safari", referer: "https://google.com" },
        { scannedAt: new Date("2024-01-16T14:00:00Z"), ipHash: "def456", country: "Germany", city: null, deviceType: "desktop", os: "Windows", browser: "Chrome", referer: null },
      ] as never)

      const result = await analyticsService.exportCSVPage("qr-1", "30d")

      expect(result.rows).toHaveLength(3) // header + 2 data rows
      expect(result.rows[0]).toBe("Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent")
      expect(result.rows[1]).toContain("France")
      expect(result.rows[1]).toContain("mobile")
      expect(result.rows[2]).toContain("Germany")
      expect(result.rows[2]).toContain("desktop")
      expect(result.nextCursor).toBeUndefined()
    })

    it("should return nextCursor when scan count equals page size (1000)", async () => {
      const scans = Array.from({ length: 1000 }, (_, i) => ({
        id: `scan-${i}`,
        scannedAt: new Date("2024-01-15T10:00:00Z"),
        ipHash: `ip${i}`, country: null, city: null, deviceType: null, os: null, browser: null, referer: null,
      }))
      prismaMock.scan.findMany.mockResolvedValue(scans as never)

      const result = await analyticsService.exportCSVPage("qr-1", "30d")

      expect(result.rows).toHaveLength(1001) // header + 1000 data rows
      expect(result.nextCursor).toBe("scan-999")
    })

    it("should not include header on subsequent pages (when cursor provided)", async () => {
      prismaMock.scan.findMany.mockResolvedValue([
        { scannedAt: new Date("2024-01-16T14:00:00Z"), ipHash: "def456", country: "Germany", city: null, deviceType: "desktop", os: "Windows", browser: "Chrome", referer: null },
      ] as never)

      const result = await analyticsService.exportCSVPage("qr-1", "30d", "scan-999")

      expect(result.rows).toHaveLength(1) // no header, just data
      expect(result.rows[0]).toContain("Germany")
      expect(result.nextCursor).toBeUndefined()
    })

    it("should return header-only when no scans on first page", async () => {
      prismaMock.scan.findMany.mockResolvedValue([] as never)

      const result = await analyticsService.exportCSVPage("qr-empty", "7d")

      // First page always includes header even with no data
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toBe("Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent")
      expect(result.nextCursor).toBeUndefined()
    })

    it("should pass cursor and skip:1 to findMany on subsequent pages", async () => {
      prismaMock.scan.findMany.mockResolvedValue([] as never)

      await analyticsService.exportCSVPage("qr-1", "30d", "scan-cursor-1")

      expect(prismaMock.scan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "scan-cursor-1" },
          skip: 1,
          take: 1000,
        }),
      )
    })
  })

  describe("computeAnalyticsFromSummaries", () => {
    it("should return AnalyticsData from ScanDaily summary rows", async () => {
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 100, uniqueScans: 40 } as never)
      prismaMock.scanDaily.findMany.mockResolvedValue([
        {
          date: new Date("2024-01-15"),
          totalScans: 10,
          byCountry: { France: 5, Germany: 3 },
          byDevice: { mobile: 8 },
          byOs: { iOS: 6 },
        },
        {
          date: new Date("2024-01-16"),
          totalScans: 20,
          byCountry: { France: 10, USA: 5 },
          byDevice: { desktop: 15 },
          byOs: { Windows: 12 },
        },
      ] as never)

      const result = await analyticsService.computeAnalyticsFromSummaries("qr-1", "7d")

      expect(result.totalScans).toBe(100)
      expect(result.uniqueScans).toBe(40)
      expect(result.scansByDay).toEqual([
        { date: "2024-01-15", scans: 10 },
        { date: "2024-01-16", scans: 20 },
      ])
      // Country: France(5+10=15), Germany(3), USA(5) → top 10 sorted
      expect(result.byCountry).toHaveLength(3)
      expect(result.byCountry[0]).toEqual({ country: "France", scans: 15 })
      expect(result.byDevice).toHaveLength(2)
      expect(result.byOs).toHaveLength(2)
    })

    it("should merge today's partial data from raw Scan when today not in ScanDaily", async () => {
      // Use fake timers to control the current date and avoid timezone issues
      vi.useFakeTimers()
      const now = new Date("2024-06-15T12:00:00Z")
      vi.setSystemTime(now)

      // Compute today's UTC date string the same way getTodayStart() does (setHours local → toISOString UTC)
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const todayStr = todayStart.toISOString().split("T")[0]

      const yesterdayDate = new Date(todayStart)
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)

      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 50, uniqueScans: 20 } as never)
      // ScanDaily has yesterday's data, not today
      prismaMock.scanDaily.findMany.mockResolvedValue([
        { date: yesterdayDate, totalScans: 5, byCountry: {}, byDevice: {}, byOs: {} },
      ] as never)
      // Today's partial data from raw Scan
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ date: todayStr, count: BigInt(3) }])
        .mockResolvedValueOnce([{ country: "France", count: BigInt(2) }])
        .mockResolvedValueOnce([{ device: "mobile", count: BigInt(3) }])
        .mockResolvedValueOnce([{ os: "Android", count: BigInt(3) }])

      const result = await analyticsService.computeAnalyticsFromSummaries("qr-1", "7d")

      expect(result.scansByDay).toHaveLength(2)
      // Yesterday from summary, today merged from raw
      const todayEntry = result.scansByDay.find((s: { date: string }) => s.date === todayStr)
      expect(todayEntry).toBeDefined()
      expect(todayEntry!.scans).toBe(3)
      expect(result.byCountry[0].country).toBe("France")

      vi.useRealTimers()
    })

    it("should apply plan retention correctly (FREE=30d)", async () => {
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 10, uniqueScans: 5 } as never)
      prismaMock.scanDaily.findMany.mockResolvedValue([] as never)
      // Raw queries return empty
      prismaMock.$queryRaw
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])

      const result = await analyticsService.computeAnalyticsFromSummaries("qr-1", "all", 30)

      expect(result.totalScans).toBe(10)
      // scanDaily.findMany should have been called with date >= retention date
      const findManyArgs = prismaMock.scanDaily.findMany.mock.calls[0][0]
      expect(findManyArgs.where.date).toBeDefined()
      expect(findManyArgs.where.date.gte).toBeInstanceOf(Date)
    })

    it("should return empty results when no data exists", async () => {
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 0, uniqueScans: 0 } as never)
      prismaMock.scanDaily.findMany.mockResolvedValue([] as never)
      prismaMock.$queryRaw
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])

      const result = await analyticsService.computeAnalyticsFromSummaries("qr-empty", "7d")

      expect(result.totalScans).toBe(0)
      expect(result.uniqueScans).toBe(0)
      expect(result.scansByDay).toEqual([])
      expect(result.byCountry).toEqual([])
      expect(result.byDevice).toEqual([])
      expect(result.byOs).toEqual([])
    })
  })

  describe("computeDashboardFromSummaries", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("should return DashboardStats with scansLast7Days from ScanDaily", async () => {
      const now = new Date("2024-06-05T12:00:00Z")
      vi.useFakeTimers()
      vi.setSystemTime(now)

      // Compute expected dates using the same algorithm as the source code
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const todayStr = todayStart.toISOString().split("T")[0]

      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0)
      const expectedDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo)
        d.setDate(d.getDate() + i + 1)
        return d.toISOString().split("T")[0]
      })

      prismaMock.qRCode.findMany
        .mockResolvedValueOnce([{ id: "qr-1" }, { id: "qr-2" }] as never)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never)
      prismaMock.qRCode.count.mockResolvedValue(2)
      prismaMock.scan.count.mockResolvedValue(5)
      prismaMock.workspaceMember.count.mockResolvedValue(3)
      // ScanDaily has data for earlier days (not today), so hasTodayInSummary = false
      prismaMock.scanDaily.groupBy.mockResolvedValue([
        { date: new Date(expectedDates[4] + "T00:00:00Z"), _sum: { totalScans: 10 } },
        { date: new Date(expectedDates[5] + "T00:00:00Z"), _sum: { totalScans: 15 } },
      ] as never)
      // Today's partial (today not in summary → raw query fallback)
      prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(3) }])

      const result = await analyticsService.computeDashboardFromSummaries("ws-1")

      expect(result.totalQRCodes).toBe(2)
      expect(result.totalScansToday).toBe(5)
      expect(result.totalMembers).toBe(3)
      expect(result.scansLast7Days).toHaveLength(7)
      // Today should include raw count (today not in summary)
      // expectedDates[6] is the last day (today)
      expect(result.scansLast7Days[6].date).toBe(expectedDates[6])
      expect(result.scansLast7Days[6].scans).toBe(3) // raw count only (no summary for today)
    })

    it("should return zero arrays when workspace has no QR codes", async () => {
      const now = new Date("2024-06-05T12:00:00Z")
      vi.useFakeTimers()
      vi.setSystemTime(now)

      prismaMock.qRCode.findMany.mockResolvedValue([] as never)
      prismaMock.qRCode.count.mockResolvedValue(0)
      prismaMock.scan.count.mockResolvedValue(0)
      prismaMock.workspaceMember.count.mockResolvedValue(0)

      const result = await analyticsService.computeDashboardFromSummaries("ws-empty")

      expect(result.totalQRCodes).toBe(0)
      expect(result.totalScansToday).toBe(0)
      expect(result.scansLast7Days).toHaveLength(7)
      expect(result.scansLast7Days.every((d: { scans: number }) => d.scans === 0)).toBe(true)
    })

    it("should not call scanDaily.groupBy when no QR codes in workspace", async () => {
      prismaMock.qRCode.findMany.mockResolvedValue([] as never)

      await analyticsService.computeDashboardFromSummaries("ws-empty")

      expect(prismaMock.scanDaily.groupBy).not.toHaveBeenCalled()
    })
  })
})
