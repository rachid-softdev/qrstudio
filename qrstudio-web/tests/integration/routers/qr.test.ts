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
    it("should return paginated QR codes", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findMany.mockResolvedValue([
        { id: "qr-1", shortCode: "a1", name: "QR 1", type: "URL", status: "ACTIVE", totalScans: 0, lastScannedAt: null, createdAt: new Date() },
      ] as never)

      const result = await qrRouter.createCaller(authed()).list({ workspaceId: "ws-1", limit: 20 })
      expect(result.items).toHaveLength(1)
    })
  })

  describe("getById", () => {
    it("should throw NOT_FOUND if QR code in wrong workspace", async () => {
      mockWorkspaceAccess()
      prismaMock.qRCode.findFirst.mockResolvedValue(null)
      await expect(qrRouter.createCaller(authed()).getById({ id: "qr-1", workspaceId: "ws-1" }))
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
      prismaMock.qRCode.update.mockResolvedValue({ id: "qr-1", status: "PAUSED" } as never)

      const result = await qrRouter.createCaller(authed()).updateStatus({ id: "qr-1", workspaceId: "ws-1", status: "PAUSED" })
      expect(result.status).toBe("PAUSED")
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
      prismaMock.scan.findMany.mockResolvedValue([
        { scannedAt: new Date("2024-06-01T10:00:00Z") },
      ] as never)
      prismaMock.scan.groupBy.mockResolvedValue([] as never)

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
      prismaMock.scan.findMany.mockResolvedValue([] as never)
      prismaMock.scan.groupBy.mockResolvedValue([] as never)

      const result = await qrRouter.createCaller(authed()).getAnalytics({
        qrCodeId: "qr-1", workspaceId: "ws-1",
      })
      expect(result.totalScans).toBe(0)
    })
  })
})
