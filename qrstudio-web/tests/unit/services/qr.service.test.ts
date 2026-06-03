import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"
import type { Plan } from "@prisma/client"

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
    scan: model(["findUnique", "findFirst", "findMany", "create", "update", "count"]),
    landingPage: model(["findUnique", "findFirst", "create", "update"]),
    user: model(),
    workspaceMember: model(),
  }
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/utils", () => ({ generateShortCode: vi.fn() }))
vi.mock("@/lib/qr-generator", () => ({ generateQRSvg: vi.fn().mockResolvedValue("<svg></svg>") }))

import { qrService } from "@/server/services/qr.service"
import * as utils from "@/lib/utils"

describe("qrService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("generateUniqueShortCode", () => {
    it("should generate a 6-char alphanumeric short code", async () => {
      vi.mocked(utils.generateShortCode).mockReturnValue("abc123")
      prismaMock.qRCode.findUnique.mockResolvedValue(null)

      const code = await qrService.generateUniqueShortCode()
      expect(code).toBe("abc123")
      expect(code).toHaveLength(6)
      expect(code).toMatch(/^[a-z0-9]+$/)
    })

    it("should retry if short code collides", async () => {
      vi.mocked(utils.generateShortCode)
        .mockReturnValueOnce("abc123").mockReturnValueOnce("def456")
      prismaMock.qRCode.findUnique
        .mockResolvedValueOnce({ id: "existing" })
        .mockResolvedValueOnce(null)

      const code = await qrService.generateUniqueShortCode()
      expect(code).toBe("def456")
      expect(prismaMock.qRCode.findUnique).toHaveBeenCalledTimes(2)
    })

    it("should throw after 3 failed attempts", async () => {
      vi.mocked(utils.generateShortCode).mockReturnValue("abc123")
      prismaMock.qRCode.findUnique.mockResolvedValue({ id: "existing" })

      await expect(qrService.generateUniqueShortCode()).rejects.toThrow("Échec de génération d'un short code unique après 3 tentatives")
      expect(prismaMock.qRCode.findUnique).toHaveBeenCalledTimes(3)
    })
  })

  describe("checkPlanLimit", () => {
    const workspaceId = "ws-1"

    it("should allow FREE plan with 4 QR codes", async () => {
      prismaMock.qRCode.count.mockResolvedValue(4)
      await expect(qrService.checkPlanLimit(workspaceId, "FREE" as Plan)).resolves.toBeUndefined()
    })

    it("should reject FREE plan with 5+ QR codes", async () => {
      prismaMock.qRCode.count.mockResolvedValue(5)
      await expect(qrService.checkPlanLimit(workspaceId, "FREE" as Plan)).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should allow PRO plan with 99 QR codes", async () => {
      prismaMock.qRCode.count.mockResolvedValue(99)
      await expect(qrService.checkPlanLimit(workspaceId, "PRO" as Plan)).resolves.toBeUndefined()
    })

    it("should reject PRO plan with 100+ QR codes", async () => {
      prismaMock.qRCode.count.mockResolvedValue(100)
      await expect(qrService.checkPlanLimit(workspaceId, "PRO" as Plan)).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should always allow AGENCY plan (Infinity limit)", async () => {
      prismaMock.qRCode.count.mockResolvedValue(999999)
      await expect(qrService.checkPlanLimit(workspaceId, "AGENCY" as Plan)).resolves.toBeUndefined()
    })
  })

  describe("create", () => {
    const baseInput = {
      workspaceId: "ws-1",
      name: "Test QR",
      type: "URL" as const,
      destinationUrl: "https://example.com",
    }

    function mockWorkspaceFound(plan: Plan = "FREE") {
      prismaMock.workspace.findUnique.mockResolvedValue({
        id: "ws-1", ownerId: "user-1", owner: { plan },
      } as never)
    }

    it("should create a URL QR code and return id, shortCode, svgContent", async () => {
      vi.mocked(utils.generateShortCode).mockReturnValue("xyz789")
      mockWorkspaceFound("FREE")
      prismaMock.qRCode.count.mockResolvedValue(2)
      prismaMock.qRCode.findUnique.mockResolvedValue(null)
      prismaMock.qRCode.create.mockResolvedValue({ id: "qr-1", shortCode: "xyz789" } as never)

      const result = await qrService.create(baseInput)
      expect(result.id).toBe("qr-1")
      expect(result.shortCode).toBe("xyz789")
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should throw NOT_FOUND if workspace does not exist", async () => {
      prismaMock.workspace.findUnique.mockResolvedValue(null)
      await expect(qrService.create(baseInput)).rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("should throw FORBIDDEN if plan limit reached", async () => {
      mockWorkspaceFound("FREE")
      prismaMock.qRCode.count.mockResolvedValue(5)
      await expect(qrService.create(baseInput)).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  describe("update", () => {
    const existingQR = {
      id: "qr-1",
      workspaceId: "ws-1",
      type: "URL",
      shortCode: "abc123",
      destinationUrl: "https://old.com",
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "square",
      logoUrl: null,
      frameType: null,
      frameLabel: null,
      wifiSsid: null,
      wifiPassword: null,
      wifiEncryption: null,
      vcardJson: null,
      textContent: null,
      landingPageId: null,
      landingPage: null,
    }

    it("should update destination URL", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(existingQR as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-1", "ws-1", { destinationUrl: "https://new.com" })

      expect(result.id).toBe("qr-1")
      expect(result.svgContent).toBeUndefined()
      expect(prismaMock.qRCode.update).toHaveBeenCalledWith({
        where: { id: "qr-1" },
        data: { destinationUrl: "https://new.com" },
      })
    })

    it("should update name and destinationUrl together", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(existingQR as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-1", "ws-1", { name: "New Name", destinationUrl: "https://new.com" })

      expect(result.id).toBe("qr-1")
      expect(prismaMock.qRCode.update).toHaveBeenCalledWith({
        where: { id: "qr-1" },
        data: { name: "New Name", destinationUrl: "https://new.com" },
      })
    })

    it("should regenerate SVG when design changes", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(existingQR as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-1", "ws-1", { fgColor: "#FF0000" })

      expect(result.id).toBe("qr-1")
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should update WIFI type QR code", async () => {
      const existingWifi = {
        ...existingQR,
        type: "WIFI",
        destinationUrl: null,
        wifiSsid: "OldNet",
        wifiPassword: "oldpass",
        wifiEncryption: "WPA",
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingWifi as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      await qrService.update("qr-2", "ws-1", {
        wifi: { ssid: "NewNet", password: "newpass", encryption: "WPA" },
      })

      expect(prismaMock.qRCode.update).toHaveBeenCalledWith({
        where: { id: "qr-2" },
        data: { wifiSsid: "NewNet", wifiPassword: "newpass", wifiEncryption: "WPA" },
      })
    })

    it("should throw NOT_FOUND if QR code does not exist", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(null)

      await expect(qrService.update("nonexistent", "ws-1", { name: "Hack" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })
})
