import { describe, it, expect } from "vitest"
import { emailSchema, urlSchema, safeUrlSchema, hexColorSchema, QRCreateSchema, QRUpdateSchema, frameTypeSchema } from "@/lib/validations"

describe("emailSchema", () => {
  it("should accept valid emails", () => {
    expect(emailSchema.parse("test@example.com")).toBe("test@example.com")
    expect(emailSchema.parse("user+tag@domain.co")).toBe("user+tag@domain.co")
  })

  it("should reject invalid emails", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow()
    expect(() => emailSchema.parse("")).toThrow()
    expect(() => emailSchema.parse("@domain.com")).toThrow()
  })
})

describe("urlSchema", () => {
  it("should accept valid URLs", () => {
    expect(urlSchema.parse("https://example.com")).toBe("https://example.com")
    expect(urlSchema.parse("http://localhost:3000/path")).toBe("http://localhost:3000/path")
  })

  it("should reject invalid URLs", () => {
    expect(() => urlSchema.parse("not-a-url")).toThrow()
    expect(() => urlSchema.parse("")).toThrow()
  })
})

describe("safeUrlSchema", () => {
  it("should accept valid HTTP URLs", () => {
    expect(safeUrlSchema.parse("http://example.com")).toBe("http://example.com")
    expect(safeUrlSchema.parse("http://localhost:3000/path")).toBe("http://localhost:3000/path")
  })

  it("should accept valid HTTPS URLs", () => {
    expect(safeUrlSchema.parse("https://example.com")).toBe("https://example.com")
    expect(safeUrlSchema.parse("https://api.qrstudio.app/v1/data")).toBe("https://api.qrstudio.app/v1/data")
  })

  it("should reject non-HTTP protocols (file://)", () => {
    expect(() => safeUrlSchema.parse("file:///etc/passwd")).toThrow()
  })

  it("should reject non-HTTP protocols (ftp://)", () => {
    expect(() => safeUrlSchema.parse("ftp://evil.com/file")).toThrow()
  })

  it("should reject javascript: URLs", () => {
    expect(() => safeUrlSchema.parse("javascript:alert(1)")).toThrow()
  })

  it("should reject invalid URL strings", () => {
    expect(() => safeUrlSchema.parse("not-a-url")).toThrow()
    expect(() => safeUrlSchema.parse("")).toThrow()
  })
})

describe("hexColorSchema", () => {
  it("should accept valid hex colors", () => {
    expect(hexColorSchema.parse("#000000")).toBe("#000000")
    expect(hexColorSchema.parse("#FFFFFF")).toBe("#FFFFFF")
    expect(hexColorSchema.parse("#ABC123")).toBe("#ABC123")
    expect(hexColorSchema.parse("#abc123")).toBe("#abc123")
  })

  it("should reject invalid hex colors", () => {
    expect(() => hexColorSchema.parse("#GGGGGG")).toThrow()
    expect(() => hexColorSchema.parse("000000")).toThrow()
    expect(() => hexColorSchema.parse("#12345")).toThrow()
    expect(() => hexColorSchema.parse("")).toThrow()
  })
})

describe("QRCreateSchema", () => {
  it("should accept a valid URL type input", () => {
    const result = QRCreateSchema.parse({
      workspaceId: "ws-1",
      name: "My QR",
      type: "URL",
      destinationUrl: "https://example.com",
    })
    expect(result.name).toBe("My QR")
    expect(result.type).toBe("URL")
  })

  it("should accept a valid WHATSAPP type input (without destinationUrl)", () => {
    const result = QRCreateSchema.parse({
      workspaceId: "ws-1",
      name: "WhatsApp QR",
      type: "WHATSAPP",
    })
    expect(result.type).toBe("WHATSAPP")
  })

  it("should accept WIFI with required fields", () => {
    const result = QRCreateSchema.parse({
      workspaceId: "ws-1",
      name: "WiFi QR",
      type: "WIFI",
      wifi: { ssid: "MyNetwork", encryption: "WPA" },
    })
    expect(result.type).toBe("WIFI")
    expect(result.wifi?.ssid).toBe("MyNetwork")
  })

  it("should accept VCARD with required fields", () => {
    const result = QRCreateSchema.parse({
      workspaceId: "ws-1",
      name: "VCard QR",
      type: "VCARD",
      vcard: { firstName: "John", lastName: "Doe" },
    })
    expect(result.type).toBe("VCARD")
    expect(result.vcard?.firstName).toBe("John")
  })

  it("should accept LANDING_PAGE with required fields", () => {
    const result = QRCreateSchema.parse({
      workspaceId: "ws-1",
      name: "Landing QR",
      type: "LANDING_PAGE",
      landingPage: { title: "My Page" },
    })
    expect(result.type).toBe("LANDING_PAGE")
    expect(result.landingPage?.title).toBe("My Page")
  })

  it("should reject without workspaceId", () => {
    expect(() =>
      QRCreateSchema.parse({
        name: "Test",
        type: "URL",
        destinationUrl: "https://example.com",
      })
    ).toThrow()
  })

  it("should reject empty name", () => {
    expect(() =>
      QRCreateSchema.parse({
        workspaceId: "ws-1",
        name: "",
        type: "URL",
        destinationUrl: "https://example.com",
      })
    ).toThrow()
  })

  it("should reject invalid frameType (path traversal attempt)", () => {
    expect(() =>
      QRCreateSchema.parse({
        workspaceId: "ws-1",
        name: "Test QR",
        type: "URL",
        destinationUrl: "https://example.com",
        frameType: "../../etc/passwd",
      })
    ).toThrow()

    expect(() =>
      QRCreateSchema.parse({
        workspaceId: "ws-1",
        name: "Test QR",
        type: "URL",
        destinationUrl: "https://example.com",
        frameType: "..%2F..%2Fetc%2Fpasswd",
      })
    ).toThrow()

    expect(() =>
      QRCreateSchema.parse({
        workspaceId: "ws-1",
        name: "Test QR",
        type: "URL",
        destinationUrl: "https://example.com",
        frameType: "null",
      })
    ).toThrow()
  })

  it("should accept valid frameType values", () => {
    const validFrameTypes = ['1', '2', '3', '4', '5', '6', 'bold', 'dashed', 'elegant', 'minimal', 'neon', 'rounded']
    for (const frameType of validFrameTypes) {
      const result = QRCreateSchema.parse({
        workspaceId: "ws-1",
        name: "Test QR",
        type: "URL",
        destinationUrl: "https://example.com",
        frameType,
      })
      expect(result.frameType).toBe(frameType)
    }
  })

  it("should accept absence of frameType (optional)", () => {
    const result = QRCreateSchema.parse({
      workspaceId: "ws-1",
      name: "Test QR",
      type: "URL",
      destinationUrl: "https://example.com",
    })
    expect(result.frameType).toBeUndefined()
  })
})

describe("QRUpdateSchema — frameType validation", () => {
  it("should reject invalid frameType in update", () => {
    expect(() =>
      QRUpdateSchema.parse({
        frameType: "../../etc/shadow",
      })
    ).toThrow()
  })

  it("should reject path traversal patterns in update", () => {
    expect(() =>
      QRUpdateSchema.parse({
        frameType: "..\\..\\windows\\system32",
      })
    ).toThrow()
  })

  it("should accept valid frameType in update", () => {
    const validFrameTypes = ['1', '2', '3', '4', '5', '6', 'bold', 'dashed', 'elegant', 'minimal', 'neon', 'rounded']
    for (const frameType of validFrameTypes) {
      const result = QRUpdateSchema.parse({ frameType })
      expect(result.frameType).toBe(frameType)
    }
  })

  it("should accept absence of frameType in update (optional)", () => {
    const result = QRUpdateSchema.parse({ name: "Just rename" })
    expect(result.frameType).toBeUndefined()
  })
})

describe("frameTypeSchema", () => {
  it("should reject path traversal strings", () => {
    expect(() => frameTypeSchema.parse("../../../etc/passwd")).toThrow()
    expect(() => frameTypeSchema.parse("..\\..\\..\\windows\\win.ini")).toThrow()
    expect(() => frameTypeSchema.parse("%2e%2e%2f%2e%2e%2f")).toThrow()
    expect(() => frameTypeSchema.parse("....//....//etc/passwd")).toThrow()
    expect(() => frameTypeSchema.parse("....\\\\....\\\\windows\\system32")).toThrow()
  })

  it("should accept all valid frame types", () => {
    expect(frameTypeSchema.parse("minimal")).toBe("minimal")
    expect(frameTypeSchema.parse("dashed")).toBe("dashed")
    expect(frameTypeSchema.parse("neon")).toBe("neon")
  })
})
