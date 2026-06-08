import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) { m[method] = vi.fn() }
    return m
  }
  return {
    user: model(),
    workspace: model(),
    workspaceMember: model(),
    qRCode: model(),
    workspaceInvitation: model(),
    apiKey: model(),
    landingPage: model(),
    scan: model(),
  }
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/server/services/email.service", () => ({
  emailService: {
    sendWelcomeEmail: vi.fn(),
    sendAccountDeletionConfirmation: vi.fn(),
  },
}))

import { authService } from "@/server/services/auth.service"

describe("authService — lockout brute force", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("checkLockout", () => {
    it("should not throw if user does not exist (guest email)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(authService.checkLockout("nonexistent@test.com")).resolves.toBeUndefined()
    })

    it("should not throw if user has no lockout", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 0,
        lockoutUntil: null,
      } as never)

      await expect(authService.checkLockout("active@test.com")).resolves.toBeUndefined()
    })

    it("should throw TOO_MANY_REQUESTS if user is currently locked out", async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000) // 10 min in future
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 5,
        lockoutUntil: futureDate,
      } as never)

      await expect(authService.checkLockout("locked@test.com"))
        .rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" })
    })

    it("should reset lockout if lockoutUntil is in the past", async () => {
      const pastDate = new Date(Date.now() - 60 * 1000) // 1 min ago
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 5,
        lockoutUntil: pastDate,
      } as never)
      prismaMock.user.update.mockResolvedValue({} as never)

      await expect(authService.checkLockout("expired@test.com")).resolves.toBeUndefined()
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "expired@test.com" },
        data: { loginAttempts: 0, lockoutUntil: null },
      })
    })

    it("should not call update if lockoutUntil is null (no lockout)", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 2,
        lockoutUntil: null,
      } as never)

      await authService.checkLockout("clean@test.com")
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })
  })

  describe("recordFailedAttempt", () => {
    it("should increment loginAttempts from 0 to 1", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 0,
      } as never)
      prismaMock.user.update.mockResolvedValue({} as never)

      await authService.recordFailedAttempt("test@test.com")

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@test.com" },
        data: { loginAttempts: 1 },
      })
    })

    it("should lock user after 5 failed attempts (sets lockoutUntil)", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 4,
      } as never)
      prismaMock.user.update.mockResolvedValue({} as never)

      await authService.recordFailedAttempt("test@test.com")

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@test.com" },
        data: {
          loginAttempts: 5,
          lockoutUntil: expect.any(Date),
        },
      })
    })

    it("should do nothing if user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await authService.recordFailedAttempt("ghost@test.com")
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it("should set lockoutUntil to approximately 15 minutes in future", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 4,
      } as never)
      prismaMock.user.update.mockResolvedValue({} as never)

      await authService.recordFailedAttempt("test@test.com")

      const updateCall = prismaMock.user.update.mock.calls[0][0]
      const lockoutUntil: Date = updateCall.data.lockoutUntil
      const diff = lockoutUntil.getTime() - Date.now()
      // Should be within ~15 min (allow 1s tolerance)
      expect(diff).toBeGreaterThan(14 * 60 * 1000)
      expect(diff).toBeLessThan(16 * 60 * 1000)
    })
  })

  describe("resetLoginAttempts", () => {
    it("should reset loginAttempts to 0 and clear lockoutUntil", async () => {
      prismaMock.user.update.mockResolvedValue({} as never)

      await authService.resetLoginAttempts("test@test.com")

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@test.com" },
        data: { loginAttempts: 0, lockoutUntil: null },
      })
    })
  })

  describe("full lockout flow — end-to-end scenario", () => {
    it("should allow login after lockout expires", async () => {
      // Simulate user who was locked out but lockout has expired
      const expiredDate = new Date(Date.now() - 60 * 1000) // lockout expired 1 min ago
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 5,
        lockoutUntil: expiredDate,
      } as never)
      prismaMock.user.update.mockResolvedValue({} as never)

      // First checkLockout should auto-reset
      await expect(authService.checkLockout("recovered@test.com")).resolves.toBeUndefined()
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "recovered@test.com" },
        data: { loginAttempts: 0, lockoutUntil: null },
      })
    })

    it("should lock user who was just unlocked if they fail again", async () => {
      // User was just unlocked (attempts reset to 0)
      prismaMock.user.findUnique.mockResolvedValue({
        loginAttempts: 0,
        lockoutUntil: null,
      } as never)

      // No lockout → passes
      await expect(authService.checkLockout("fragile@test.com")).resolves.toBeUndefined()

      // Now simulate 5 consecutive failures by calling recordFailedAttempt
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ loginAttempts: 0 } as never)  // 1st → 1
        .mockResolvedValueOnce({ loginAttempts: 1 } as never)  // 2nd → 2
        .mockResolvedValueOnce({ loginAttempts: 2 } as never)  // 3rd → 3
        .mockResolvedValueOnce({ loginAttempts: 3 } as never)  // 4th → 4
        .mockResolvedValueOnce({ loginAttempts: 4 } as never)  // 5th → 5 + lockout
      prismaMock.user.update.mockResolvedValue({} as never)

      for (let i = 0; i < 5; i++) {
        await authService.recordFailedAttempt("fragile@test.com")
      }

      // Verify the 5th call triggers lockout
      const lastUpdateCall = prismaMock.user.update.mock.calls[4][0]
      expect(lastUpdateCall.data.loginAttempts).toBe(5)
      expect(lastUpdateCall.data.lockoutUntil).toBeInstanceOf(Date)
    })
  })
})
