import { describe, it, expect, vi, beforeEach } from "vitest"
import type { TRPCContext } from "@/server/trpc"

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
    workspace: model(),
    workspaceMember: model(),
    scan: model(["findUnique", "findFirst", "findMany", "create", "update", "count", "groupBy"]),
    landingPage: model(["findUnique", "findFirst", "create", "update"]),
    user: model(),
    $queryRaw: vi.fn(),
  }
})

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/utils", () => ({ generateShortCode: vi.fn() }))
vi.mock("@/lib/qr-generator", () => ({
  generateQRSvg: vi.fn().mockResolvedValue("<svg></svg>"),
  generateQrPngBuffer: vi.fn().mockResolvedValue(Buffer.from("")),
}))

import { qrRouter } from "@/server/routers/qr"

function ctx(overrides?: Partial<TRPCContext>): TRPCContext {
  return { db: prismaMock as never, session: null, user: undefined, ...overrides }
}
function authed(userId = "user-1", wsId = "ws-1"): TRPCContext {
  return ctx({
    user: { id: userId, email: "u@t.com", name: "U", image: null, plan: "FREE" },
  })
}

function mockWorkspaceAccess(wsId = "ws-1", role = "OWNER") {
  prismaMock.workspaceMember.findUnique.mockResolvedValue({ role, workspaceId: wsId, userId: "user-1" } as never)
}

describe("qrRouter", () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe("create", () => {
    it("should create a QR code and return id, shortCode, svgContent", async () => {
      mockWorkspaceAccess()
      prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws-1", ownerId: "user-1", owner: { plan: "FREE" } } as never)
      prismaMock.qRCode.count.mockResolvedValue(0)
      prismaMock.qRCode.findUnique.mockResolvedValue(null)
      prismaMock.qRCode.create.mockResolvedValue({ id: "qr-1", shortCode: "abc123" } as never)

      const caller = qrRouter.createCaller(authed())
      const result = await caller.create({ workspaceId: "ws-1", name: "Test", type: "URL", destinationUrl: "https://ex.com" })
      expect(result.id).toBe("qr-1")
      expect(result.shortCode).toBe("abc123")
    })

    it("should throw FORBIDDEN if FREE plan at limit", async () => {
      mockWorkspaceAccess()
      prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws-1", ownerId: "user-1", owner: { plan: "FREE" } } as never)
      prismaMock.qRCode.count.mockResolvedValue(5)

      const caller = qrRouter.createCaller(authed())
      await expect(caller.create({ workspaceId: "ws-1", name: "T", type: "URL", destinationUrl: "https://ex.com" }))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should throw UNAUTHORIZED if no user", async () => {
      const caller = qrRouter.createCaller(ctx())
      await expect(caller.create({ workspaceId: "ws-1", name: "T", type: "URL", destinationUrl: "https://ex.com" }))
        .rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })
  })

  describe("list", () => {
    it("should return paginated QR codes with default limit", async () => {
      mockWorkspaceAccess()
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: `qr-${i}`, shortCode: `sc${i}`, name: `QR ${i}`,
        type: "URL", status: "ACTIVE", totalScans: 0, lastScannedAt: null, createdAt: new Date(),
      }))
      prismaMock.qRCode.findMany.mockResolvedValue(items as never)

      const result = await qrRouter.createCaller(authed()).list({ workspaceId: "ws-1" })
      expect(result.items).toHaveLength(20)
      expect(result.nextCursor).toBeUndefined()
    })

    it("should support cursor-based pagination with nextCursor", async () => {
      mockWorkspaceAccess()
      const items = Array.from({ length: 21 }, (_, i) => ({
        id: `qr-${i}`, shortCode: `sc${i}`, name: `QR ${i}`,
        type: "URL", status: "ACTIVE", totalScans: i, lastScannedAt: null, createdAt: new Date(),
      }))
      prismaMock.qRCode.findMany.mockResolvedValue(items as never)

      const result = await qrRouter.createCaller(authed()).list({ workspaceId: "ws-1", limit: 20 })
      expect(result.items).toHaveLength(20)
      expect(result.nextCursor).toBeDefined()
      expect(result.nextCursor).toBe("qr-20")
    })

    it("should filter by type", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findMany.mockResolvedValue([
        { id: "qr-wa", shortCode: "wa1", name: "WA QR", type: "WHATSAPP", status: "ACTIVE", totalScans: 0, lastScannedAt: null, createdAt: new Date() },
      ] as never)

      const result = await qrRouter.createCaller(authed()).list({ workspaceId: "ws-1", type: "WHATSAPP" })
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.type).toBe("WHATSAPP")
      // Verify the where clause includes type filter
      const findManyCall = prismaMock.qRCode.findMany.mock.calls[0][0]
      expect(findManyCall.where.type).toBe("WHATSAPP")
    })

    it("should filter by status", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findMany.mockResolvedValue([
        { id: "qr-p", shortCode: "p1", name: "Paused QR", type: "URL", status: "PAUSED", totalScans: 0, lastScannedAt: null, createdAt: new Date() },
      ] as never)

      const result = await qrRouter.createCaller(authed()).list({ workspaceId: "ws-1", status: "PAUSED" })
      expect(result.items[0]!.status).toBe("PAUSED")
      const findManyCall = prismaMock.qRCode.findMany.mock.calls[0][0]
      expect(findManyCall.where.status).toBe("PAUSED")
    })

    it("should search by name or shortCode (case-insensitive)", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findMany.mockResolvedValue([
        { id: "qr-s", shortCode: "findme", name: "Searchable QR", type: "URL", status: "ACTIVE", totalScans: 0, lastScannedAt: null, createdAt: new Date() },
      ] as never)

      const result = await qrRouter.createCaller(authed()).list({ workspaceId: "ws-1", search: "findme" })
      expect(result.items).toHaveLength(1)
      const findManyCall = prismaMock.qRCode.findMany.mock.calls[0][0]
      expect(findManyCall.where.OR).toBeDefined()
      expect(findManyCall.where.OR).toHaveLength(2)
      expect(findManyCall.where.OR[0].name.contains).toBe("findme")
      expect(findManyCall.where.OR[1].shortCode.contains).toBe("findme")
    })

    it("should combine type, status, and search filters", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findMany.mockResolvedValue([] as never)

      await qrRouter.createCaller(authed()).list({
        workspaceId: "ws-1", type: "URL", status: "ACTIVE", search: "test",
      })
      const findManyCall = prismaMock.qRCode.findMany.mock.calls[0][0]
      expect(findManyCall.where.type).toBe("URL")
      expect(findManyCall.where.status).toBe("ACTIVE")
      expect(findManyCall.where.OR).toBeDefined()
    })

    it("should enforce workspaceId filter to prevent cross-workspace leaks", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findMany.mockResolvedValue([] as never)

      await qrRouter.createCaller(authed()).list({ workspaceId: "ws-1" })
      const findManyCall = prismaMock.qRCode.findMany.mock.calls[0][0]
      expect(findManyCall.where.workspaceId).toBe("ws-1")
    })

    it("should throw UNAUTHORIZED if not logged in", async () => {
      const caller = qrRouter.createCaller(ctx())
      await expect(caller.list({ workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })

    it("should throw FORBIDDEN if user not in workspace", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue(null)

      await expect(qrRouter.createCaller(authed("user-other")).list({ workspaceId: "ws-other" }))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  describe("getById", () => {
    it("should return QR code by id when found in workspace", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({
        id: "qr-1", workspaceId: "ws-1", shortCode: "abc123", name: "My QR",
        type: "URL", status: "ACTIVE", destinationUrl: "https://ex.com",
        fgColor: "#000", bgColor: "#FFF", moduleShape: "square",
        logoUrl: null, frameType: null, frameLabel: null,
        wifiSsid: null, wifiPassword: null, wifiEncryption: null,
        vcardJson: null, textContent: null, landingPageId: null,
        landingPage: null, totalScans: 0, uniqueScans: 0,
        lastScannedAt: null, createdAt: new Date(), updatedAt: new Date(),
      } as never)

      const result = await qrRouter.createCaller(authed()).getById({ id: "qr-1", workspaceId: "ws-1" })
      expect(result.id).toBe("qr-1")
      expect(result.name).toBe("My QR")
    })

    it("should throw NOT_FOUND if QR code not in workspace (IDOR protection)", async () => {
      mockWorkspaceAccess()
      // QR code exists but belongs to different workspace
      prismaMock.qRCode.findFirst.mockResolvedValue(null)

      await expect(qrRouter.createCaller(authed()).getById({ id: "qr-other", workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("should throw NOT_FOUND for non-existent QR code", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue(null)

      await expect(qrRouter.createCaller(authed()).getById({ id: "nonexistent", workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("should throw UNAUTHORIZED if not logged in", async () => {
      const caller = qrRouter.createCaller(ctx())
      await expect(caller.getById({ id: "qr-1", workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })

    it("should include landingPage when type is LANDING_PAGE", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({
        id: "qr-lp", workspaceId: "ws-1", shortCode: "lp1", name: "LP QR",
        type: "LANDING_PAGE", status: "ACTIVE",
        destinationUrl: null, fgColor: "#000", bgColor: "#FFF", moduleShape: "square",
        logoUrl: null, frameType: null, frameLabel: null,
        wifiSsid: null, wifiPassword: null, wifiEncryption: null,
        vcardJson: null, textContent: null, landingPageId: "lp-1",
        landingPage: { id: "lp-1", title: "Welcome", description: "LP desc" },
        totalScans: 0, uniqueScans: 0,
        lastScannedAt: null, createdAt: new Date(), updatedAt: new Date(),
      } as never)

      const result = await qrRouter.createCaller(authed()).getById({ id: "qr-lp", workspaceId: "ws-1" })
      expect(result.landingPage).toBeDefined()
      expect(result.landingPage!.title).toBe("Welcome")
    })
  })

  describe("exportSvg", () => {
    it("should export SVG for a valid URL QR code", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({
        id: "qr-1", workspaceId: "ws-1", shortCode: "abc123",
        type: "URL", status: "ACTIVE", destinationUrl: "https://ex.com",
        fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
        logoUrl: null, frameType: null, frameLabel: null,
        wifiSsid: null, wifiPassword: null, wifiEncryption: null,
        vcardJson: null, textContent: null, landingPageId: null,
      } as never)

      const result = await qrRouter.createCaller(authed()).exportSvg({ id: "qr-1", workspaceId: "ws-1" })
      expect(result.svg).toBe("<svg></svg>")
    })

    it("should export SVG for WIFI type QR (covers toQRDataInput wifi branch)", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({
        id: "qr-wifi", workspaceId: "ws-1", shortCode: "wifisc",
        type: "WIFI", status: "ACTIVE", destinationUrl: null,
        fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
        logoUrl: null, frameType: null, frameLabel: null,
        wifiSsid: "HomeNet", wifiPassword: "secret", wifiEncryption: "WPA",
        vcardJson: null, textContent: null, landingPageId: null,
      } as never)

      const result = await qrRouter.createCaller(authed()).exportSvg({ id: "qr-wifi", workspaceId: "ws-1" })
      expect(result.svg).toBe("<svg></svg>")
    })

    it("should export SVG for VCARD type (covers toQRDataInput vcard branch)", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({
        id: "qr-vc", workspaceId: "ws-1", shortCode: "vc123",
        type: "VCARD", status: "ACTIVE", destinationUrl: null,
        fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
        logoUrl: null, frameType: null, frameLabel: null,
        wifiSsid: null, wifiPassword: null, wifiEncryption: null,
        vcardJson: JSON.stringify({ firstName: "John", lastName: "Doe" }),
        textContent: null, landingPageId: null,
      } as never)

      const result = await qrRouter.createCaller(authed()).exportSvg({ id: "qr-vc", workspaceId: "ws-1" })
      expect(result.svg).toBe("<svg></svg>")
    })

    it("should throw NOT_FOUND if QR code does not exist for SVG export", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue(null)
      await expect(qrRouter.createCaller(authed()).exportSvg({ id: "nonexistent", workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  describe("exportPng", () => {
    it("should export PNG as base64 for a valid URL QR code", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({
        id: "qr-1", workspaceId: "ws-1", shortCode: "abc123",
        type: "URL", status: "ACTIVE", destinationUrl: "https://ex.com",
        fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
        logoUrl: null, frameType: null, frameLabel: null,
        wifiSsid: null, wifiPassword: null, wifiEncryption: null,
        vcardJson: null, textContent: null, landingPageId: null,
      } as never)

      const result = await qrRouter.createCaller(authed()).exportPng({ id: "qr-1", workspaceId: "ws-1", size: 800 })
      expect(result.base64).toBeDefined()
      expect(typeof result.base64).toBe("string")
    })

    it("should export PNG for WIFI type (covers toQRDataInput wifi branch via PNG)", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({
        id: "qr-wifi-png", workspaceId: "ws-1", shortCode: "wifip",
        type: "WIFI", status: "ACTIVE", destinationUrl: null,
        fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
        logoUrl: null, frameType: null, frameLabel: null,
        wifiSsid: "GuestNet", wifiPassword: "pass", wifiEncryption: "WPA",
        vcardJson: null, textContent: null, landingPageId: null,
      } as never)

      const result = await qrRouter.createCaller(authed()).exportPng({ id: "qr-wifi-png", workspaceId: "ws-1" })
      expect(result.base64).toBeDefined()
    })

    it("should throw NOT_FOUND if QR code does not exist for PNG export", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue(null)
      await expect(qrRouter.createCaller(authed()).exportPng({ id: "nonexistent", workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  describe("update", () => {
    it("should update destination URL", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst
        .mockResolvedValueOnce({ id: "qr-1", workspaceId: "ws-1" } as never)
        .mockResolvedValueOnce({ id: "qr-1", workspaceId: "ws-1", type: "URL", destinationUrl: "https://old.com", fgColor: "#000", bgColor: "#FFF", moduleShape: "square" } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrRouter.createCaller(authed()).update({ id: "qr-1", workspaceId: "ws-1", name: "Updated" })
      expect(result.id).toBe("qr-1")
    })

    it("should update destination URL and regenerate SVG when design changes", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst
        .mockResolvedValueOnce({ id: "qr-1", workspaceId: "ws-1" } as never)
        .mockResolvedValueOnce({ id: "qr-1", workspaceId: "ws-1", type: "URL", destinationUrl: "https://old.com", fgColor: "#000", bgColor: "#FFF", moduleShape: "square" } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrRouter.createCaller(authed()).update({
        id: "qr-1", workspaceId: "ws-1", name: "Styled", fgColor: "#FF0000",
      })
      expect(result.id).toBe("qr-1")
    })

    it("should throw NOT_FOUND if QR code does not exist", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValueOnce(null)

      await expect(qrRouter.createCaller(authed()).update({ id: "nonexistent", workspaceId: "ws-1", name: "Nope" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("should throw FORBIDDEN if viewer", async () => {
      mockWorkspaceAccess("ws-1", "VIEWER")
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1" } as never)

      await expect(qrRouter.createCaller(authed("user-1", "ws-1")).update({ id: "qr-1", workspaceId: "ws-1", name: "Hack" }))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  describe("updateStatus", () => {
    it("should change status from ACTIVE to PAUSED", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1" } as never)
      prismaMock.workspace.findUnique.mockResolvedValue({ owner: { plan: "PRO" } } as never)
      prismaMock.qRCode.update.mockResolvedValue({ id: "qr-1", status: "PAUSED" } as never)

      const result = await qrRouter.createCaller(authed()).updateStatus({ id: "qr-1", workspaceId: "ws-1", status: "PAUSED" })
      expect(result).toEqual({ success: true })
    })
  })

  describe("delete", () => {
    it("should allow OWNER to delete", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1" } as never)
      prismaMock.workspace.findUnique.mockResolvedValue({ ownerId: "user-1" } as never)
      prismaMock.qRCode.delete.mockResolvedValue({} as never)

      const result = await qrRouter.createCaller(authed()).delete({ id: "qr-1", workspaceId: "ws-1" })
      expect(result).toEqual({ success: true })
    })

    it("should throw FORBIDDEN if VIEWER tries to delete", async () => {
      mockWorkspaceAccess("ws-1", "VIEWER")
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1" } as never)
      prismaMock.workspace.findUnique.mockResolvedValue({ ownerId: "other-user" } as never)

      await expect(qrRouter.createCaller(authed("user-2", "ws-1")).delete({ id: "qr-1", workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  describe("getAnalytics", () => {
    it("should return analytics for a QR code", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1" } as never)
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 10, uniqueScans: 5 } as never)
      prismaMock.user.findUnique.mockResolvedValue({ plan: "PRO" } as never)
      // $queryRaw retourne les scans (getScansByDay) puis pays/devices/os vides
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ date: "2024-06-01", count: BigInt(1) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await qrRouter.createCaller(authed()).getAnalytics({
        qrCodeId: "qr-1", workspaceId: "ws-1", period: "7d",
      })
      expect(result.totalScans).toBe(10)
      expect(result.uniqueScans).toBe(5)
      expect(result.scansByDay).toHaveLength(1)
    })

    it("should throw NOT_FOUND if QR code does not exist", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue(null)

      await expect(qrRouter.createCaller(authed()).getAnalytics({
        qrCodeId: "nonexistent", workspaceId: "ws-1", period: "30d",
      })).rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("should default period to 30d", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1" } as never)
      prismaMock.qRCode.findUnique.mockResolvedValue({ totalScans: 0, uniqueScans: 0 } as never)
      prismaMock.user.findUnique.mockResolvedValue({ plan: "FREE" } as never)
      prismaMock.$queryRaw
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([])

      const result = await qrRouter.createCaller(authed()).getAnalytics({
        qrCodeId: "qr-1", workspaceId: "ws-1",
      })
      expect(result.totalScans).toBe(0)
    })
  })
})
