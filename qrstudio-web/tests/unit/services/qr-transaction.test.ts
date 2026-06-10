import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Plan } from "@prisma/client"
import type { QRCreateInput, QRUpdateInput } from "@/lib/validations"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
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
    landingPage: model(["findUnique", "findFirst", "create", "update"]),
    $transaction: vi.fn(),
  }
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/utils", () => ({ generateShortCode: vi.fn() }))
vi.mock("@/lib/qr-generator", () => ({ generateQRSvg: vi.fn().mockResolvedValue("<svg></svg>") }))

import { qrService } from "@/server/services/qr.service"
import * as utils from "@/lib/utils"

describe("QR Service — Transaction for QRCode + LandingPage", () => {
  const workspaceId = "ws-1"

  function mockWorkspaceFound(plan: Plan = "FREE") {
    prismaMock.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      ownerId: "user-1",
      owner: { plan },
    } as never)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(utils.generateShortCode).mockReturnValue("abc123")
    prismaMock.qRCode.findUnique.mockResolvedValue(null)
    prismaMock.qRCode.count.mockResolvedValue(0)
    mockWorkspaceFound("FREE")

    // Default $transaction mock: execute callback with proxy
    prismaMock.$transaction.mockImplementation(
      (cb: (tx: Record<string, unknown>) => unknown) => {
        return cb({
          $executeRawUnsafe: vi.fn(),
          qRCode: prismaMock.qRCode,
          landingPage: prismaMock.landingPage,
        })
      },
    )
  })

  // ─── LANDING_PAGE creates both in transaction ──────────────────────────────

  it("should create QRCode AND LandingPage inside $transaction for LANDING_PAGE type", async () => {
    prismaMock.qRCode.create.mockResolvedValue({ id: "qr-1", shortCode: "abc123" } as never)
    prismaMock.landingPage.create.mockResolvedValue({ id: "lp-1" } as never)

    const input: QRCreateInput = {
      workspaceId,
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

    expect(result.id).toBe("qr-1")
    expect(result.shortCode).toBe("abc123")

    // $transaction should have been called
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)

    // Both creates should have been called (inside the transaction)
    expect(prismaMock.landingPage.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.qRCode.create).toHaveBeenCalledTimes(1)

    // LandingPage title should match
    const lpCallArgs = prismaMock.landingPage.create.mock.calls[0][0]
    expect(lpCallArgs.data.title).toBe("Welcome")
  })

  // ─── Rollback: QRCode fails → LandingPage rolled back ─────────────────────

  it("should roll back LandingPage if QRCode creation fails inside $transaction", async () => {
    prismaMock.landingPage.create.mockResolvedValue({ id: "lp-1" } as never)
    // QRCode creation fails inside transaction
    prismaMock.$transaction.mockImplementation(
      (_cb: (tx: Record<string, unknown>) => unknown) => {
        throw new Error("QRCode creation failed")
      },
    )

    const input: QRCreateInput = {
      workspaceId,
      name: "Failing QR",
      type: "LANDING_PAGE",
      landingPage: { title: "Fail", bgColor: "#FFF", textColor: "#000" },
    }

    await expect(qrService.create(input)).rejects.toThrow("QRCode creation failed")

    // $transaction rejected, so no orphan LandingPage
    // Prisma's built-in rollback handles this
  })

  // ─── QRCode update with LandingPage update is atomic ─────────────────────

  it("should atomically update QRCode and LandingPage in update", async () => {
    const existingQR = {
      id: "qr-1",
      workspaceId,
      type: "LANDING_PAGE",
      shortCode: "abc123",
      metadata: {},
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "square",
      logoUrl: null,
      frameType: null,
      frameLabel: null,
      landingPageId: "lp-1",
      landingPage: { id: "lp-1", title: "Old Title" },
    }
    prismaMock.qRCode.findFirst.mockResolvedValue(existingQR as never)
    prismaMock.qRCode.update.mockResolvedValue({} as never)
    prismaMock.landingPage.update.mockResolvedValue({} as never)

    await qrService.update("qr-1", workspaceId, {
      name: "Updated QR",
      landingPage: {
        title: "New Title",
        bgColor: "#000000",
        textColor: "#FFFFFF",
      },
    })

    // Both should be updated
    expect(prismaMock.qRCode.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.landingPage.update).toHaveBeenCalledTimes(1)

    // Verify landingPage was updated with new data
    const lpUpdateArgs = prismaMock.landingPage.update.mock.calls[0][0]
    expect(lpUpdateArgs.where.id).toBe("lp-1")
    expect(lpUpdateArgs.data.title).toBe("New Title")
  })

  it("should create LandingPage on update if none existed (atomic)", async () => {
    const existingQR = {
      id: "qr-1",
      workspaceId,
      type: "LANDING_PAGE",
      shortCode: "abc123",
      metadata: {},
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "square",
      logoUrl: null,
      frameType: null,
      frameLabel: null,
      landingPageId: null,
      landingPage: null,
    }
    prismaMock.qRCode.findFirst.mockResolvedValue(existingQR as never)
    prismaMock.landingPage.create.mockResolvedValue({ id: "lp-new" } as never)
    prismaMock.qRCode.update.mockResolvedValue({} as never)

    await qrService.update("qr-1", workspaceId, {
      landingPage: { title: "New LP", bgColor: "#FFF", textColor: "#000" },
    })

    expect(prismaMock.landingPage.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.qRCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "qr-1" },
        data: expect.objectContaining({
          landingPageId: "lp-new",
        }),
      }),
    )
  })

  // ─── Non-LANDING_PAGE types don't create LandingPage ────────────────────

  it("should NOT create LandingPage for URL type QR code", async () => {
    prismaMock.qRCode.create.mockResolvedValue({ id: "qr-url", shortCode: "abc123" } as never)

    const input: QRCreateInput = {
      workspaceId,
      name: "URL QR",
      type: "URL",
      destinationUrl: "https://example.com",
    }

    await qrService.create(input)

    expect(prismaMock.landingPage.create).not.toHaveBeenCalled()
  })

  it("should NOT create LandingPage for WHATSAPP type QR code", async () => {
    prismaMock.qRCode.create.mockResolvedValue({ id: "qr-wa", shortCode: "abc123" } as never)

    const input: QRCreateInput = {
      workspaceId,
      name: "WhatsApp QR",
      type: "WHATSAPP",
      destinationUrl: "0612345678",
    }

    await qrService.create(input)

    expect(prismaMock.landingPage.create).not.toHaveBeenCalled()
  })

  it("should NOT create LandingPage for WIFI type QR code", async () => {
    prismaMock.qRCode.create.mockResolvedValue({ id: "qr-wifi", shortCode: "abc123" } as never)

    const input: QRCreateInput = {
      workspaceId,
      name: "WiFi QR",
      type: "WIFI",
      wifi: { ssid: "TestNet", encryption: "nopass" },
    }

    await qrService.create(input)

    expect(prismaMock.landingPage.create).not.toHaveBeenCalled()
  })

  it("should NOT create LandingPage for VCARD type QR code", async () => {
    prismaMock.qRCode.create.mockResolvedValue({ id: "qr-vc", shortCode: "abc123" } as never)

    const input: QRCreateInput = {
      workspaceId,
      name: "VCard QR",
      type: "VCARD",
      vcard: { firstName: "John", lastName: "Doe" },
    }

    await qrService.create(input)

    expect(prismaMock.landingPage.create).not.toHaveBeenCalled()
  })

  it("should NOT create LandingPage for PDF type QR code", async () => {
    prismaMock.qRCode.create.mockResolvedValue({ id: "qr-pdf", shortCode: "abc123" } as never)

    const input: QRCreateInput = {
      workspaceId,
      name: "PDF QR",
      type: "PDF",
      destinationUrl: "https://example.com/doc.pdf",
    }

    await qrService.create(input)

    expect(prismaMock.landingPage.create).not.toHaveBeenCalled()
  })

  it("should NOT create LandingPage for TEXT type QR code", async () => {
    prismaMock.qRCode.create.mockResolvedValue({ id: "qr-txt", shortCode: "abc123" } as never)

    const input: QRCreateInput = {
      workspaceId,
      name: "Text QR",
      type: "TEXT",
      textContent: "Hello",
    }

    await qrService.create(input)

    expect(prismaMock.landingPage.create).not.toHaveBeenCalled()
  })
})
