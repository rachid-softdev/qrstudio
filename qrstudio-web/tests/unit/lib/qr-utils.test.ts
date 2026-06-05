import { describe, it, expect } from "vitest"
import { computeQRData } from "@/lib/qr-utils"
import type { QRType } from "@/types/index"

describe("computeQRData", () => {
  describe("URL type", () => {
    it("should return destinationUrl as-is", () => {
      const result = computeQRData("URL", { destinationUrl: "https://example.com" })
      expect(result).toBe("https://example.com")
    })

    it("should return empty string when destinationUrl is missing", () => {
      const result = computeQRData("URL", {})
      expect(result).toBe("")
    })
  })

  describe("WHATSAPP type", () => {
    it("should return wa.me link with cleaned phone number", () => {
      const result = computeQRData("WHATSAPP", { destinationUrl: "+33 6 12 34 56 78" })
      expect(result).toBe("https://wa.me/33612345678")
    })

    it("should return wa.me link with digits-only phone", () => {
      const result = computeQRData("WHATSAPP", { destinationUrl: "33612345678" })
      expect(result).toBe("https://wa.me/33612345678")
    })

    it("should return empty string when destinationUrl is missing", () => {
      const result = computeQRData("WHATSAPP", {})
      expect(result).toBe("https://wa.me/")
    })
  })

  describe("WIFI type", () => {
    it("should generate WIFI config with all fields", () => {
      const result = computeQRData("WIFI", {
        wifi: { ssid: "MyNetwork", password: "secret123", encryption: "WPA" },
      })
      expect(result).toContain("WIFI:T:WPA")
      expect(result).toContain("S:MyNetwork")
      expect(result).toContain("P:secret123")
    })

    it("should generate WIFI config without password", () => {
      const result = computeQRData("WIFI", {
        wifi: { ssid: "GuestNet", encryption: "WPA2" },
      })
      expect(result).toContain("WIFI:T:WPA2")
      expect(result).toContain("S:GuestNet")
      expect(result).not.toContain("P:")
    })

    it("should use nopass when encryption is missing", () => {
      const result = computeQRData("WIFI", {
        wifi: { ssid: "OpenNet" },
      })
      expect(result).toContain("WIFI:T:nopass")
    })

    it("should return empty string when wifi block is missing", () => {
      const result = computeQRData("WIFI", {})
      expect(result).toBe("")
    })

    it("should return empty string when ssid is missing", () => {
      const result = computeQRData("WIFI", { wifi: {} })
      expect(result).toBe("")
    })
  })

  describe("VCARD type", () => {
    it("should generate Vcard with all fields", () => {
      const result = computeQRData("VCARD", {
        vcard: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "+33123456789",
          company: "ACME",
          website: "https://acme.com",
        },
      })

      expect(result).toContain("BEGIN:VCARD")
      expect(result).toContain("VERSION:3.0")
      expect(result).toContain("FN:John Doe")
      expect(result).toContain("N:Doe;John;;;")
      expect(result).toContain("EMAIL:john@example.com")
      expect(result).toContain("TEL:+33123456789")
      expect(result).toContain("ORG:ACME")
      expect(result).toContain("URL:https://acme.com")
      expect(result).toContain("END:VCARD")
    })

    it("should generate Vcard with only firstName", () => {
      const result = computeQRData("VCARD", {
        vcard: { firstName: "Alice" },
      })
      expect(result).toContain("FN:Alice")
      expect(result).toContain("N:;Alice;;;")
    })

    it("should generate Vcard with only lastName", () => {
      const result = computeQRData("VCARD", {
        vcard: { lastName: "Smith" },
      })
      expect(result).toContain("FN: Smith")
      expect(result).toContain("N:Smith;;;")
    })

    it("should return empty string when firstName and lastName are missing", () => {
      const result = computeQRData("VCARD", { vcard: { email: "test@test.com" } })
      expect(result).toBe("")
    })

    it("should return empty string when vcard block is missing", () => {
      const result = computeQRData("VCARD", {})
      expect(result).toBe("")
    })
  })

  describe("PDF type", () => {
    it("should return destinationUrl for PDF", () => {
      const result = computeQRData("PDF", { destinationUrl: "https://files.example.com/doc.pdf" })
      expect(result).toBe("https://files.example.com/doc.pdf")
    })

    it("should return empty string when destinationUrl is missing", () => {
      const result = computeQRData("PDF", {})
      expect(result).toBe("")
    })
  })

  describe("TEXT type", () => {
    it("should return textContent as-is", () => {
      const result = computeQRData("TEXT", { textContent: "Hello World!" })
      expect(result).toBe("Hello World!")
    })

    it("should return empty string when textContent is missing", () => {
      const result = computeQRData("TEXT", {})
      expect(result).toBe("")
    })
  })

  describe("LANDING_PAGE type", () => {
    it("should return a string starting with page_", () => {
      const result = computeQRData("LANDING_PAGE", { landingPage: { title: "My Page" } })
      expect(result).toMatch(/^page_\d{13}$/)
    })
  })

  describe("edge cases", () => {
    it("should return undefined for unknown QR type", () => {
      const result = computeQRData("UNKNOWN" as QRType, {})
      expect(result).toBeUndefined()
    })

    it("should handle nullish content gracefully", () => {
      const result = computeQRData("URL", { destinationUrl: null })
      expect(result).toBe("")
    })

    it("should handle missing content fields for WHATSAPP", () => {
      const result = computeQRData("WHATSAPP", { destinationUrl: undefined })
      expect(result).toBe("https://wa.me/")
    })
  })
})
