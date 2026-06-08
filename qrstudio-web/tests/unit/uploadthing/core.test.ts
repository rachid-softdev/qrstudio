import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const authMock = vi.hoisted(() => vi.fn())

vi.mock("@/server/auth", () => ({
  auth: authMock,
}))

import { uploadRouter } from "@/app/api/uploadthing/core"

// Helper to create fake uploadthing files array
function fakeFile(overrides: Partial<{ name: string; size: number; type: string; customId: string | null }> = {}) {
  return [{
    name: overrides.name ?? "file.png",
    size: overrides.size ?? 1024,
    type: overrides.type ?? "image/png",
    customId: overrides.customId ?? null,
  }]
}

// Helper to create a fake uploaded file (as received by onUploadComplete)
function fakeUploadedFile(overrides: Partial<{ name: string; size: number; type: string; key: string; url: string; appUrl: string; customId: string | null }> = {}) {
  return {
    name: overrides.name ?? "file.png",
    size: overrides.size ?? 1024,
    type: overrides.type ?? "image/png",
    key: overrides.key ?? "abc123",
    url: overrides.url ?? "https://uploadthing.com/f/abc123.png",
    appUrl: overrides.appUrl ?? "https://uploadthing.com/f/abc123.png",
    customId: overrides.customId ?? null,
  }
}

// ──────────────────────────────────────────────────────────────
// 1b.2 — Upload blob restriction
// 1b.3 — SVG upload dans logo
// ──────────────────────────────────────────────────────────────

describe("uploadRouter — logoImageUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("middleware", () => {
    it("should throw if user is not authenticated", async () => {
      authMock.mockResolvedValue(null)

      await expect(
        uploadRouter.logoImageUploader.middleware({ files: fakeFile(), input: undefined })
      ).rejects.toThrow("Non authentifié")
    })

    it("should return userId when user is authenticated", async () => {
      authMock.mockResolvedValue({ user: { id: "user-1" } })

      const result = await uploadRouter.logoImageUploader.middleware({ files: fakeFile(), input: undefined })

      expect(result).toEqual({ userId: "user-1" })
    })
  })

  describe("onUploadComplete — SVG dans logo (1b.3)", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("should reject SVG by content type (image/svg+xml)", async () => {
      const svgBytes = new Uint8Array([60, 115, 118, 103, 32, 120, 109, 108, 110, 115, 61]) // "<svg xmlns="
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(svgBytes.buffer),
        clone: () => this,
      }))

      // Verify the stub works
      const fetchResult = await globalThis.fetch("http://test.com")
      const buf = Buffer.from(await fetchResult.arrayBuffer())
      expect(buf.toString("utf-8").startsWith("<svg")).toBe(true)

      await expect(
        uploadRouter.logoImageUploader.onUploadComplete({
          metadata: { userId: "user-1" },
          file: fakeUploadedFile({ name: "logo.svg", type: "image/svg+xml" }),
        })
      ).rejects.toThrow("Les fichiers SVG ne sont pas autorisés comme logo")
    })

    it("should reject SVG magic bytes even when MIME type is spoofed", async () => {
      const svgBytes = new Uint8Array([60, 115, 118, 103, 32, 120, 109, 108, 110, 115, 61]) // "<svg xmlns="
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(svgBytes.buffer),
      }))

      await expect(
        uploadRouter.logoImageUploader.onUploadComplete({
          metadata: { userId: "user-1" },
          file: fakeUploadedFile({ name: "logo.png", type: "image/png" }),
        })
      ).rejects.toThrow("Les fichiers SVG ne sont pas autorisés comme logo")
    })

    it("should accept PNG files", async () => {
      const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(pngBytes.buffer),
      }))

      const result = await uploadRouter.logoImageUploader.onUploadComplete({
        metadata: { userId: "user-1" },
        file: fakeUploadedFile({ name: "logo.png", type: "image/png" }),
      })

      expect(result).toEqual({ uploadedBy: "user-1", url: "https://uploadthing.com/f/abc123.png" })
    })
  })
})

describe("uploadRouter — pdfUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("middleware — plan restriction (1b.2)", () => {
    it("should throw if user is not authenticated", async () => {
      authMock.mockResolvedValue(null)

      await expect(
        uploadRouter.pdfUploader.middleware({ files: fakeFile(), input: undefined })
      ).rejects.toThrow("Non authentifié")
    })

    it("should reject FREE plan users from uploading PDFs", async () => {
      authMock.mockResolvedValue({ user: { id: "user-free", plan: "FREE" } })

      await expect(
        uploadRouter.pdfUploader.middleware({ files: fakeFile(), input: undefined })
      ).rejects.toThrow("Plan FREE ne permet pas l'upload de PDF")
    })

    it("should allow PRO plan users to upload PDFs", async () => {
      authMock.mockResolvedValue({ user: { id: "user-pro", plan: "PRO" } })

      const result = await uploadRouter.pdfUploader.middleware({ files: fakeFile(), input: undefined })

      expect(result).toEqual({ userId: "user-pro" })
    })

    it("should allow AGENCY plan users to upload PDFs", async () => {
      authMock.mockResolvedValue({ user: { id: "user-agency", plan: "AGENCY" } })

      const result = await uploadRouter.pdfUploader.middleware({ files: fakeFile(), input: undefined })

      expect(result).toEqual({ userId: "user-agency" })
    })
  })

  describe("onUploadComplete — PDF validation", () => {
    beforeEach(() => {
      // Default mock: valid PDF content
      const pdfResponse = {
        ok: true,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode('%PDF-1.4...').buffer),
      }
      vi.spyOn(globalThis, "fetch").mockResolvedValue(pdfResponse as Response)
    })

    it("should reject non-PDF files", async () => {
      await expect(
        uploadRouter.pdfUploader.onUploadComplete({
          metadata: { userId: "user-1" },
          file: fakeUploadedFile({ name: "doc.html", type: "text/html" }),
        })
      ).rejects.toThrow("Seuls les fichiers PDF sont acceptés")
    })

    it("should accept PDF files", async () => {
      const result = await uploadRouter.pdfUploader.onUploadComplete({
        metadata: { userId: "user-1" },
        file: fakeUploadedFile({ name: "doc.pdf", type: "application/pdf" }),
      })

      expect(result).toEqual({ uploadedBy: "user-1", url: "https://uploadthing.com/f/abc123.png" })
    })
  })
})
