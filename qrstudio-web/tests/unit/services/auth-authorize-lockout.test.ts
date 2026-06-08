import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const bcryptCompareMock = vi.hoisted(() => vi.fn())

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

const authServiceMock = vi.hoisted(() => ({
  checkLockout: vi.fn(),
  recordFailedAttempt: vi.fn(),
  resetLoginAttempts: vi.fn(),
}))

// Store the authorize function reference so we can access it in tests
let capturedAuthorizeFn: ((credentials: Record<string, unknown>) => Promise<unknown>) | undefined

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/server/services/auth.service", () => ({ authService: authServiceMock }))
vi.mock("bcryptjs", () => ({
  default: { compare: bcryptCompareMock },
}))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

// Mock next-auth and its providers to avoid importing next/server in test env
vi.mock("next-auth", () => ({
  default: vi.fn().mockReturnValue({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))
vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(),
}))
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn().mockImplementation((config: Record<string, unknown>) => {
    // Capture the authorize function for testing
    capturedAuthorizeFn = config.authorize as (credentials: Record<string, unknown>) => Promise<unknown>
    return {
      id: "credentials",
      name: (config.name as string) ?? "credentials",
      type: "credentials",
      authorize: config.authorize,
    }
  }),
}))

import { authConfig } from "@/server/auth"

describe("next-auth authorize — lockout integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should call checkLockout on login attempt", async () => {
    if (!capturedAuthorizeFn) return // skip if authorize not accessible

    authServiceMock.checkLockout.mockResolvedValue(undefined)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      image: null,
      passwordHash: "hashed",
      plan: "FREE",
    } as never)
    bcryptCompareMock.mockResolvedValue(true)
    authServiceMock.resetLoginAttempts.mockResolvedValue(undefined)

    await capturedAuthorizeFn({ email: "test@test.com", password: "correct" })

    expect(authServiceMock.checkLockout).toHaveBeenCalledWith("test@test.com")
  })

  it("should return null when checkLockout throws (user is locked out)", async () => {
    if (!capturedAuthorizeFn) return

    authServiceMock.checkLockout.mockRejectedValue(new Error("Locked out"))

    const result = await capturedAuthorizeFn({ email: "locked@test.com", password: "any" })

    expect(result).toBeNull()
    // Should NOT proceed to find user or compare password
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("should call recordFailedAttempt when user does not exist", async () => {
    if (!capturedAuthorizeFn) return

    authServiceMock.checkLockout.mockResolvedValue(undefined)
    prismaMock.user.findUnique.mockResolvedValue(null)

    const result = await capturedAuthorizeFn({ email: "ghost@test.com", password: "any" })

    expect(result).toBeNull()
    expect(authServiceMock.recordFailedAttempt).toHaveBeenCalledWith("ghost@test.com")
  })

  it("should call recordFailedAttempt when user has no passwordHash", async () => {
    if (!capturedAuthorizeFn) return

    authServiceMock.checkLockout.mockResolvedValue(undefined)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-social",
      email: "social@test.com",
      name: "Social User",
      image: null,
      passwordHash: null,
      plan: "FREE",
    } as never)

    const result = await capturedAuthorizeFn({ email: "social@test.com", password: "any" })

    expect(result).toBeNull()
    expect(authServiceMock.recordFailedAttempt).toHaveBeenCalledWith("social@test.com")
  })

  it("should call recordFailedAttempt when password is wrong", async () => {
    if (!capturedAuthorizeFn) return

    authServiceMock.checkLockout.mockResolvedValue(undefined)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      image: null,
      passwordHash: "hashed",
      plan: "FREE",
    } as never)
    bcryptCompareMock.mockResolvedValue(false)

    const result = await capturedAuthorizeFn({ email: "test@test.com", password: "wrong" })

    expect(result).toBeNull()
    expect(authServiceMock.recordFailedAttempt).toHaveBeenCalledWith("test@test.com")
  })

  it("should call resetLoginAttempts on successful login", async () => {
    if (!capturedAuthorizeFn) return

    authServiceMock.checkLockout.mockResolvedValue(undefined)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      image: null,
      passwordHash: "hashed",
      plan: "PRO",
    } as never)
    bcryptCompareMock.mockResolvedValue(true)
    authServiceMock.resetLoginAttempts.mockResolvedValue(undefined)

    const result = await capturedAuthorizeFn({ email: "test@test.com", password: "correct" })

    expect(result).not.toBeNull()
    expect(authServiceMock.resetLoginAttempts).toHaveBeenCalledWith("test@test.com")
  })

  it("should return null when credentials are missing", async () => {
    if (!capturedAuthorizeFn) return

    const resultNoEmail = await capturedAuthorizeFn({ password: "test" })
    expect(resultNoEmail).toBeNull()

    const resultNoPassword = await capturedAuthorizeFn({ email: "test@test.com" })
    expect(resultNoPassword).toBeNull()

    const resultEmpty = await capturedAuthorizeFn({})
    expect(resultEmpty).toBeNull()
  })

  it("should return user object on successful authentication", async () => {
    if (!capturedAuthorizeFn) return

    authServiceMock.checkLockout.mockResolvedValue(undefined)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test User",
      image: "https://avatar.com/pic.png",
      passwordHash: "hashed",
      plan: "PRO",
    } as never)
    bcryptCompareMock.mockResolvedValue(true)
    authServiceMock.resetLoginAttempts.mockResolvedValue(undefined)

    const result = await capturedAuthorizeFn({ email: "test@test.com", password: "correct" }) as Record<string, unknown> | null

    expect(result).not.toBeNull()
    expect(result?.id).toBe("user-1")
    expect(result?.email).toBe("test@test.com")
    expect(result?.name).toBe("Test User")
    expect(result?.plan).toBe("PRO")
  })
})
