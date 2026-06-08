import { describe, it, expect } from "vitest"
import { isSafeRedirectUrl } from "@/lib/url-security"

describe("isSafeRedirectUrl", () => {
  // ─── Relative URLs ───────────────────────────────────────────────────────
  it("should allow root-relative URL (/)", () => {
    expect(isSafeRedirectUrl("/")).toBe(true)
  })

  it("should allow relative path (/dashboard)", () => {
    expect(isSafeRedirectUrl("/dashboard")).toBe(true)
  })

  it("should allow relative landing page (/l/abc123)", () => {
    expect(isSafeRedirectUrl("/l/abc123")).toBe(true)
  })

  // ─── Internal app URLs ────────────────────────────────────────────────────
  it("should allow internal app URL (https://qrstudio.app/dashboard)", () => {
    expect(isSafeRedirectUrl("https://qrstudio.app/dashboard")).toBe(true)
  })

  it("should allow www subdomain (https://www.qrstudio.app/)", () => {
    expect(isSafeRedirectUrl("https://www.qrstudio.app/")).toBe(true)
  })

  // ─── External URLs (blocked) ──────────────────────────────────────────────
  it("should block external URL (https://evil.com/phish)", () => {
    expect(isSafeRedirectUrl("https://evil.com/phish")).toBe(false)
  })

  it("should block external URL (https://malware.net)", () => {
    expect(isSafeRedirectUrl("https://malware.net")).toBe(false)
  })

  it("should block private IP URL (http://192.168.1.1/admin)", () => {
    expect(isSafeRedirectUrl("http://192.168.1.1/admin")).toBe(false)
  })

  it("should block external URL with lookalike domain (https://qrstudio.app.evil.com)", () => {
    expect(isSafeRedirectUrl("https://qrstudio.app.evil.com")).toBe(false)
  })

  // ─── Non-HTTP protocols ───────────────────────────────────────────────────
  it("should block file:// protocol (file:///etc/passwd)", () => {
    expect(isSafeRedirectUrl("file:///etc/passwd")).toBe(false)
  })

  it("should block ftp:// protocol (ftp://evil.com/file)", () => {
    expect(isSafeRedirectUrl("ftp://evil.com/file")).toBe(false)
  })

  it("should block javascript: protocol (javascript:alert(1))", () => {
    expect(isSafeRedirectUrl("javascript:alert(1)")).toBe(false)
  })

  it("should block data: protocol (data:text/html,<script>)", () => {
    expect(isSafeRedirectUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
  })

  // ─── Protocol-relative URLs (blocked) ──────────────────────────────────────
  it("should block protocol-relative URL (//evil.com)", () => {
    expect(isSafeRedirectUrl("//evil.com")).toBe(false)
  })

  it("should block protocol-relative URL with path (//evil.com/phish)", () => {
    expect(isSafeRedirectUrl("//evil.com/phish")).toBe(false)
  })

  // ─── Invalid URLs ─────────────────────────────────────────────────────────
  it("should handle non-URL strings gracefully ('not-a-url')", () => {
    expect(isSafeRedirectUrl("not-a-url")).toBe(false)
  })

  it("should handle empty string gracefully", () => {
    expect(isSafeRedirectUrl("")).toBe(false)
  })
})
