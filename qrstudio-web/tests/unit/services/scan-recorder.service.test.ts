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
    qRCode: model(),
    scan: model(["findFirst", "create"]),
    $transaction: vi.fn(),
  }
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))

const geoMock = vi.hoisted(() => ({ getCountry: vi.fn() }))
vi.mock("@/lib/geo", () => geoMock)

const uaMock = vi.hoisted(() => ({
  parseDevice: vi.fn(),
  parseOs: vi.fn(),
  parseBrowser: vi.fn(),
}))
vi.mock("@/lib/user-agent", () => uaMock)

const ipMock = vi.hoisted(() => ({ hashIp: vi.fn() }))
vi.mock("@/lib/ip", () => ipMock)

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// ── SUT ────────────────────────────────────────────────────────────────────
import { scanRecorder } from "@/server/services/scan-recorder.service"

describe("scanRecorder", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mocks
    geoMock.getCountry.mockResolvedValue("France")
    uaMock.parseDevice.mockReturnValue("desktop")
    uaMock.parseOs.mockReturnValue("Windows")
    uaMock.parseBrowser.mockReturnValue("Chrome")
    ipMock.hashIp.mockResolvedValue("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
  })

  describe("recordScan", () => {
    const scanInput = {
      qrCodeId: "qr-1",
      ip: "1.2.3.4",
      userAgent: "Mozilla/5.0",
      referer: "https://example.com",
    }

    it("should exist and be callable", () => {
      expect(scanRecorder).toBeDefined()
      expect(scanRecorder.recordScan).toBeInstanceOf(Function)
    })

    it("should create a scan record and update QR code stats", async () => {
      // Simulate no recent scan (uniqueScans should increment)
      prismaMock.scan.findFirst.mockResolvedValue(null)
      prismaMock.$transaction.mockImplementation(
        (cb: (tx: Record<string, unknown>) => unknown) => {
          return cb({
            scan: prismaMock.scan,
            qRCode: prismaMock.qRCode,
            $executeRawUnsafe: vi.fn(),
          })
        },
      )

      await scanRecorder.recordScan(scanInput)

      // Verify scan.create was called with correct data
      expect(prismaMock.scan.create).toHaveBeenCalledTimes(1)
      const createArgs = prismaMock.scan.create.mock.calls[0][0]
      expect(createArgs.data.qrCodeId).toBe("qr-1")
      expect(createArgs.data.ipHash).toBeTruthy()
      expect(createArgs.data.country).toBe("France")
      expect(createArgs.data.deviceType).toBe("desktop")
      expect(createArgs.data.os).toBe("Windows")
      expect(createArgs.data.browser).toBe("Chrome")
      expect(createArgs.data.referer).toBe("https://example.com")

      // Verify qRCode.update was called (totalScans increment)
      expect(prismaMock.qRCode.update).toHaveBeenCalled()
      const updateCall = prismaMock.qRCode.update.mock.calls.find(
        (c: unknown[]) => (c as Record<string, unknown>[])[0]?.where?.id === "qr-1",
      )
      expect(updateCall).toBeTruthy()
    })

    it("should increment uniqueScans when no recent scan from same IP", async () => {
      prismaMock.scan.findFirst.mockResolvedValue(null)
      prismaMock.$transaction.mockImplementation(
        (cb: (tx: Record<string, unknown>) => unknown) => cb({
          scan: prismaMock.scan,
          qRCode: prismaMock.qRCode,
          $executeRawUnsafe: vi.fn(),
        }),
      )

      await scanRecorder.recordScan(scanInput)

      // uniqueScans increment should be called
      const uniqueUpdate = prismaMock.qRCode.update.mock.calls.find(
        (c: unknown[]) => (c as Record<string, unknown>[])[0]?.data?.uniqueScans !== undefined,
      )
      expect(uniqueUpdate).toBeTruthy()
    })

    it("should NOT increment uniqueScans if recent scan from same IP exists", async () => {
      prismaMock.scan.findFirst.mockResolvedValue({ id: "scan-1" })
      prismaMock.$transaction.mockImplementation(
        (cb: (tx: Record<string, unknown>) => unknown) => cb({
          scan: prismaMock.scan,
          qRCode: prismaMock.qRCode,
          $executeRawUnsafe: vi.fn(),
        }),
      )

      await scanRecorder.recordScan(scanInput)

      // uniqueScans increment should NOT be called
      const uniqueUpdate = prismaMock.qRCode.update.mock.calls.find(
        (c: unknown[]) => (c as Record<string, unknown>[])[0]?.data?.uniqueScans !== undefined,
      )
      expect(uniqueUpdate).toBeFalsy()
    })

    it("should handle missing ip gracefully", async () => {
      prismaMock.$transaction.mockImplementation(
        (cb: (tx: Record<string, unknown>) => unknown) => cb({
          scan: prismaMock.scan,
          qRCode: prismaMock.qRCode,
          $executeRawUnsafe: vi.fn(),
        }),
      )

      await scanRecorder.recordScan({ qrCodeId: "qr-1" })

      expect(prismaMock.scan.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.scan.create.mock.calls[0][0].data.ipHash).toBeNull()
      expect(prismaMock.scan.create.mock.calls[0][0].data.country).toBeNull()
    })

    it("should handle missing userAgent gracefully", async () => {
      prismaMock.$transaction.mockImplementation(
        (cb: (tx: Record<string, unknown>) => unknown) => cb({
          scan: prismaMock.scan,
          qRCode: prismaMock.qRCode,
          $executeRawUnsafe: vi.fn(),
        }),
      )

      await scanRecorder.recordScan({ qrCodeId: "qr-1", ip: "1.2.3.4" })

      expect(prismaMock.scan.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.scan.create.mock.calls[0][0].data.deviceType).toBeNull()
      expect(prismaMock.scan.create.mock.calls[0][0].data.os).toBeNull()
      expect(prismaMock.scan.create.mock.calls[0][0].data.browser).toBeNull()
    })

    it("should handle geo service failure gracefully", async () => {
      geoMock.getCountry.mockRejectedValue(new Error("Geo service unavailable"))
      prismaMock.$transaction.mockImplementation(
        (cb: (tx: Record<string, unknown>) => unknown) => cb({
          scan: prismaMock.scan,
          qRCode: prismaMock.qRCode,
          $executeRawUnsafe: vi.fn(),
        }),
      )

      await scanRecorder.recordScan(scanInput)

      // Should still create scan with null country
      expect(prismaMock.scan.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.scan.create.mock.calls[0][0].data.country).toBeNull()
    })

    it("should not query unique scans when ipHash is null", async () => {
      prismaMock.$transaction.mockImplementation(
        (cb: (tx: Record<string, unknown>) => unknown) => cb({
          scan: prismaMock.scan,
          qRCode: prismaMock.qRCode,
          $executeRawUnsafe: vi.fn(),
        }),
      )

      await scanRecorder.recordScan({ qrCodeId: "qr-1" })

      // findFirst should not be called for unique scan check (no ipHash)
      expect(prismaMock.scan.findFirst).not.toHaveBeenCalled()
    })
  })
})
