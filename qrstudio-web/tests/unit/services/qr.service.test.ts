import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"
import type { Plan } from "@prisma/client"
import type { QRCreateInput } from "@/lib/validations"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "deleteMany", "count"]) => {
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

import { qrService, prepareQRData } from "@/server/services/qr.service"
import * as utils from "@/lib/utils"

describe("qrService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────────
  // prepareQRData — covers ALL QR types
  // ──────────────────────────────────────────────
  describe("prepareQRData", () => {
    it("URL type should return destinationUrl directly", () => {
      const input = { type: "URL", destinationUrl: "https://example.com" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("https://example.com")
    })

    it("URL type should return empty string if destinationUrl missing", () => {
      const input = { type: "URL" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("")
    })

    it("WHATSAPP type should build wa.me URL from full URL input", () => {
      const input = { type: "WHATSAPP", destinationUrl: "https://wa.me/0612345678" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("https://wa.me/0612345678")
    })

    it("WHATSAPP type should build wa.me URL from raw phone digits", () => {
      const input = { type: "WHATSAPP", destinationUrl: "0612345678" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("https://wa.me/0612345678")
    })

    it("WHATSAPP type should build wa.me URL from international format", () => {
      const input = { type: "WHATSAPP", destinationUrl: "+33 6 12 34 56 78" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("https://wa.me/33612345678")
    })

    it("WHATSAPP type should handle empty input gracefully", () => {
      const input = { type: "WHATSAPP", destinationUrl: "" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("https://wa.me/")
    })

    it("WHATSAPP type should handle undefined destinationUrl gracefully", () => {
      const input = { type: "WHATSAPP" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("https://wa.me/")
    })

    it("WIFI type should format correctly with password and WPA", () => {
      const input = { type: "WIFI", wifi: { ssid: "HomeNet", password: "secret123", encryption: "WPA" as const } } as QRCreateInput
      const result = prepareQRData(input, "abc123")
      expect(result).toContain("WIFI:T:WPA;")
      expect(result).toContain("S:HomeNet;")
      expect(result).toContain("P:secret123;")
    })

    it("WIFI type should format correctly with nopass", () => {
      const input = { type: "WIFI", wifi: { ssid: "GuestNet", encryption: "nopass" as const } } as QRCreateInput
      const result = prepareQRData(input, "abc123")
      expect(result).toContain("WIFI:T:nopass;")
      expect(result).toContain("S:GuestNet;")
    })

    it("VCARD type should format VCard string correctly", () => {
      const input = {
        type: "VCARD",
        vcard: { firstName: "John", lastName: "Doe", email: "john@test.com", phone: "+33612345678", company: "ACME", website: "https://acme.com" },
      } as QRCreateInput
      const result = prepareQRData(input, "abc123")
      expect(result).toContain("BEGIN:VCARD")
      expect(result).toContain("VERSION:3.0")
      expect(result).toContain("FN:John Doe")
      expect(result).toContain("N:Doe;John;;;")
      expect(result).toContain("EMAIL:john@test.com")
      expect(result).toContain("TEL:+33612345678")
      expect(result).toContain("ORG:ACME")
      expect(result).toContain("URL:https://acme.com")
      expect(result).toContain("END:VCARD")
    })

    it("VCARD type should handle minimal vcard", () => {
      const input = { type: "VCARD", vcard: { firstName: "Jane", lastName: "Smith" } } as QRCreateInput
      const result = prepareQRData(input, "abc123")
      expect(result).toContain("BEGIN:VCARD")
      expect(result).toContain("FN:Jane Smith")
      expect(result).toContain("END:VCARD")
    })

    it("VCARD type should return empty string if vcard is undefined", () => {
      const input = { type: "VCARD" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("")
    })

    it("PDF type should return destinationUrl directly", () => {
      const input = { type: "PDF", destinationUrl: "https://example.com/doc.pdf" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("https://example.com/doc.pdf")
    })

    it("PDF type should return empty string if destinationUrl missing", () => {
      const input = { type: "PDF" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("")
    })

    it("TEXT type should return textContent directly", () => {
      const input = { type: "TEXT", textContent: "Hello World" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("Hello World")
    })

    it("TEXT type should return empty string if textContent missing", () => {
      const input = { type: "TEXT" } as QRCreateInput
      expect(prepareQRData(input, "abc123")).toBe("")
    })

    it("LANDING_PAGE type should return app URL with shortCode", () => {
      const input = { type: "LANDING_PAGE" } as QRCreateInput
      const result = prepareQRData(input, "land123")
      expect(result).toBe("http://localhost:3000/l/land123")
    })

    it("LANDING_PAGE type should use NEXT_PUBLIC_APP_URL when set", () => {
      const prev = process.env.NEXT_PUBLIC_APP_URL
      process.env.NEXT_PUBLIC_APP_URL = "https://app.qrstudio.com"
      const input = { type: "LANDING_PAGE" } as QRCreateInput
      const result = prepareQRData(input, "xyz789")
      expect(result).toBe("https://app.qrstudio.com/l/xyz789")
      process.env.NEXT_PUBLIC_APP_URL = prev
    })
  })

  // ──────────────────────────────────────────────
  // generateUniqueShortCode
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // checkPlanLimit
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────
  describe("create", () => {
    const baseInput: QRCreateInput = {
      workspaceId: "ws-1",
      name: "Test QR",
      type: "URL",
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

    it("should create a WHATSAPP QR code and store raw destinationUrl in metadata", async () => {
      vi.mocked(utils.generateShortCode).mockReturnValue("wa1234")
      mockWorkspaceFound("FREE")
      prismaMock.qRCode.count.mockResolvedValue(2)
      prismaMock.qRCode.findUnique.mockResolvedValue(null)
      prismaMock.qRCode.create.mockResolvedValue({ id: "qr-wa", shortCode: "wa1234" } as never)

      const input: QRCreateInput = {
        workspaceId: "ws-1",
        name: "WhatsApp QR",
        type: "WHATSAPP",
        destinationUrl: "https://wa.me/0612345678",
      }
      await qrService.create(input)

      const createCallArgs = prismaMock.qRCode.create.mock.calls[0][0]
      expect(createCallArgs.data.metadata.destinationUrl).toBe("https://wa.me/0612345678")
    })

    it("should create a LANDING_PAGE QR code with associated LandingPage", async () => {
      vi.mocked(utils.generateShortCode).mockReturnValue("lp1234")
      mockWorkspaceFound("FREE")
      prismaMock.qRCode.count.mockResolvedValue(2)
      prismaMock.qRCode.findUnique.mockResolvedValue(null)
      prismaMock.landingPage.create.mockResolvedValue({ id: "landing-1" } as never)
      prismaMock.qRCode.create.mockResolvedValue({ id: "qr-lp", shortCode: "lp1234" } as never)

      const input: QRCreateInput = {
        workspaceId: "ws-1",
        name: "Landing Page QR",
        type: "LANDING_PAGE",
        landingPage: {
          title: "Welcome",
          description: "My landing page",
          ctaLabel: "Learn More",
          ctaUrl: "https://example.com",
          bgColor: "#FFFFFF",
          textColor: "#111827",
        },
      }
      const result = await qrService.create(input)
      expect(result.id).toBe("qr-lp")

      // Verify landing page was created
      expect(prismaMock.landingPage.create).toHaveBeenCalledTimes(1)
      const lpCallArgs = prismaMock.landingPage.create.mock.calls[0][0]
      expect(lpCallArgs.data.title).toBe("Welcome")
    })
  })

  // ──────────────────────────────────────────────
  // update
  // ──────────────────────────────────────────────
  describe("update", () => {
    const existingQR = {
      id: "qr-1",
      workspaceId: "ws-1",
      type: "URL",
      shortCode: "abc123",
      metadata: { destinationUrl: "https://old.com" },
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "square",
      logoUrl: null,
      frameType: null,
      frameLabel: null,
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
        data: { metadata: { destinationUrl: "https://new.com" } },
      })
    })

    it("should update name and destinationUrl together", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(existingQR as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-1", "ws-1", { name: "New Name", destinationUrl: "https://new.com" })

      expect(result.id).toBe("qr-1")
      expect(prismaMock.qRCode.update).toHaveBeenCalledWith({
        where: { id: "qr-1" },
        data: { name: "New Name", metadata: { destinationUrl: "https://new.com" } },
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
        metadata: { wifi: { ssid: "OldNet", password: "oldpass", encryption: "WPA" } },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingWifi as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      await qrService.update("qr-2", "ws-1", {
        wifi: { ssid: "NewNet", password: "newpass", encryption: "WPA" },
      })

      expect(prismaMock.qRCode.update).toHaveBeenCalledWith({
        where: { id: "qr-2" },
        data: { metadata: { wifi: { ssid: "NewNet", password: "newpass", encryption: "WPA" } } },
      })
    })

    it("should update LANDING_PAGE QR code with existing landing page", async () => {
      const existingLP = {
        ...existingQR,
        type: "LANDING_PAGE",
        landingPage: { id: "lp-1", title: "Old Title" },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingLP as never)
      prismaMock.landingPage.update.mockResolvedValue({} as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      await qrService.update("qr-1", "ws-1", {
        landingPage: { title: "New Title", bgColor: "#000000", textColor: "#FFFFFF" },
      })

      expect(prismaMock.landingPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "lp-1" },
          data: expect.objectContaining({ title: "New Title" }),
        })
      )
    })

    it("should create landing page on LANDING_PAGE update if none existed", async () => {
      const existingNoLP = { ...existingQR, type: "LANDING_PAGE", landingPage: null }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingNoLP as never)
      prismaMock.landingPage.create.mockResolvedValue({ id: "lp-new" } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      await qrService.update("qr-1", "ws-1", {
        landingPage: { title: "New LP", bgColor: "#FFFFFF", textColor: "#111827" },
      })

      expect(prismaMock.landingPage.create).toHaveBeenCalledTimes(1)
    })

    it("should throw NOT_FOUND if QR code does not exist", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(null)

      await expect(qrService.update("nonexistent", "ws-1", { name: "Hack" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    // ── prepareQRDataForUpdate coverage: each QR type with design change ──

    it("should regenerate SVG for WHATSAPP type with design change", async () => {
      const existingWA = {
        ...existingQR,
        type: "WHATSAPP",
        metadata: { destinationUrl: "0612345678" },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingWA as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-wa", "ws-1", { fgColor: "#00FF00" })
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should regenerate SVG for VCARD type with design change", async () => {
      const existingVcard = {
        ...existingQR,
        type: "VCARD",
        metadata: { vcard: { firstName: "John", lastName: "Doe" } },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingVcard as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-vc", "ws-1", { fgColor: "#0000FF" })
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should regenerate SVG for PDF type with design change", async () => {
      const existingPdf = {
        ...existingQR,
        type: "PDF",
        metadata: { destinationUrl: "https://example.com/doc.pdf" },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingPdf as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-pdf", "ws-1", { bgColor: "#FF0000" })
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should regenerate SVG for TEXT type with design change", async () => {
      const existingText = {
        ...existingQR,
        type: "TEXT",
        metadata: { textContent: "Hello World" },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingText as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-txt", "ws-1", { moduleShape: "rounded" })
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should regenerate SVG for WIFI type with design change (vcard branch for existing vcard)", async () => {
      const existingWifi = {
        ...existingQR,
        type: "WIFI",
        metadata: { wifi: { ssid: "MyNet", password: "secret", encryption: "WPA" } },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingWifi as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-wifi", "ws-1", { logoUrl: "https://logo.com/pic.png" })
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should regenerate SVG for VCARD with new vcard data", async () => {
      const existingVcard = {
        ...existingQR,
        type: "VCARD",
        metadata: { vcard: { firstName: "John", lastName: "Doe" } },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingVcard as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-vc2", "ws-1", {
        fgColor: "#FF00FF",
        vcard: { firstName: "Jane", lastName: "Smith" },
      })
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should regenerate SVG for LANDING_PAGE type with design change (covers prepareQRDataForUpdate LANDING_PAGE)", async () => {
      const existingLP = {
        ...existingQR,
        type: "LANDING_PAGE",
        metadata: {},
        shortCode: "lpsc01",
        landingPage: { id: "lp-1", title: "Old" },
      }
      prismaMock.qRCode.findFirst.mockResolvedValue(existingLP as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-lp2", "ws-1", { fgColor: "#ABCDEF" })
      expect(result.svgContent).toBe("<svg></svg>")
    })

    it("should set designChanged when frameLabel is provided", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(existingQR as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      const result = await qrService.update("qr-1", "ws-1", { frameLabel: "Scan me!" })
      expect(result.svgContent).toBe("<svg></svg>")
    })
  })

  // ──────────────────────────────────────────────
  // softDelete
  // ──────────────────────────────────────────────
  describe("softDelete", () => {
    it("should mark qrCode with deletedAt", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1", deletedAt: null } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      await qrService.softDelete("qr-1", "ws-1")

      expect(prismaMock.qRCode.update).toHaveBeenCalledWith({
        where: { id: "qr-1" },
        data: { deletedAt: expect.any(Date) },
      })
    })

    it("should be idempotent (calling twice on already-trashed code does not error)", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1", deletedAt: new Date() } as never)

      await expect(qrService.softDelete("qr-1", "ws-1")).resolves.toBeUndefined()
      expect(prismaMock.qRCode.update).not.toHaveBeenCalled()
    })

    it("should throw NOT_FOUND for non-existent qrCode", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(null)

      await expect(qrService.softDelete("nonexistent", "ws-1"))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  // ──────────────────────────────────────────────
  // restore
  // ──────────────────────────────────────────────
  describe("restore", () => {
    it("should clear deletedAt on a trashed qrCode", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue({ id: "qr-1", workspaceId: "ws-1", deletedAt: new Date() } as never)
      prismaMock.qRCode.update.mockResolvedValue({} as never)

      await qrService.restore("qr-1", "ws-1")

      expect(prismaMock.qRCode.update).toHaveBeenCalledWith({
        where: { id: "qr-1" },
        data: { deletedAt: null },
      })
    })

    it("should throw NOT_FOUND for non-existent qrCode", async () => {
      prismaMock.qRCode.findFirst.mockResolvedValue(null)

      await expect(qrService.restore("nonexistent", "ws-1"))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("should throw NOT_FOUND for non-trashed qrCode (deletedAt null — Prisma returns null because WHERE deletedAt IS NOT NULL)", async () => {
      // The service queries with `where: { deletedAt: { not: null } }` so Prisma returns null
      prismaMock.qRCode.findFirst.mockResolvedValue(null)

      await expect(qrService.restore("qr-1", "ws-1"))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  // ──────────────────────────────────────────────
  // permanentDelete
  // ──────────────────────────────────────────────
  describe("permanentDelete", () => {
    it("should hard delete a trashed qrCode from DB", async () => {
      prismaMock.qRCode.deleteMany.mockResolvedValue({ count: 1 })

      await qrService.permanentDelete("qr-1", "ws-1")

      expect(prismaMock.qRCode.deleteMany).toHaveBeenCalledWith({
        where: { id: "qr-1", workspaceId: "ws-1", deletedAt: { not: null } },
      })
    })

    it("should throw NOT_FOUND for non-existent qrCode", async () => {
      prismaMock.qRCode.deleteMany.mockResolvedValue({ count: 0 })

      await expect(qrService.permanentDelete("nonexistent", "ws-1"))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("should throw NOT_FOUND for non-trashed qrCode (deletedAt null)", async () => {
      prismaMock.qRCode.deleteMany.mockResolvedValue({ count: 0 })

      await expect(qrService.permanentDelete("qr-1", "ws-1"))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  // ── additional checkPlanLimit tests ──
  describe("checkPlanLimit (soft-delete integration)", () => {
    const workspaceId = "ws-1"

    it("should exclude soft-deleted codes from count (5 active + 2 trashed → count returns 5, PRO limit is 100)", async () => {
      prismaMock.qRCode.count.mockResolvedValue(5)
      await expect(qrService.checkPlanLimit(workspaceId, "PRO" as Plan)).resolves.toBeUndefined()
      expect(prismaMock.qRCode.count).toHaveBeenCalledWith({
        where: { workspaceId, deletedAt: null },
      })
    })

    it("should still throw FORBIDDEN when active count >= limit for FREE (5 >= 5)", async () => {
      prismaMock.qRCode.count.mockResolvedValue(5)
      await expect(qrService.checkPlanLimit(workspaceId, "FREE" as Plan))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})
