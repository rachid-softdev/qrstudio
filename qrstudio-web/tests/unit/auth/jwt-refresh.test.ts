import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}))

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))
vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/server/services/auth.service", () => ({ authService: {} }))
vi.mock("bcryptjs", () => ({ default: { compare: () => false } }))
vi.mock("next-auth/providers/google", () => ({ default: vi.fn() }))
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(() => ({
    name: "credentials",
    type: "credentials",
    authorize: vi.fn(),
  })),
}))

import { authConfig } from "@/server/auth"

// Helper: simulate what next-auth calls internally
async function callJwtCallback(
  token: Record<string, unknown>,
  user?: Record<string, unknown>,
  trigger?: "signIn" | "signUp" | "update"
) {
  // The JWT callback is typed as (params: { token, user, trigger }) => token
  const cb = authConfig.callbacks!.jwt as unknown as (params: {
    token: Record<string, unknown>
    user?: Record<string, unknown>
    trigger?: string
  }) => Promise<Record<string, unknown>>

  return cb({ token, user, trigger })
}

describe("JWT Callback — DB verification (security fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── First sign-in ─────────────────────────────────────────────────────
  it("should set initial values from user on first sign-in", async () => {
    const token = {}
    const user = { id: "user-1", plan: "PRO" }

    const result = await callJwtCallback(token, user)

    expect(result.id).toBe("user-1")
    expect(result.plan).toBe("PRO")
  })

  it("should default to FREE plan when user has no plan", async () => {
    const token = {}
    const user = { id: "user-1" }

    const result = await callJwtCallback(token, user)

    expect(result.id).toBe("user-1")
    expect(result.plan).toBe("FREE")
  })

  // ─── Subsequent token refresh — DB lookup ──────────────────────────────
  it("should update plan from DB if token.id exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      plan: "AGENCY",
      email: "admin@qrstudio.app",
    })

    const token = { id: "user-1", plan: "PRO", email: "old@test.com" }

    const result = await callJwtCallback(token)

    expect(result.plan).toBe("AGENCY")
    expect(result.email).toBe("admin@qrstudio.app")
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } })
    )
  })

  it("should invalidate token if user no longer exists in DB", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const token = { id: "deleted-user", plan: "PRO" }

    const result = await callJwtCallback(token)

    // Returning null causes next-auth to invalidate the session
    expect(result).toBeNull()
  })

  // ─── DB error fallback ──────────────────────────────────────────────────
  it("should fallback to current token values on DB error (no user param)", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB connection failed"))

    const token = { id: "user-1", plan: "PRO", email: "keep@test.com" }

    const result = await callJwtCallback(token)

    // Token values should be preserved
    expect(result.id).toBe("user-1")
    expect(result.plan).toBe("PRO")
    expect(result.email).toBe("keep@test.com")
  })

  it("should fallback to user values on DB error (with user param)", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB timeout"))

    const token = { id: "user-1", plan: "PRO" }
    const user = { id: "user-1", plan: "AGENCY" }

    const result = await callJwtCallback(token, user)

    // Should use the user values as fallback
    expect(result.id).toBe("user-1")
    expect(result.plan).toBe("AGENCY")
  })

  it("should fallback to FREE plan on DB error when user has no plan", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB timeout"))

    const token = { id: "user-1", plan: "PRO" }
    const user = { id: "user-1" }

    const result = await callJwtCallback(token, user)

    expect(result.plan).toBe("FREE")
  })
})
