import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const prismaMock = vi.hoisted(() => {
  const model = (
    methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]
  ) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) {
      m[method] = vi.fn()
    }
    return m
  }
  return {
    user: model(),
    apiKey: model(),
  }
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))

import { apiKeyService } from "@/server/services/api-key.service"

const VALID_KEY_HASH = "abc123def456hash"

function makeApiKey(overrides: Partial<{
  id: string
  userId: string
  revokedAt: Date | null
  lockedUntil: Date | null
  failedAttempts: number
  keyHash: string
}> = {}) {
  return {
    id: "ak-1",
    userId: "user-1",
    revokedAt: null,
    lockedUntil: null,
    failedAttempts: 0,
    keyHash: VALID_KEY_HASH,
    ...overrides,
  }
}

describe("apiKeyService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── generate ─────────────────────────────────────────────────────────────
  describe("generate", () => {
    it("should generate an API key with qrs_ prefix", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", plan: "PRO" })
      prismaMock.apiKey.create.mockResolvedValue({ id: "ak-1" })

      const result = await apiKeyService.generate("user-1", "My Key")

      expect(result.key).toMatch(/^qrs_/)
      expect(result.name).toBe("My Key")
    })

    it("should throw FORBIDDEN for FREE plan", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", plan: "FREE" })

      await expect(apiKeyService.generate("user-1", "My Key")).rejects.toMatchObject({
        code: "FORBIDDEN",
      })
    })

    it("should throw NOT_FOUND if user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(apiKeyService.generate("user-1", "My Key")).rejects.toMatchObject({
        code: "NOT_FOUND",
      })
    })
  })

  // ─── validate — rate limiting ──────────────────────────────────────────────
  describe("validate — rate limiting", () => {
    it("should succeed for a valid key with 0 failed attempts", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(makeApiKey({ failedAttempts: 0 }))
      prismaMock.apiKey.update.mockResolvedValue({})

      const result = await apiKeyService.validate("valid-key")

      expect(result).toEqual({ userId: "user-1" })
    })

    it("should reject revoked keys with UNAUTHORIZED", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ revokedAt: new Date() })
      )

      await expect(apiKeyService.validate("revoked-key")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })

    it("should reject unknown key hash gracefully", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(null)

      await expect(apiKeyService.validate("nonexistent-key")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })

    it("should reject requests during lockout (lockedUntil in the future)", async () => {
      const futureDate = new Date(Date.now() + 60_000)
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ lockedUntil: futureDate, failedAttempts: 10 })
      )

      await expect(apiKeyService.validate("locked-key")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })

    it("should allow requests when lockout has expired", async () => {
      const pastDate = new Date(Date.now() - 60_000)
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ lockedUntil: pastDate, failedAttempts: 10 })
      )
      prismaMock.apiKey.update.mockResolvedValue({})

      const result = await apiKeyService.validate("expired-lock-key")

      expect(result).toEqual({ userId: "user-1" })
      // Should reset failed attempts after expiration
      expect(prismaMock.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ak-1" },
          data: expect.objectContaining({ failedAttempts: 0, lockedUntil: null }),
        })
      )
    })

    it("should reset failed attempts after successful validation", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ failedAttempts: 5 })
      )
      prismaMock.apiKey.update.mockResolvedValue({})

      await apiKeyService.validate("good-key-after-failures")

      // Should reset failed attempts
      expect(prismaMock.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ak-1" },
          data: expect.objectContaining({ failedAttempts: 0, lockedUntil: null }),
        })
      )
    })

    it("should not reset failed attempts if already 0", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ failedAttempts: 0 })
      )
      // First update is for failedAttempts reset check, second is for lastUsedAt
      prismaMock.apiKey.update
        .mockResolvedValueOnce(undefined as never) // not called since failedAttempts == 0
        .mockResolvedValueOnce({} as never)

      await apiKeyService.validate("clean-key")

      // Only the lastUsedAt update should happen
      const updateCalls = prismaMock.apiKey.update.mock.calls
      expect(updateCalls.length).toBe(1)
      expect(updateCalls[0][0].data).not.toHaveProperty("failedAttempts")
    })
  })

  // ─── recordFailedAttempt ───────────────────────────────────────────────────
  describe("recordFailedAttempt", () => {
    it("should increment failed attempts", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ failedAttempts: 2 })
      )

      await apiKeyService.recordFailedAttempt(VALID_KEY_HASH)

      expect(prismaMock.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ak-1" },
          data: { failedAttempts: 3 },
        })
      )
    })

    it("should lock the key after 10 consecutive failures", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ failedAttempts: 9 })
      )

      await apiKeyService.recordFailedAttempt(VALID_KEY_HASH)

      expect(prismaMock.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ak-1" },
          data: expect.objectContaining({
            failedAttempts: 10,
            lockedUntil: expect.any(Date),
          }),
        })
      )
    })

    it("should lock the key exactly at the 10th failure", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ failedAttempts: 0, id: "ak-1" })
      )

      // 10 consecutive failures
      for (let i = 1; i <= 9; i++) {
        prismaMock.apiKey.findUnique.mockResolvedValue(
          makeApiKey({ failedAttempts: i, id: "ak-1" })
        )
        await apiKeyService.recordFailedAttempt(VALID_KEY_HASH)
      }

      // The 10th call should lock
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ failedAttempts: 9, id: "ak-1" })
      )
      await apiKeyService.recordFailedAttempt(VALID_KEY_HASH)

      // Verify the last update locked the key
      const lastCallArgs =
        prismaMock.apiKey.update.mock.calls[
          prismaMock.apiKey.update.mock.calls.length - 1
        ][0]
      expect(lastCallArgs.data.failedAttempts).toBe(10)
      expect(lastCallArgs.data.lockedUntil).toBeInstanceOf(Date)
    })

    it("should silently return if key hash does not exist", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(null)

      await expect(
        apiKeyService.recordFailedAttempt("nonexistent-hash")
      ).resolves.toBeUndefined()

      expect(prismaMock.apiKey.update).not.toHaveBeenCalled()
    })

    it("should not lock before 10 failures (9th failure = no lock)", async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(
        makeApiKey({ failedAttempts: 8 })
      )

      await apiKeyService.recordFailedAttempt(VALID_KEY_HASH)

      const lastCallArgs =
        prismaMock.apiKey.update.mock.calls[
          prismaMock.apiKey.update.mock.calls.length - 1
        ][0]
      expect(lastCallArgs.data.failedAttempts).toBe(9)
      expect(lastCallArgs.data).not.toHaveProperty("lockedUntil")
    })
  })
})
