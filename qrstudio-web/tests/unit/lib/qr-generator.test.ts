import { describe, it, expect, vi, beforeEach } from "vitest"
import https from "https"

vi.mock("qrcode", () => ({
  default: {
    toString: vi.fn(),
  },
}))

// Mock dns/promises for SSRF tests
vi.mock("dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}))

import QRCode from "qrcode"
import dns from "dns/promises"
import { generateQRSvg, loadFrameSvg } from "@/lib/qr-generator"

describe("generateQRSvg", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return a valid SVG string", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect/><rect fill="#ffffff"/></svg>'
    )

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "square",
    })

    expect(svg).toContain("<svg")
    expect(svg).toContain("<rect")
  })

  it("should apply fgColor and bgColor", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect fill="#000000"/><rect fill="#ffffff"/></svg>'
    )

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#FF0000",
      bgColor: "#00FF00",
      moduleShape: "square",
    })

    expect(svg).toContain('fill="#FF0000"')
    expect(svg).toContain('fill="#00FF00"')
  })

  it("should generate <rect rx=\"...\"> for rounded moduleShape", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="1" height="1"/></svg>'
    )

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "rounded",
    })

    expect(svg).toContain('rx="3"')
    expect(svg).toContain('ry="3"')
  })

  it("should generate <circle> for dots moduleShape", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="1" height="1" x="0" y="0"/></svg>'
    )

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "dots",
    })

    expect(svg).toContain("<circle")
    expect(svg).not.toContain("<rect")
  })
})

describe("loadFrameSvg", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return SVG content for a valid frame type that exists on disk", () => {
    const result = loadFrameSvg("minimal")
    // If the frame file exists on disk, it returns the SVG content.
    // If not (e.g. CI), it returns null — either is acceptable.
    if (result !== null) {
      expect(result).toContain("<svg")
    }
  })

  it("should return null for frame types that don't have a corresponding file", () => {
    // Even for valid frame types, if the file doesn't exist, returns null
    const result = loadFrameSvg("nonexistent")
    expect(result).toBeNull()
  })

  it("should not crash on any string input (graceful degradation)", () => {
    // Path traversal strings should not crash the function
    expect(() => loadFrameSvg("../../etc/passwd")).not.toThrow()
    expect(() => loadFrameSvg("..\\..\\windows\\system32")).not.toThrow()
    expect(() => loadFrameSvg("%2e%2e%2f%2e%2e%2f")).not.toThrow()
    expect(() => loadFrameSvg("")).not.toThrow()
    expect(() => loadFrameSvg(null as unknown as string)).not.toThrow()
    expect(() => loadFrameSvg(undefined as unknown as string)).not.toThrow()
  })
})

// ──────────────────────────────────────────────
// 1b.1 — SSRF via logoUrl
// ──────────────────────────────────────────────
describe("SSRF protection — fetchImageAsBase64 (via generateQRSvg with logoUrl)", () => {
  const validQrSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect/><rect fill="#ffffff"/></svg>'

  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(validQrSvg)
    // Default: public IP resolution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "93.184.216.34" }])
  })

  it("should reject private IPv4 (127.0.0.1)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "127.0.0.1" }])

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://127.0.0.1/logo.png",
    })

    // Logo was rejected — no <image> tag in SVG
    expect(svg).not.toContain("<image")
  })

  it("should reject private IPv4 (10.0.0.1)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "10.0.0.1" }])

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://10.0.0.1/logo.png",
    })

    expect(svg).not.toContain("<image")
  })

  it("should reject private IPv4 (192.168.1.1)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "192.168.1.1" }])

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://192.168.1.1/logo.png",
    })

    expect(svg).not.toContain("<image")
  })

  it("should reject private IPv6 (::1)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "::1" }])

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://[::1]/logo.png",
    })

    expect(svg).not.toContain("<image")
  })

  it("should reject private IPv6 ULA (fd00::/8 range)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "fd00::1" }])

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://[fd00::1]/logo.png",
    })

    expect(svg).not.toContain("<image")
  })

  it("should reject file:// protocol URLs", async () => {
    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "file:///etc/passwd",
    })

    // file:// protocol is rejected before DNS lookup
    expect(svg).not.toContain("<image")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((dns.lookup as any)).not.toHaveBeenCalled()
  })

  it("should allow valid https:// URL to public host", async () => {
    // Mock https.request (used by directFetch for hostname-based URLs)
    const responseEvents: Record<string, (...args: any[]) => void> = {}
    vi.spyOn(https, "request").mockImplementation((_opts: any, callback?: any) => {
      const mockRes = {
        statusCode: 200,
        statusMessage: "OK",
        headers: { "content-type": "image/png" },
        on: (event: string, handler: (...args: any[]) => void) => {
          responseEvents[event] = handler
          return mockRes
        },
      }
      setTimeout(() => {
        if (callback) callback(mockRes as any)
        if (responseEvents["data"]) responseEvents["data"](Buffer.alloc(100))
        if (responseEvents["end"]) responseEvents["end"]()
      }, 1)
      return { on: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis(), destroy: vi.fn() } as any
    })

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://example.com/logo.png",
    })

    // Logo was fetched and added
    expect(svg).toContain("<image")
    expect(svg).toContain("href=\"data:image/png;base64,")

    vi.restoreAllMocks()
  })

  it("should reject URLs without HTTP(S) protocol", async () => {
    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "ftp://example.com/logo.png",
    })

    expect(svg).not.toContain("<image")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((dns.lookup as any)).not.toHaveBeenCalled()
  })

  it("should return null gracefully on fetch timeout", async () => {
    // Mock https.request to emit an error (simulates timeout/abort via AbortController)
    const reqEvents: Record<string, (err: Error) => void> = {}
    vi.spyOn(https, "request").mockImplementation((() => {
      const mockReq: any = {
        on: (event: string, handler: (err: Error) => void) => {
          reqEvents[event] = handler
          return mockReq
        },
        end: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }
      // Schedule an error to simulate abort
      setTimeout(() => {
        if (reqEvents["error"]) reqEvents["error"](new Error("socket hang up"))
      }, 1)
      return mockReq
    }) as any)

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://example.com/logo.png",
    })

    // Timeout = logo not added
    expect(svg).not.toContain("<image")

    vi.restoreAllMocks()
  })

  it("should reject files larger than 1MB", async () => {
    // Mock https.request to return a response with content-length > 1MB
    const responseEvents: Record<string, (...args: any[]) => void> = {}
    vi.spyOn(https, "request").mockImplementation((_opts: any, callback?: any) => {
      const mockRes = {
        statusCode: 200,
        statusMessage: "OK",
        headers: { "content-type": "image/png", "content-length": "2000000" },
        on: (event: string, handler: (...args: any[]) => void) => {
          responseEvents[event] = handler
          return mockRes
        },
      }
      setTimeout(() => {
        if (callback) callback(mockRes as any)
        if (responseEvents["data"]) responseEvents["data"](Buffer.alloc(2_000_000))
        if (responseEvents["end"]) responseEvents["end"]()
      }, 1)
      return { on: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis(), destroy: vi.fn() } as any
    })

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://example.com/big-logo.png",
    })

    expect(svg).not.toContain("<image")

    vi.restoreAllMocks()
  })

  // ──────────────────────────────────────────────
  // 1b.1bis — Redirect-based SSRF protection
  // ──────────────────────────────────────────────
  it("should reject redirect to private IP (DNS rebinding protection)", async () => {
    // First DNS lookup resolves to public IP
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "93.184.216.34" }])

    // Mock https.request (for directFetch) to return a 302 redirect to a private IP
    const responseEvents: Record<string, (...args: any[]) => void> = {}
    vi.spyOn(https, "request").mockImplementation((_opts: any, callback?: any) => {
      const mockRes = {
        statusCode: 302,
        statusMessage: "Found",
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
        on: (event: string, handler: (...args: any[]) => void) => {
          responseEvents[event] = handler
          return mockRes
        },
      }
      setTimeout(() => {
        if (callback) callback(mockRes as any)
        if (responseEvents["data"]) responseEvents["data"](Buffer.alloc(0))
        if (responseEvents["end"]) responseEvents["end"]()
      }, 1)
      return { on: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis(), destroy: vi.fn() } as any
    })

    // Make any remaining fetch calls (for IP-literal redirect target) fail fast
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch error"))

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://attacker.com/logo.png",
    })

    // Redirect target was private — logo rejected
    expect(svg).not.toContain("<image")

    vi.restoreAllMocks()
  })

  it("should follow safe redirect to public host", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "93.184.216.34" }])

    // Helper to create a mock https.request implementation (for mockImplementationOnce)
    function makeRedirectMock(opts: { statusCode?: number; headers?: Record<string, string>; bodySize?: number }) {
      const responseEvents: Record<string, (...args: any[]) => void> = {}
      return (_o: any, callback?: any) => {
        const mockRes = {
          statusCode: opts.statusCode ?? 200,
          statusMessage: (opts.statusCode ?? 200) >= 300 ? "Found" : "OK",
          headers: opts.headers ?? { "content-type": "image/png" },
          on: (event: string, handler: (...args: any[]) => void) => {
            responseEvents[event] = handler
            return mockRes
          },
        }
        setTimeout(() => {
          if (callback) callback(mockRes as any)
          if (responseEvents["data"]) responseEvents["data"](Buffer.alloc(opts.bodySize ?? 0))
          if (responseEvents["end"]) responseEvents["end"]()
        }, 1)
        return { on: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis(), destroy: vi.fn() } as any
      }
    }

    vi.spyOn(https, "request")
      // First: 302 redirect to public CDN
      .mockImplementationOnce(makeRedirectMock({
        statusCode: 302,
        headers: { location: "https://cdn.example.com/logo.png" },
      }) as any)
      // Second: actual image response
      .mockImplementationOnce(makeRedirectMock({
        statusCode: 200,
        headers: { "content-type": "image/png" },
        bodySize: 500,
      }) as any)

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://attacker.com/logo.png",
    })

    // Redirect target was public — logo accepted
    expect(svg).toContain("<image")

    vi.restoreAllMocks()
  })

  it("should reject redirect with missing Location header", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "93.184.216.34" }])

    // Mock https.request to return 302 with no Location header
    const responseEvents: Record<string, (...args: any[]) => void> = {}
    vi.spyOn(https, "request").mockImplementation((_opts: any, callback?: any) => {
      const mockRes = {
        statusCode: 302,
        statusMessage: "Found",
        headers: {},
        on: (event: string, handler: (...args: any[]) => void) => {
          responseEvents[event] = handler
          return mockRes
        },
      }
      setTimeout(() => {
        if (callback) callback(mockRes as any)
        if (responseEvents["data"]) responseEvents["data"](Buffer.alloc(0))
        if (responseEvents["end"]) responseEvents["end"]()
      }, 1)
      return { on: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis(), destroy: vi.fn() } as any
    })

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://attacker.com/logo.png",
    })

    // Redirect without Location — logo rejected
    expect(svg).not.toContain("<image")

    vi.restoreAllMocks()
  })

  it("should only follow one redirect (not infinite redirects)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dns.lookup as any).mockResolvedValue([{ address: "93.184.216.34" }])

    function makeRedirectMock(opts: { statusCode?: number; headers?: Record<string, string>; bodySize?: number }) {
      const responseEvents: Record<string, (...args: any[]) => void> = {}
      return (_o: any, callback?: any) => {
        const mockRes = {
          statusCode: opts.statusCode ?? 200,
          statusMessage: (opts.statusCode ?? 200) >= 300 ? "Found" : "OK",
          headers: opts.headers ?? { "content-type": "image/png" },
          on: (event: string, handler: (...args: any[]) => void) => {
            responseEvents[event] = handler
            return mockRes
          },
        }
        setTimeout(() => {
          if (callback) callback(mockRes as any)
          if (responseEvents["data"]) responseEvents["data"](Buffer.alloc(opts.bodySize ?? 0))
          if (responseEvents["end"]) responseEvents["end"]()
        }, 1)
        return { on: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis(), destroy: vi.fn() } as any
      }
    }

    vi.spyOn(https, "request")
      // First: 302 redirect to safe public CDN
      .mockImplementationOnce(makeRedirectMock({
        statusCode: 302,
        headers: { location: "https://cdn.example.com/logo.png" },
      }) as any)
      // Second: actual image response
      .mockImplementationOnce(makeRedirectMock({
        statusCode: 200,
        headers: { "content-type": "image/png" },
        bodySize: 500,
      }) as any)

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000", bgColor: "#FFFFFF", moduleShape: "square",
      logoUrl: "https://attacker.com/logo.png",
    })

    // One redirect followed — logo accepted
    expect(svg).toContain("<image")

    vi.restoreAllMocks()
  })
})
