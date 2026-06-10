import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) {
      m[method] = vi.fn()
    }
    return m
  }
  return {
    scan: model(["findMany"]),
  }
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))

// ── SUT ────────────────────────────────────────────────────────────────────
import { analyticsExportService } from "@/server/services/analytics-export.service"
import type { Period } from "@/server/services/analytics-export.service"

// ── Helpers ────────────────────────────────────────────────────────────────
function makeScan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "scan-1",
    qrCodeId: "qr-1",
    scannedAt: new Date("2025-06-01T12:00:00Z"),
    ipHash: "abc123",
    country: "France",
    city: "Paris",
    deviceType: "desktop",
    os: "Windows",
    browser: "Chrome",
    referer: "https://example.com",
    ...overrides,
  }
}

describe("analyticsExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("exportCSV", () => {
    it("should return a CSV string with header row and scan data", async () => {
      prismaMock.scan.findMany.mockResolvedValue([makeScan()])

      const csv = await analyticsExportService.exportCSV("qr-1", "30d")

      expect(typeof csv).toBe("string")
      expect(csv).toContain("Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent")
      expect(csv).toContain("2025-06-01T12:00:00.000Z")
      expect(csv).toContain("abc123")
      expect(csv).toContain("France")
      expect(csv).toContain("desktop")
      expect(csv).toContain("Chrome")
    })

    it("should return header only when there are no scans", async () => {
      prismaMock.scan.findMany.mockResolvedValue([])

      const csv = await analyticsExportService.exportCSV("qr-1", "7d")

      const lines = csv.split("\n")
      expect(lines.length).toBe(1) // Just the header
      expect(lines[0]).toBe("Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent")
    })

    it("should include multiple scans when present", async () => {
      // Mock returns scans in array order; the service applies orderBy: { scannedAt: 'desc' }
      // via Prisma, but since we mock findMany directly, the order in the mock array is preserved.
      // Second scan (June 2) has country "Germany", first (June 1) has "France".
      prismaMock.scan.findMany.mockResolvedValue([
        makeScan({ id: "scan-1", scannedAt: new Date("2025-06-01T12:00:00Z") }),
        makeScan({ id: "scan-2", scannedAt: new Date("2025-06-02T12:00:00Z"), country: "Germany", referer: null }),
      ])

      const csv = await analyticsExportService.exportCSV("qr-1", "90d")
      const lines = csv.split("\n")

      expect(lines.length).toBe(3) // Header + 2 rows
      expect(lines[1]).toContain("France")
      expect(lines[2]).toContain("Germany")
    })

    it("should escape fields with commas or quotes", async () => {
      prismaMock.scan.findMany.mockResolvedValue([
        makeScan({ browser: 'Chrome "Stable", Version 100', os: "Windows, 10" }),
      ])

      const csv = await analyticsExportService.exportCSV("qr-1", "all")
      // The os and browser values contain commas → should be quoted
      expect(csv).toContain('"Windows, 10"')
      expect(csv).toContain('"Chrome ""Stable"", Version 100"')
    })

    it("should handle null fields by returning empty strings", async () => {
      prismaMock.scan.findMany.mockResolvedValue([
        makeScan({
          ipHash: null,
          country: null,
          city: null,
          deviceType: null,
          os: null,
          browser: null,
          referer: null,
        }),
      ])

      const csv = await analyticsExportService.exportCSV("qr-1", "30d")
      // All null fields should appear as empty strings in CSV
      const row = csv.split("\n")[1]
      const fields = row.split(",")
      expect(fields[1]).toBe("") // ipHash
      expect(fields[2]).toBe("") // country
      expect(fields[3]).toBe("") // city
      expect(fields[4]).toBe("") // deviceType
    })

    it("should pass the period to the underlying query", async () => {
      prismaMock.scan.findMany.mockResolvedValue([makeScan()])

      await analyticsExportService.exportCSV("qr-1", "7d")

      // Verify the where clause includes scannedAt for 7-day period
      const findManyCall = prismaMock.scan.findMany.mock.calls[0][0]
      expect(findManyCall.where.qrCodeId).toBe("qr-1")
      expect(findManyCall.where.scannedAt).toBeDefined()
      expect(findManyCall.where.scannedAt.gte).toBeInstanceOf(Date)
    })

    it("should not include date filter for 'all' period", async () => {
      prismaMock.scan.findMany.mockResolvedValue([makeScan()])

      await analyticsExportService.exportCSV("qr-1", "all")

      const findManyCall = prismaMock.scan.findMany.mock.calls[0][0]
      expect(findManyCall.where.qrCodeId).toBe("qr-1")
      expect(findManyCall.where.scannedAt).toBeUndefined()
    })

    it("should limit to 10000 records for legacy export", async () => {
      prismaMock.scan.findMany.mockResolvedValue([])

      await analyticsExportService.exportCSV("qr-1", "all")

      const findManyCall = prismaMock.scan.findMany.mock.calls[0][0]
      expect(findManyCall.take).toBe(10000)
    })
  })

  describe("legacyExportCSV", () => {
    it("should return CSV string directly", async () => {
      prismaMock.scan.findMany.mockResolvedValue([makeScan()])

      const csv = await analyticsExportService.legacyExportCSV("qr-1", "30d")

      expect(typeof csv).toBe("string")
      expect(csv).toContain("Date,IP Hash")
      expect(csv).toContain("France")
    })
  })

  describe("exportCSVPage", () => {
    it("should return header + rows for first page", async () => {
      prismaMock.scan.findMany.mockResolvedValue([makeScan()])

      const result = await analyticsExportService.exportCSVPage("qr-1", "30d")

      expect(result.rows.length).toBe(2) // Header + 1 row
      expect(result.rows[0]).toBe("Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent")
      expect(result.rows[1]).toContain("France")
      expect(result.nextCursor).toBeUndefined()
    })

    it("should return rows only (no header) for subsequent pages", async () => {
      prismaMock.scan.findMany.mockResolvedValue([makeScan()])

      const result = await analyticsExportService.exportCSVPage("qr-1", "30d", "scan-1")

      expect(result.rows.length).toBe(1) // Data rows only, no header
      expect(result.rows[0]).toContain("France")
    })

    it("should return nextCursor when there are 1000 rows", async () => {
      const scans = Array.from({ length: 1000 }, (_, i) =>
        makeScan({ id: `scan-${i + 1}` }),
      )
      prismaMock.scan.findMany.mockResolvedValue(scans)

      const result = await analyticsExportService.exportCSVPage("qr-1", "30d")

      expect(result.nextCursor).toBe("scan-1000")
    })

    it("should skip 1 when cursor is provided", async () => {
      prismaMock.scan.findMany.mockResolvedValue([makeScan()])

      await analyticsExportService.exportCSVPage("qr-1", "30d", "scan-0")

      const findManyCall = prismaMock.scan.findMany.mock.calls[0][0]
      expect(findManyCall.cursor).toEqual({ id: "scan-0" })
      expect(findManyCall.skip).toBe(1)
    })
  })
})
