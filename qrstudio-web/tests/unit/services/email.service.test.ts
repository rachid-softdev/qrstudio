import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const resendSendMock = vi.hoisted(() => vi.fn())

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: resendSendMock,
      },
    }
  }),
}))

vi.mock("@/lib/logger", () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { emailService } from "@/server/services/email.service"

describe("emailService — HTML escaping (1b.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = "re_test_key"
    process.env.EMAIL_FROM = "test@qrstudio.app"
  })

  describe("sendWelcomeEmail — HTML injection prevention", () => {
    it("should escape HTML in user name to prevent XSS", async () => {
      const maliciousName = "<script>alert('XSS')</script>"

      await emailService.sendWelcomeEmail("user@test.com", maliciousName)

      // The email should have been sent
      expect(resendSendMock).toHaveBeenCalledTimes(1)
      const callArgs = resendSendMock.mock.calls[0][0]

      // The HTML body should contain the escaped name, not the raw script tag
      expect(callArgs.html).toContain("&lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;")
      expect(callArgs.html).not.toContain("<script>")
    })

    it("should not break normal user names", async () => {
      await emailService.sendWelcomeEmail("user@test.com", "Jean Dupont")

      expect(resendSendMock).toHaveBeenCalledTimes(1)
      const callArgs = resendSendMock.mock.calls[0][0]

      expect(callArgs.html).toContain("Jean Dupont")
      expect(callArgs.html).not.toContain("&lt;")
    })

    it("should escape HTML entities in name with angle brackets", async () => {
      await emailService.sendWelcomeEmail("user@test.com", "John <Doe>")

      expect(resendSendMock).toHaveBeenCalledTimes(1)
      const callArgs = resendSendMock.mock.calls[0][0]

      expect(callArgs.html).toContain("John &lt;Doe&gt;")
      expect(callArgs.html).not.toContain("<Doe>")
    })

    it("should escape double quotes in user name", async () => {
      await emailService.sendWelcomeEmail("user@test.com", 'Jane "The Boss" Doe')

      expect(resendSendMock).toHaveBeenCalledTimes(1)
      const callArgs = resendSendMock.mock.calls[0][0]

      expect(callArgs.html).toContain("Jane &quot;The Boss&quot; Doe")
    })

    it("should escape ampersands in user name", async () => {
      await emailService.sendWelcomeEmail("user@test.com", "Ben & Jerry")

      expect(resendSendMock).toHaveBeenCalledTimes(1)
      const callArgs = resendSendMock.mock.calls[0][0]

      expect(callArgs.html).toContain("Ben &amp; Jerry")
    })
  })

  describe("sendInvitationEmail — HTML escaping", () => {
    it("should escape HTML in workspace name", async () => {
      await emailService.sendInvitationEmail(
        "user@test.com",
        "<script>alert('xss')</script>",
        "token123",
        "Alice"
      )

      expect(resendSendMock).toHaveBeenCalledTimes(1)
      const callArgs = resendSendMock.mock.calls[0][0]

      expect(callArgs.html).not.toContain("<script>")
      expect(callArgs.html).toContain("&lt;script&gt;")
    })

    it("should escape HTML in invited by name", async () => {
      await emailService.sendInvitationEmail(
        "user@test.com",
        "My Workspace",
        "token123",
        "<img src=x onerror=alert(1)>"
      )

      expect(resendSendMock).toHaveBeenCalledTimes(1)
      const callArgs = resendSendMock.mock.calls[0][0]

      expect(callArgs.html).not.toContain("<img")
    })
  })

  describe("escapeHtml utility — direct coverage", () => {
    // The HTML escaping is done inline in the service via replace().
    // We verify the output is properly escaped for various XSS vectors.
    it("should escape script tag injection", async () => {
      await emailService.sendWelcomeEmail("user@test.com", "<script>alert('XSS')</script>")

      const callArgs = resendSendMock.mock.calls[0][0]
      expect(callArgs.html).toContain("&lt;script&gt;")
    })

    it("should escape onerror attributes", async () => {
      await emailService.sendWelcomeEmail("user@test.com", "<img src=x onerror=alert(1)>")

      const callArgs = resendSendMock.mock.calls[0][0]
      expect(callArgs.html).toContain("&lt;img src=x onerror=alert(1)&gt;")
    })
  })
})
