import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Helper ────────────────────────────────────────────────────────────────────
function mockRequest(headers: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(headers) }
}

// ── getClientIp ───────────────────────────────────────────────────────────────
describe("getClientIp", () => {
  let module: typeof import("@/lib/ip")

  beforeEach(async () => {
    // Ensure a fresh module for each test (no cross-test pollution)
    vi.resetModules()

    // Default to production environment
    vi.stubEnv("NODE_ENV", "production")

    module = await import("@/lib/ip")
  })

  it("returns x-real-ip when present", () => {
    const req = mockRequest({ "x-real-ip": "1.2.3.4" })
    expect(module.getClientIp(req)).toBe("1.2.3.4")
  })

  it("returns cf-connecting-ip when present", () => {
    const req = mockRequest({ "cf-connecting-ip": "5.6.7.8" })
    expect(module.getClientIp(req)).toBe("5.6.7.8")
  })

  it("prefers x-real-ip over cf-connecting-ip", () => {
    const req = mockRequest({
      "x-real-ip": "1.1.1.1",
      "cf-connecting-ip": "2.2.2.2",
    })
    expect(module.getClientIp(req)).toBe("1.1.1.1")
  })

  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = mockRequest({
      "x-real-ip": "9.9.9.9",
      "x-forwarded-for": "1.2.3.4, 10.0.0.1",
    })
    expect(module.getClientIp(req)).toBe("9.9.9.9")
  })

  describe("production mode (NODE_ENV=production)", () => {
    it("takes rightmost non-private IP from x-forwarded-for", () => {
      const req = mockRequest({
        "x-forwarded-for": "1.2.3.4, 10.0.0.1, 192.168.1.1",
      })
      expect(module.getClientIp(req)).toBe("1.2.3.4")
    })

    it("handles single non-private IP in x-forwarded-for", () => {
      const req = mockRequest({ "x-forwarded-for": "9.9.9.9" })
      expect(module.getClientIp(req)).toBe("9.9.9.9")
    })

    it("skips private IPs until finding a public one", () => {
      const req = mockRequest({
        "x-forwarded-for": "10.0.0.1, 192.168.1.1, 8.8.8.8",
      })
      expect(module.getClientIp(req)).toBe("8.8.8.8")
    })

    it("falls back to rightmost private IP when all IPs are private", () => {
      const req = mockRequest({
        "x-forwarded-for": "10.0.0.1, 192.168.1.1",
      })
      expect(module.getClientIp(req)).toBe("192.168.1.1")
    })

    it("recognises 172.16.x.x – 172.31.x.x as private", () => {
      const req = mockRequest({ "x-forwarded-for": "172.20.0.1, 8.8.8.8" })
      // Should skip 172.20.0.1 (private) and return 8.8.8.8
      expect(module.getClientIp(req)).toBe("8.8.8.8")
    })

    it("recognises 172.32.x.x as public (not in private range)", () => {
      const req = mockRequest({ "x-forwarded-for": "10.0.0.1, 172.32.0.1" })
      // 172.32.x.x is NOT private (only 172.16-31.x.x is).
      // Iterating rightmost: 172.32.0.1 is checked first → not private → returned.
      expect(module.getClientIp(req)).toBe("172.32.0.1")
    })

    it("treats 127.0.0.1 as private", () => {
      const req = mockRequest({ "x-forwarded-for": "127.0.0.1, 1.2.3.4" })
      expect(module.getClientIp(req)).toBe("1.2.3.4")
    })

    it("treats ::1 as private and falls back to it (rightmost) when it is the only IP", () => {
      const req = mockRequest({ "x-forwarded-for": "::1" })
      // The code returns rightmost as last resort when all IPs are private
      expect(module.getClientIp(req)).toBe("::1")
    })
  })

  describe("development mode (NODE_ENV=development)", () => {
    beforeEach(async () => {
      vi.stubEnv("NODE_ENV", "development")
      vi.resetModules()
      module = await import("@/lib/ip")
    })

    it("takes leftmost IP from x-forwarded-for in dev mode", () => {
      const req = mockRequest({
        "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      })
      // In dev, uses leftmost (NOT rightmost non-private)
      expect(module.getClientIp(req)).toBe("192.168.1.1")
    })

    it("still prefers x-real-ip over x-forwarded-for in dev", () => {
      const req = mockRequest({
        "x-real-ip": "5.5.5.5",
        "x-forwarded-for": "192.168.1.1",
      })
      expect(module.getClientIp(req)).toBe("5.5.5.5")
    })
  })

  it("returns 'unknown' when no headers are present", () => {
    const req = mockRequest({})
    expect(module.getClientIp(req)).toBe("unknown")
  })

  it("returns 'unknown' when x-forwarded-for is empty", () => {
    const req = mockRequest({ "x-forwarded-for": "" })
    expect(module.getClientIp(req)).toBe("unknown")
  })

  it("handles x-forwarded-for with extra whitespace", () => {
    const req = mockRequest({
      "x-forwarded-for": "  1.2.3.4 ,  10.0.0.1  ",
    })
    expect(module.getClientIp(req)).toBe("1.2.3.4")
  })

  it("handles header key case insensitivity (X-Real-Ip)", () => {
    // Headers API normalises to lowercase, but we test via Headers constructor
    const req = mockRequest({ "X-Real-Ip": "1.2.3.4" })
    expect(module.getClientIp(req)).toBe("1.2.3.4")
  })
})

// ── hashIp ────────────────────────────────────────────────────────────────────
describe("hashIp", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("produces consistent output for same IP and secret", async () => {
    process.env.IP_HASH_SECRET = "test-secret-hex-32bytes!!"
    vi.resetModules() // ensure env is read fresh
    const { hashIp } = await import("@/lib/ip")
    const hash1 = await hashIp("1.2.3.4")
    const hash2 = await hashIp("1.2.3.4")
    expect(hash1).toBe(hash2)
  })

  it("produces different output for different IPs", async () => {
    process.env.IP_HASH_SECRET = "test-secret-hex-32bytes!!"
    vi.resetModules()
    const { hashIp } = await import("@/lib/ip")
    const hash1 = await hashIp("1.2.3.4")
    const hash2 = await hashIp("5.6.7.8")
    expect(hash1).not.toBe(hash2)
  })

  it("produces a hex string of 64 characters (SHA-256)", async () => {
    process.env.IP_HASH_SECRET = "test-secret-hex-32bytes!!"
    vi.resetModules()
    const { hashIp } = await import("@/lib/ip")
    const hash = await hashIp("1.2.3.4")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("produces different output with different secrets", async () => {
    process.env.IP_HASH_SECRET = "secret-one!!!!!!!!!!!!!!"
    vi.resetModules()
    const { hashIp: hashIp1 } = await import("@/lib/ip")
    const hash1 = await hashIp1("1.2.3.4")

    process.env.IP_HASH_SECRET = "secret-two!!!!!!!!!!!!!!"
    vi.resetModules()
    const { hashIp: hashIp2 } = await import("@/lib/ip")
    const hash2 = await hashIp2("1.2.3.4")

    expect(hash1).not.toBe(hash2)
  })

  it("falls back to default secret when IP_HASH_SECRET is not set", async () => {
    delete process.env.IP_HASH_SECRET
    vi.resetModules()
    const { hashIp } = await import("@/lib/ip")
    const hash = await hashIp("1.2.3.4")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("handles empty string IP", async () => {
    process.env.IP_HASH_SECRET = "test-secret-hex-32bytes!!"
    vi.resetModules()
    const { hashIp } = await import("@/lib/ip")
    const hash = await hashIp("")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("handles IPv6 address", async () => {
    process.env.IP_HASH_SECRET = "test-secret-hex-32bytes!!"
    vi.resetModules()
    const { hashIp } = await import("@/lib/ip")
    const hash = await hashIp("2001:db8::1")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
