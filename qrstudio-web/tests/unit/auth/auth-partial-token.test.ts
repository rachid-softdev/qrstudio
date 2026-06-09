import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Mock } from "vitest"

// ── Hoisted mocks — store references that survive vi.mock hoisting ────────────
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const totpServiceMock = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  verifyBackupCode: vi.fn(),
}))

const jwtVerifyMock = vi.hoisted(() => vi.fn())
const jwtDecodeMock = vi.hoisted(() => vi.fn())

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/server/services/totp.service", () => ({
  totpService: totpServiceMock,
}))

// Mock jsonwebtoken so we can control verify / decode behavior.
// The production code uses dynamic import, but vi.mock replaces the module globally.
vi.mock("jsonwebtoken", () => ({
  default: { verify: jwtVerifyMock, decode: jwtDecodeMock, sign: vi.fn() },
  verify: jwtVerifyMock,
  decode: jwtDecodeMock,
  sign: vi.fn(),
}))

const JWT_SECRET = "test-secret-for-partial-token"
process.env.NEXTAUTH_SECRET = JWT_SECRET

import { authService } from "@/server/services/auth.service"

describe("verifyPartialToken — jwt.decode() → jwt.verify() fix", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Helper: mock a fully configured TOTP user ──────────────────────────────
  function mockTotpUser() {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      totpEnabled: true,
      totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    } as never)
    totpServiceMock.verifyToken.mockReturnValue(true)
    prismaMock.user.update.mockResolvedValue({} as never)
  }

  // ─── Valid token scenarios ─────────────────────────────────────────────────

  it("should accept a valid partial token (signed with correct secret)", async () => {
    jwtVerifyMock.mockReturnValue({
      userId: "user-1",
      type: "partial_auth",
    })
    mockTotpUser()

    const result = await authService.verifyTotpChallenge("valid-token", "123456")

    expect(result.verified).toBe(true)
    // Verify that jwt.verify() was called (not decode)
    expect(jwtVerifyMock).toHaveBeenCalled()
  })

  it("should accept valid partial token in verifyBackupCode", async () => {
    jwtVerifyMock.mockReturnValue({
      userId: "user-1",
      type: "partial_auth",
    })
    totpServiceMock.verifyBackupCode.mockReturnValue(0)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      totpEnabled: true,
      totpBackupCodes: [{ code_hash: "abc123hash", used: false }],
    } as never)
    prismaMock.user.update.mockResolvedValue({} as never)

    const result = await authService.verifyBackupCode("valid-token", "ABC12345")
    expect(result.verified).toBe(true)
  })

  // ─── Invalid signature ────────────────────────────────────────────────────

  it("should reject a token signed with a different secret", async () => {
    // jwt.verify() throws on signature mismatch
    jwtVerifyMock.mockImplementation(() => {
      throw new Error("invalid signature")
    })

    await expect(
      authService.verifyTotpChallenge("wrong-sig-token", "123456"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  // ─── Expired token ─────────────────────────────────────────────────────────

  it("should reject an expired token", async () => {
    jwtVerifyMock.mockImplementation(() => {
      throw new Error("jwt expired")
    })

    await expect(
      authService.verifyTotpChallenge("expired-token", "123456"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  // ─── Malformed token ───────────────────────────────────────────────────────

  it("should reject a malformed token", async () => {
    jwtVerifyMock.mockImplementation(() => {
      throw new Error("jwt malformed")
    })

    await expect(
      authService.verifyTotpChallenge("malformed-token", "123456"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  // ─── Wrong type field ───────────────────────────────────────────────────────

  it("should reject a token with wrong type field", async () => {
    jwtVerifyMock.mockReturnValue({
      userId: "user-1",
      type: "password_reset", // wrong type, not "partial_auth"
    })

    await expect(
      authService.verifyTotpChallenge("wrong-type-token", "123456"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  // ─── Verify jwt.verify() is called (not decode) ────────────────────────────

  it("should call jwt.verify() and NOT jwt.decode()", async () => {
    jwtVerifyMock.mockReturnValue({
      userId: "user-1",
      type: "partial_auth",
    })
    mockTotpUser()

    await authService.verifyTotpChallenge("some-token", "123456")

    // verify() should be called with the token and secret (no options object)
    expect(jwtVerifyMock).toHaveBeenCalledWith("some-token", JWT_SECRET)
    // decode() should NOT be called
    expect(jwtDecodeMock).not.toHaveBeenCalled()
  })

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  it("should handle null payload from verify gracefully", async () => {
    jwtVerifyMock.mockReturnValue(null)

    await expect(
      authService.verifyTotpChallenge("null-token", "123456"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("should wrap non-TRPCError internal errors as UNAUTHORIZED", async () => {
    jwtVerifyMock.mockImplementation(() => {
      throw new Error("some unexpected error")
    })

    await expect(
      authService.verifyTotpChallenge("error-token", "123456"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})
