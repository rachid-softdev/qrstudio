import { describe, it, expect, beforeEach } from "vitest"

// All functions are pure — no mocking needed
import {
  prepareQRData,
  toMetadata,
  toQRDataInput,
  prepareQRDataForUpdate,
} from "@/lib/qr-formatters"
import type { QRUpdateInput } from "@/lib/validations"

// ──────────────────────────────────────────────
// prepareQRData — covers ALL QR types
// ──────────────────────────────────────────────
describe("prepareQRData", () => {
  it("URL type should return destinationUrl directly", () => {
    expect(prepareQRData({ type: "URL", destinationUrl: "https://example.com" }, "abc123")).toBe(
      "https://example.com",
    )
  })

  it("URL type should return empty string if destinationUrl missing", () => {
    expect(prepareQRData({ type: "URL" }, "abc123")).toBe("")
  })

  it("URL type should handle null destinationUrl", () => {
    expect(prepareQRData({ type: "URL", destinationUrl: null }, "abc123")).toBe("")
  })

  it("WHATSAPP type should strip non-digits and build wa.me URL", () => {
    expect(prepareQRData({ type: "WHATSAPP", destinationUrl: "+33 6 12 34 56 78" }, "abc123")).toBe(
      "https://wa.me/33612345678",
    )
  })

  it("WHATSAPP type should handle already-clean phone number", () => {
    expect(prepareQRData({ type: "WHATSAPP", destinationUrl: "0612345678" }, "abc123")).toBe(
      "https://wa.me/0612345678",
    )
  })

  it("WHATSAPP type should return wa.me/ for empty input", () => {
    expect(prepareQRData({ type: "WHATSAPP", destinationUrl: "" }, "abc123")).toBe(
      "https://wa.me/",
    )
  })

  it("WHATSAPP type should return wa.me/ for undefined destinationUrl", () => {
    expect(prepareQRData({ type: "WHATSAPP" }, "abc123")).toBe("https://wa.me/")
  })

  it("WIFI type should format correctly with WPA and password", () => {
    const result = prepareQRData(
      {
        type: "WIFI",
        wifi: { ssid: "HomeNet", password: "secret123", encryption: "WPA" },
      },
      "abc123",
    )
    // formatWifiString appends a trailing ';' after the password section
    expect(result).toContain("WIFI:T:WPA;")
    expect(result).toContain("S:HomeNet;")
    expect(result).toContain("P:secret123;")
  })

  it("WIFI type should format correctly with nopass", () => {
    const result = prepareQRData(
      {
        type: "WIFI",
        wifi: { ssid: "GuestNet", encryption: "nopass" },
      },
      "abc123",
    )
    expect(result).toContain("WIFI:T:nopass;")
    expect(result).toContain("S:GuestNet;")
  })

  it("WIFI type should default to nopass when encryption is undefined", () => {
    const result = prepareQRData(
      {
        type: "WIFI",
        wifi: { ssid: "OpenNet" },
      },
      "abc123",
    )
    expect(result).toContain("WIFI:T:nopass;")
    expect(result).toContain("S:OpenNet;")
  })

  it("WIFI type should handle missing wifi object gracefully", () => {
    const result = prepareQRData({ type: "WIFI" }, "abc123")
    expect(result).toContain("WIFI:T:nopass;")
    expect(result).toContain("S:;")
  })

  it("VCARD type should format full vcard correctly", () => {
    const result = prepareQRData(
      {
        type: "VCARD",
        vcard: {
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          phone: "+33612345678",
          company: "ACME",
          website: "https://acme.com",
        },
      },
      "abc123",
    )
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

  it("VCARD type should handle minimal vcard (firstName only)", () => {
    const result = prepareQRData(
      { type: "VCARD", vcard: { firstName: "Jane", lastName: "Smith" } },
      "abc123",
    )
    expect(result).toContain("BEGIN:VCARD")
    expect(result).toContain("FN:Jane Smith")
    expect(result).toContain("N:Smith;Jane;;;")
    expect(result).toContain("END:VCARD")
  })

  it("VCARD type should return empty string if vcard is undefined", () => {
    expect(prepareQRData({ type: "VCARD" }, "abc123")).toBe("")
  })

  it("VCARD type should handle empty vcard object", () => {
    const result = prepareQRData({ type: "VCARD", vcard: {} }, "abc123")
    expect(result).toContain("BEGIN:VCARD")
    expect(result).toContain("END:VCARD")
  })

  it("PDF type should return destinationUrl directly", () => {
    expect(
      prepareQRData({ type: "PDF", destinationUrl: "https://example.com/doc.pdf" }, "abc123"),
    ).toBe("https://example.com/doc.pdf")
  })

  it("PDF type should return empty string if destinationUrl missing", () => {
    expect(prepareQRData({ type: "PDF" }, "abc123")).toBe("")
  })

  it("TEXT type should return textContent directly", () => {
    expect(prepareQRData({ type: "TEXT", textContent: "Hello World" }, "abc123")).toBe("Hello World")
  })

  it("TEXT type should return empty string if textContent missing", () => {
    expect(prepareQRData({ type: "TEXT" }, "abc123")).toBe("")
  })

  it("TEXT type should handle null textContent", () => {
    expect(prepareQRData({ type: "TEXT", textContent: null }, "abc123")).toBe("")
  })

  it("LANDING_PAGE type should return app URL with shortCode", () => {
    const result = prepareQRData({ type: "LANDING_PAGE" }, "land123")
    expect(result).toBe("http://localhost:3000/l/land123")
  })

  it("LANDING_PAGE type should use NEXT_PUBLIC_APP_URL when set", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = "https://app.qrstudio.com"
    const result = prepareQRData({ type: "LANDING_PAGE" }, "xyz789")
    expect(result).toBe("https://app.qrstudio.com/l/xyz789")
    process.env.NEXT_PUBLIC_APP_URL = prev
  })

  it("unknown type should return empty string", () => {
    expect(prepareQRData({ type: "UNKNOWN" as never }, "abc123")).toBe("")
  })
})

// ──────────────────────────────────────────────
// toMetadata
// ──────────────────────────────────────────────
describe("toMetadata", () => {
  it("should include destinationUrl when present", () => {
    const result = toMetadata({ destinationUrl: "https://example.com" })
    expect(result).toEqual({ destinationUrl: "https://example.com" })
  })

  it("should exclude destinationUrl when undefined", () => {
    const result = toMetadata({})
    expect(result).not.toHaveProperty("destinationUrl")
  })

  it("should exclude destinationUrl when null", () => {
    const result = toMetadata({ destinationUrl: null })
    expect(result).not.toHaveProperty("destinationUrl")
  })

  it("should skip wifi when undefined (not included in metadata)", () => {
    const result = toMetadata({ wifi: undefined })
    expect(result).not.toHaveProperty("wifi")
  })

  it("should include wifi when set", () => {
    const result = toMetadata({ wifi: { ssid: "Net", password: "pw" } })
    expect(result).toEqual({ wifi: { ssid: "Net", password: "pw" } })
  })

  it("should include wifi when explicitly null", () => {
    const result = toMetadata({ wifi: null })
    expect(result).toEqual({ wifi: null })
  })

  it("should skip vcard when undefined (not included in metadata)", () => {
    const result = toMetadata({ vcard: undefined })
    expect(result).not.toHaveProperty("vcard")
  })

  it("should include vcard when set", () => {
    const result = toMetadata({ vcard: { firstName: "John" } })
    expect(result).toEqual({ vcard: { firstName: "John" } })
  })

  it("should include vcard when explicitly null", () => {
    const result = toMetadata({ vcard: null })
    expect(result).toEqual({ vcard: null })
  })

  it("should include textContent when present", () => {
    const result = toMetadata({ textContent: "Hello" })
    expect(result).toEqual({ textContent: "Hello" })
  })

  it("should exclude textContent when undefined", () => {
    const result = toMetadata({})
    expect(result).not.toHaveProperty("textContent")
  })

  it("should exclude textContent when null", () => {
    const result = toMetadata({ textContent: null })
    expect(result).not.toHaveProperty("textContent")
  })

  it("should combine multiple fields", () => {
    const result = toMetadata({
      destinationUrl: "https://example.com",
      textContent: "Hello",
      wifi: null,
    })
    expect(result).toEqual({
      destinationUrl: "https://example.com",
      textContent: "Hello",
      wifi: null,
    })
  })

  it("should return empty object for empty input", () => {
    const result = toMetadata({})
    expect(result).toEqual({})
  })
})

// ──────────────────────────────────────────────
// toQRDataInput
// ──────────────────────────────────────────────
describe("toQRDataInput", () => {
  it("should convert a URL entity to QRDataInput", () => {
    const result = toQRDataInput({
      type: "URL",
      metadata: { destinationUrl: "https://example.com" },
    })
    expect(result).toEqual({
      type: "URL",
      destinationUrl: "https://example.com",
      wifi: undefined,
      vcard: undefined,
      textContent: undefined,
    })
  })

  it("should convert a WIFI entity to QRDataInput", () => {
    const result = toQRDataInput({
      type: "WIFI",
      metadata: { wifi: { ssid: "Home", password: "pass", encryption: "WPA" } },
    })
    expect(result).toEqual({
      type: "WIFI",
      destinationUrl: undefined,
      wifi: { ssid: "Home", password: "pass", encryption: "WPA" },
      vcard: undefined,
      textContent: undefined,
    })
  })

  it("should convert a VCARD entity to QRDataInput", () => {
    const result = toQRDataInput({
      type: "VCARD",
      metadata: { vcard: { firstName: "Jane", lastName: "Doe" } },
    })
    expect(result).toEqual({
      type: "VCARD",
      destinationUrl: undefined,
      wifi: undefined,
      vcard: { firstName: "Jane", lastName: "Doe" },
      textContent: undefined,
    })
  })

  it("should convert a TEXT entity to QRDataInput", () => {
    const result = toQRDataInput({
      type: "TEXT",
      metadata: { textContent: "Hello World" },
    })
    expect(result).toEqual({
      type: "TEXT",
      destinationUrl: undefined,
      wifi: undefined,
      vcard: undefined,
      textContent: "Hello World",
    })
  })

  it("should handle null metadata gracefully", () => {
    const result = toQRDataInput({ type: "URL", metadata: null })
    expect(result).toEqual({
      type: "URL",
      destinationUrl: undefined,
      wifi: undefined,
      vcard: undefined,
      textContent: undefined,
    })
  })

  it("should handle missing metadata fields gracefully", () => {
    const result = toQRDataInput({ type: "URL", metadata: {} })
    expect(result).toEqual({
      type: "URL",
      destinationUrl: undefined,
      wifi: undefined,
      vcard: undefined,
      textContent: undefined,
    })
  })

  it("should handle LANDING_PAGE type", () => {
    const result = toQRDataInput({ type: "LANDING_PAGE", metadata: {} })
    expect(result.type).toBe("LANDING_PAGE")
  })
})

// ──────────────────────────────────────────────
// prepareQRDataForUpdate
// ──────────────────────────────────────────────
describe("prepareQRDataForUpdate", () => {
  it("URL type should use data.destinationUrl when provided", () => {
    const result = prepareQRDataForUpdate(
      { type: "URL", metadata: { destinationUrl: "https://old.com" } },
      { destinationUrl: "https://new.com" },
    )
    expect(result).toBe("https://new.com")
  })

  it("URL type should fall back to existing metadata when no new data", () => {
    const result = prepareQRDataForUpdate(
      { type: "URL", metadata: { destinationUrl: "https://old.com" } },
      {},
    )
    expect(result).toBe("https://old.com")
  })

  it("URL type should return empty string when nothing available", () => {
    const result = prepareQRDataForUpdate({ type: "URL", metadata: {} }, {})
    expect(result).toBe("")
  })

  it("WHATSAPP type should use data when provided", () => {
    const result = prepareQRDataForUpdate(
      { type: "WHATSAPP", metadata: { destinationUrl: "+33 6 12 34 56 78" } },
      {},
    )
    expect(result).toBe("https://wa.me/33612345678")
  })

  it("WHATSAPP type should handle new phone number in data", () => {
    const result = prepareQRDataForUpdate(
      { type: "WHATSAPP", metadata: { destinationUrl: "0612345678" } },
      { destinationUrl: "+33 7 98 76 54 32" },
    )
    expect(result).toBe("https://wa.me/33798765432")
  })

  it("WIFI type should use data when provided", () => {
    const result = prepareQRDataForUpdate(
      {
        type: "WIFI",
        metadata: { wifi: { ssid: "OldNet", password: "oldpass", encryption: "WPA" } },
      },
      { wifi: { ssid: "NewNet", password: "newpass", encryption: "WEP" } },
    )
    expect(result).toContain("WIFI:T:WEP;")
    expect(result).toContain("S:NewNet;")
    expect(result).toContain("P:newpass;")
  })

  it("WIFI type should fall back to existing metadata", () => {
    const result = prepareQRDataForUpdate(
      {
        type: "WIFI",
        metadata: { wifi: { ssid: "OldNet", password: "oldpass", encryption: "WPA" } },
      },
      {},
    )
    expect(result).toContain("WIFI:T:WPA;")
    expect(result).toContain("S:OldNet;")
    expect(result).toContain("P:oldpass;")
  })

  it("WIFI type should default to nopass when no encryption in metadata", () => {
    const result = prepareQRDataForUpdate(
      {
        type: "WIFI",
        metadata: { wifi: { ssid: "OpenNet" } },
      },
      {},
    )
    expect(result).toContain("WIFI:T:nopass;")
    expect(result).toContain("S:OpenNet;")
  })

  it("VCARD type should use data when provided", () => {
    const result = prepareQRDataForUpdate(
      {
        type: "VCARD",
        metadata: { vcard: { firstName: "John", lastName: "Doe" } },
      },
      { vcard: { firstName: "Jane", lastName: "Smith" } },
    )
    expect(result).toContain("FN:Jane Smith")
    expect(result).toContain("N:Smith;Jane;;;")
  })

  it("VCARD type should fall back to existing metadata", () => {
    const result = prepareQRDataForUpdate(
      {
        type: "VCARD",
        metadata: { vcard: { firstName: "John", lastName: "Doe", email: "john@test.com" } },
      },
      {},
    )
    expect(result).toContain("FN:John Doe")
    expect(result).toContain("EMAIL:john@test.com")
  })

  it("VCARD type should return empty string when no vcard in data or metadata", () => {
    const result = prepareQRDataForUpdate({ type: "VCARD", metadata: {} }, {})
    expect(result).toBe("")
  })

  it("PDF type should use data.destinationUrl when provided", () => {
    const result = prepareQRDataForUpdate(
      { type: "PDF", metadata: { destinationUrl: "https://old.com/doc.pdf" } },
      { destinationUrl: "https://new.com/doc.pdf" },
    )
    expect(result).toBe("https://new.com/doc.pdf")
  })

  it("PDF type should fall back to existing metadata", () => {
    const result = prepareQRDataForUpdate(
      { type: "PDF", metadata: { destinationUrl: "https://old.com/doc.pdf" } },
      {},
    )
    expect(result).toBe("https://old.com/doc.pdf")
  })

  it("TEXT type should use data.textContent when provided", () => {
    const result = prepareQRDataForUpdate(
      { type: "TEXT", metadata: { textContent: "Old text" } },
      { textContent: "New text" },
    )
    expect(result).toBe("New text")
  })

  it("TEXT type should fall back to existing metadata", () => {
    const result = prepareQRDataForUpdate(
      { type: "TEXT", metadata: { textContent: "Old text" } },
      {},
    )
    expect(result).toBe("Old text")
  })

  it("LANDING_PAGE type should use shortCode from existing", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = "https://app.qrstudio.com"
    const result = prepareQRDataForUpdate(
      { type: "LANDING_PAGE", shortCode: "lp123", metadata: {} },
      {},
    )
    expect(result).toBe("https://app.qrstudio.com/l/lp123")
    process.env.NEXT_PUBLIC_APP_URL = prev
  })

  it("LANDING_PAGE type should use 'unknown' when shortCode missing", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = "https://app.qrstudio.com"
    const result = prepareQRDataForUpdate({ type: "LANDING_PAGE", metadata: {} }, {})
    expect(result).toBe("https://app.qrstudio.com/l/unknown")
    process.env.NEXT_PUBLIC_APP_URL = prev
  })
})
