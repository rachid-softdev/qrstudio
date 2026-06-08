import { describe, it, expect, vi, beforeEach } from "vitest"
import type { TRPCContext } from "@/server/trpc"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) { m[method] = vi.fn() }
    return m
  }
  return {
    user: model(),
    apiKey: model(),
  }
})

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
vi.mock("@/server/db", () => ({ prisma: prismaMock }))
import { apiKeyRouter } from "@/server/routers/apiKey"

function ctx(overrides?: Partial<TRPCContext>): TRPCContext {
  return { db: prismaMock as never, session: null, user: undefined, workspace: undefined, ...overrides }
}
function authed(userId = "user-1", plan = "FREE"): TRPCContext {
  return ctx({ user: { id: userId, email: "u@t.com", name: "U", image: null, plan }, reqHeaders: { "x-csrf-token": "1" } })
}

describe("apiKeyRouter", () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe("generate", () => {
    it("should allow PRO user to generate an API key", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", plan: "PRO" } as never)
      prismaMock.apiKey.create.mockResolvedValue({ id: "k-1" } as never)

      const result = await apiKeyRouter.createCaller(authed("user-1", "PRO")).generate({ name: "My Key" })
      expect(result.name).toBe("My Key")
      expect(result.key).toMatch(/^qrs_/)
    })

    it("should reject FREE user from generating API key", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", plan: "FREE" } as never)
      await expect(apiKeyRouter.createCaller(authed("user-1", "FREE")).generate({ name: "My Key" }))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  describe("list", () => {
    it("should return list of API keys for PRO+ user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", plan: "PRO" } as never)
      prismaMock.apiKey.findMany.mockResolvedValue([{ id: "k-1", name: "Key 1", keyPrefix: "qrs_abc", createdAt: new Date(), lastUsedAt: null }] as never)

      const result = await apiKeyRouter.createCaller(authed("user-1", "PRO")).list()
      expect(result).toHaveLength(1)
    })
  })

  describe("revoke", () => {
    it("should soft-delete an API key (set revokedAt)", async () => {
      prismaMock.apiKey.findFirst.mockResolvedValue({ id: "k-1", userId: "user-1", revokedAt: null } as never)
      prismaMock.apiKey.update.mockResolvedValue({} as never)

      const result = await apiKeyRouter.createCaller(authed()).revoke({ id: "k-1" })
      expect(result).toEqual({ success: true })
      expect(prismaMock.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "k-1" },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        })
      )
    })

    it("should throw NOT_FOUND if key does not belong to user", async () => {
      prismaMock.apiKey.findFirst.mockResolvedValue(null)
      await expect(apiKeyRouter.createCaller(authed()).revoke({ id: "k-1" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })
})
