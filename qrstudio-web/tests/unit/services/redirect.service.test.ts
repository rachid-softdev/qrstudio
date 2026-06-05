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
  }
}

describe("resolveDestination", () => {
  it("URL type should return destinationUrl directly", () => {
    const result = resolveDestination(makeQR({ type: "URL", destinationUrl: "https://example.com" }))
    expect(result).toBe("https://example.com")
  })

  it("URL type should return '/' if destinationUrl is null", () => {
    const result = resolveDestination(makeQR({ type: "URL", destinationUrl: null }))
    expect(result).toBe("/")
  })

  it("WHATSAPP type should return wa.me link with cleaned phone", () => {
    const result = resolveDestination(makeQR({ type: "WHATSAPP", destinationUrl: "+33 6 12 34 56 78" }))
    expect(result).toBe("https://wa.me/33612345678")
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
})
