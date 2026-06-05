import { describe, it, expect, vi, beforeEach } from "vitest"
import type { TRPCContext } from "@/server/trpc"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) { m[method] = vi.fn() }
    return m
  }
  return {
    workspaceMember: model(),
    workspaceInvitation: model(),
    workspace: model(),
    user: model(),
  }
})

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/server/services/email.service", () => ({
  emailService: { sendInvitationEmail: vi.fn().mockResolvedValue(undefined) },
}))

import { teamRouter } from "@/server/routers/team"

function ctx(overrides?: Partial<TRPCContext>): TRPCContext {
  return { db: prismaMock as never, session: null, user: undefined, ...overrides }
}
function authed(userId = "user-1"): TRPCContext {
  return ctx({
    user: { id: userId, email: "u@t.com", name: "U", image: null, plan: "FREE" },
  })
}

describe("teamRouter", () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe("invite", () => {
    it("should allow OWNER to invite", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: "m1", role: "OWNER", user: { name: "Owner" } } as never)
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws-1", name: "WS", ownerId: "user-1", owner: { plan: "PRO" } } as never)
      prismaMock.workspaceMember.count.mockResolvedValue(1)
      prismaMock.workspaceInvitation.create.mockResolvedValue({ id: "inv-1", token: "t1" } as never)

      const result = await teamRouter.createCaller(authed()).invite({ workspaceId: "ws-1", email: "new@t.com", role: "EDITOR" })
      expect(result).toEqual({ success: true })
    })

    it("should throw FORBIDDEN if VIEWER tries to invite", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: "m1", role: "VIEWER", user: { name: "V" } } as never)
      await expect(teamRouter.createCaller(authed("user-2")).invite({ workspaceId: "ws-1", email: "new@t.com", role: "EDITOR" }))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  describe("acceptInvitation", () => {
    it("should accept with valid token", async () => {
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue({
        id: "inv-1", workspaceId: "ws-1", token: "valid", email: "u@t.com", role: "EDITOR",
        expiresAt: new Date(Date.now() + 86400000), acceptedAt: null, workspace: { name: "WS" },
      } as never)
      prismaMock.workspaceMember.findUnique.mockResolvedValue(null)
      prismaMock.workspaceMember.create.mockResolvedValue({} as never)
      prismaMock.workspaceInvitation.update.mockResolvedValue({} as never)

      const result = await teamRouter.createCaller(ctx({
        user: { id: "user-1", email: "u@t.com", name: "U", image: null, plan: "FREE" },
      })).acceptInvitation({ token: "valid" })
      expect(result.workspaceId).toBe("ws-1")
    })

    it("should throw UNAUTHORIZED if not logged in", async () => {
      await expect(teamRouter.createCaller(ctx()).acceptInvitation({ token: "t" }))
        .rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })
  })

  describe("listMembers", () => {
    it("should return all workspace members", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: "m1", role: "OWNER" } as never)
      prismaMock.workspaceMember.findMany.mockResolvedValue([
        { id: "m1", userId: "u1", role: "OWNER", joinedAt: new Date(), user: { id: "u1", name: "Alice", email: "alice@t.com", image: null } },
        { id: "m2", userId: "u2", role: "EDITOR", joinedAt: new Date(), user: { id: "u2", name: "Bob", email: "bob@t.com", image: null } },
      ] as never)

      const result = await teamRouter.createCaller(authed()).listMembers({ workspaceId: "ws-1" })
      expect(result).toHaveLength(2)
      expect(result[0].user.name).toBe("Alice")
      expect(result[1].role).toBe("EDITOR")
    })

    it("should throw FORBIDDEN if user is not a workspace member", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue(null)

      await expect(teamRouter.createCaller(authed("outsider")).listMembers({ workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should throw UNAUTHORIZED if not logged in", async () => {
      await expect(teamRouter.createCaller(ctx()).listMembers({ workspaceId: "ws-1" }))
        .rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })

    it("should return members ordered by joinedAt ascending", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: "m1", role: "OWNER" } as never)
      prismaMock.workspaceMember.findMany.mockResolvedValue([
        { id: "m1", userId: "u1", role: "OWNER", joinedAt: new Date("2024-01-01"), user: { id: "u1", name: "A", email: "a@t.com", image: null } },
        { id: "m2", userId: "u2", role: "EDITOR", joinedAt: new Date("2024-06-01"), user: { id: "u2", name: "B", email: "b@t.com", image: null } },
      ] as never)

      const result = await teamRouter.createCaller(authed()).listMembers({ workspaceId: "ws-1" })
      expect(result[0].joinedAt).toEqual(new Date("2024-01-01"))
      expect(result[1].joinedAt).toEqual(new Date("2024-06-01"))
    })

    it("should return empty array if only the requester is a member", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: "m1", role: "OWNER" } as never)
      prismaMock.workspaceMember.findMany.mockResolvedValue([] as never)

      const result = await teamRouter.createCaller(authed()).listMembers({ workspaceId: "ws-1" })
      expect(result).toHaveLength(0)
    })
  })

  describe("removeMember", () => {
    it("should allow OWNER to remove a member", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce({ id: "target", role: "EDITOR" } as never)
      prismaMock.workspaceMember.delete.mockResolvedValue({} as never)

      const result = await teamRouter.createCaller(authed()).removeMember({ workspaceId: "ws-1", userId: "user-2" })
      expect(result).toEqual({ success: true })
    })

    it("should not allow OWNER to remove themselves", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)

      await expect(teamRouter.createCaller(authed()).removeMember({ workspaceId: "ws-1", userId: "user-1" }))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})
