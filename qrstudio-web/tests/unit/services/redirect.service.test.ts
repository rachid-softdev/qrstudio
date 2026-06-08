import { describe, it, expect } from "vitest"
import { resolveDestination } from "@/server/services/redirect.service"

type QRType = "URL" | "WHATSAPP" | "WIFI" | "VCARD" | "PDF" | "TEXT" | "LANDING_PAGE"

function makeQR(overrides: { type: QRType; destinationUrl?: string | null; shortCode?: string }) {
  const metadata: Record<string, unknown> = {}
  if (overrides.destinationUrl !== undefined && overrides.destinationUrl !== null) {
    metadata.destinationUrl = overrides.destinationUrl
  }
  return {
    shortCode: overrides.shortCode ?? "abc123",
    type: overrides.type,
    status: "ACTIVE" as const,
    metadata,
    deletedAt: null,
  }
}

describe("resolveDestination", () => {
  // ─── URL type — open redirect protection ───────────────────────────────
  it("URL type should return internal destinationUrl directly", () => {
    const result = resolveDestination(makeQR({ type: "URL", destinationUrl: "/dashboard" }))
    expect(result).toBe("/dashboard")
  })

  it("URL type should return internal app URL directly", () => {
    const result = resolveDestination(makeQR({ type: "URL", destinationUrl: "https://qrstudio.app/page" }))
    expect(result).toBe("https://qrstudio.app/page")
  })

  it("URL type should block external URLs and return '/redirect-blocked'", () => {
    const result = resolveDestination(makeQR({ type: "URL", destinationUrl: "https://evil.com/phish" }))
    expect(result).toBe("/redirect-blocked")
  })

  it("URL type should block external URLs with non-HTTP protocols", () => {
    const result = resolveDestination(makeQR({ type: "URL", destinationUrl: "ftp://evil.com/file" }))
    expect(result).toBe("/redirect-blocked")
  })

  it("URL type should return '/' if destinationUrl is null", () => {
    const result = resolveDestination(makeQR({ type: "URL", destinationUrl: null }))
    expect(result).toBe("/")
  })

  it("WHATSAPP type should return wa.me link with cleaned phone", () => {
    const result = resolveDestination(makeQR({ type: "WHATSAPP", destinationUrl: "+33 6 12 34 56 78" }))
    expect(result).toBe("https://wa.me/33612345678")
  })

  it("WHATSAPP type should handle wa.me domain (allowed external)", () => {
    const result = resolveDestination(makeQR({ type: "WHATSAPP", destinationUrl: "https://wa.me/123456789" }))
    expect(result).toBe("https://wa.me/123456789")
  })

  it("WIFI type should return /wifi/[shortCode]", () => {
    const result = resolveDestination(makeQR({ type: "WIFI", shortCode: "wifi99" }))
    expect(result).toBe("/wifi/wifi99")
  })

  it("LANDING_PAGE type should return /l/[shortCode]", () => {
    const result = resolveDestination(makeQR({ type: "LANDING_PAGE", shortCode: "land123" }))
    expect(result).toBe("/l/land123")
  })

  it("VCARD type should return /view/[shortCode]", () => {
    const result = resolveDestination(makeQR({ type: "VCARD", shortCode: "vcard1" }))
    expect(result).toBe("/view/vcard1")
  })

  it("PDF type should return /view/[shortCode]", () => {
    const result = resolveDestination(makeQR({ type: "PDF", shortCode: "pdf123" }))
    expect(result).toBe("/view/pdf123")
  })

  it("TEXT type should return /view/[shortCode]", () => {
    const result = resolveDestination(makeQR({ type: "TEXT", shortCode: "txt123" }))
    expect(result).toBe("/view/txt123")
  })

  it("should return /qr-deleted when deletedAt is set", () => {
    const qr = { ...makeQR({ type: "URL", destinationUrl: "https://example.com" }), deletedAt: new Date() }
    const result = resolveDestination(qr)
    expect(result).toBe("/qr-deleted")
  })
})
