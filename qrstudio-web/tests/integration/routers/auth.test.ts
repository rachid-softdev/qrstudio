import { describe, it, expect, vi, beforeEach } from "vitest"
import type { TRPCContext } from "@/server/trpc"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) {
      m[method] = vi.fn()
    }
    return m
  }
  return {
    user: model(),
    workspace: model(),
    workspaceMember: model(),
  }
})

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-password"), compare: vi.fn() } }))
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({ subscriptions: { cancel: vi.fn().mockResolvedValue({}) } })),
}))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))
vi.mock("@/server/services/email.service", () => ({
  emailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordChanged: vi.fn().mockResolvedValue(undefined),
    sendAccountDeletionConfirmation: vi.fn().mockResolvedValue(undefined),
  },
}))

import { authRouter } from "@/server/routers/auth"

function ctx(overrides?: Partial<TRPCContext>): TRPCContext {
  return {
    db: prismaMock as never,
    session: null,
    user: undefined,
    workspace: undefined,
    ...overrides,
  }
}

describe("authRouter", () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe("register", () => {
    it("should create user and workspace successfully", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.user.create.mockResolvedValue({ id: "user-1" } as never)
      prismaMock.workspace.create.mockResolvedValue({ id: "ws-1" } as never)
      prismaMock.workspaceMember.create.mockResolvedValue({} as never)

      const caller = authRouter.createCaller(ctx())
      const result = await caller.register({ name: "John", email: "john@test.com", password: "password123" })
      expect(result.userId).toBe("user-1")
      expect(result.workspaceId).toBe("ws-1")
    })

    it("should throw CONFLICT if email already exists", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "existing" } as never)

      const caller = authRouter.createCaller(ctx())
      await expect(caller.register({ name: "John", email: "existing@test.com", password: "password123" }))
        .rejects.toMatchObject({ code: "CONFLICT" })
    })
  })

  describe("updateProfile", () => {
    it("should update user profile", async () => {
      prismaMock.user.update.mockResolvedValue({ id: "user-1", name: "New Name", image: null } as never)

      const caller = authRouter.createCaller(ctx({
        user: { id: "user-1", email: "a@b.com", name: "Old", image: null, plan: "FREE" },
      }))
      const result = await caller.updateProfile({ name: "New Name" })
      expect(result.name).toBe("New Name")
    })

    it("should throw UNAUTHORIZED if not authenticated", async () => {
      const caller = authRouter.createCaller(ctx())
      await expect(caller.updateProfile({ name: "X" })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })
  })

  describe("deleteAccount", () => {
    it("should delete user account", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", email: "a@b.com", name: "T", stripeSubscriptionId: null } as never)
      prismaMock.user.delete.mockResolvedValue({} as never)

      const caller = authRouter.createCaller(ctx({
        user: { id: "user-1", email: "a@b.com", name: "T", image: null, plan: "FREE" },
      }))
      await expect(caller.deleteAccount()).resolves.toBeUndefined()
    })
  })
})
