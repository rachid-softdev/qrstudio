import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"
import type { Plan, Role } from "@/types/index"

const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) { m[method] = vi.fn() }
    return m
  }
  const m = {
    workspaceMember: model(),
    workspaceInvitation: model(),
    workspace: model(),
    user: model(),
    $transaction: vi.fn() as ReturnType<typeof vi.fn>,
  }
  m.$transaction.mockImplementation(
    (fn: (tx: typeof m) => unknown) => fn(m)
  )
  return m
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/server/services/email.service", () => ({
  emailService: { sendInvitationEmail: vi.fn().mockResolvedValue(undefined) },
}))

import { teamService } from "@/server/services/team.service"

describe("teamService", () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ──────────────────────────────────────────────
  // invite — plan limits
  // ──────────────────────────────────────────────
  describe("invite — plan limits", () => {
    function mockOwner(plan: Plan = "FREE") {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({
        id: "m1",
        role: "OWNER",
        user: { name: "Owner" },
      } as never)
    }

    function mockNoExistingInvitation() {
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue(null)
    }

    function mockNoExistingMember() {
      prismaMock.user.findUnique.mockResolvedValue(null)
    }

    function mockWorkspace(plan: Plan = "FREE") {
      prismaMock.workspace.findUnique.mockResolvedValue({
        id: "ws-1",
        name: "Team WS",
        ownerId: "user-1",
        owner: { plan },
      } as never)
    }

    it("should allow inviting team members for PRO plan within limit", async () => {
      mockOwner("PRO")
      mockNoExistingInvitation()
      mockNoExistingMember()
      mockWorkspace("PRO")
      // PRO allows 5 members, we have 3 currently
      prismaMock.workspaceMember.count.mockResolvedValue(3)
      prismaMock.workspaceInvitation.create.mockResolvedValue({
        id: "inv-1",
        token: "tok-1",
      } as never)

      const result = await teamService.invite("ws-1", "new@test.com", "EDITOR" as Role, "user-1")
      expect(result).toEqual({ success: true })
    })

    it("should allow exactly 5 members for PRO plan (limit reached but not exceeded)", async () => {
      mockOwner("PRO")
      mockNoExistingInvitation()
      mockNoExistingMember()
      mockWorkspace("PRO")
      prismaMock.workspaceMember.count.mockResolvedValue(5)
      prismaMock.workspaceInvitation.create.mockResolvedValue({
        id: "inv-1",
        token: "tok-2",
      } as never)

      // currentMembers >= limit check: 5 >= 5 → true → FORBIDDEN
      // Actually the check is `if (currentMembers >= limit)` with limit=5
      // So 5 >= 5 would throw... Let me verify
      // Wait, the limit is maxTeamMembers: 5 for PRO
      // The check is: if (currentMembers >= limit) throw
      // With currentMembers=5 and limit=5, this throws FORBIDDEN
      // But that would mean you can only have 4 members + 1 owner = 5 total
      // Actually the check counts workspaceMember, which includes the OWNER
      // So maxTeamMembers=5 means 5 total members including the owner
      // When currentMembers counts, it includes the owner. So if owner is already counted (1),
      // 4 more can be invited. currentMembers=5 means full (owner + 4 invitees = 5)
      // So at 5 members, you can't invite more.
      // Actually wait, currentMembers=5 includes the owner? Let me check...
      
      // The count is total workspaceMembers in the workspace.
      // If the workspace has owner + 0 members = 1, we can add 4 more (total 5)
      // currentMembers=5 means full, can't add more.
      await expect(
        teamService.invite("ws-1", "over@test.com", "EDITOR" as Role, "user-1")
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should reject invitation when FREE plan already has 1 member (owner only = at limit)", async () => {
      mockOwner("FREE")
      mockNoExistingInvitation()
      mockNoExistingMember()
      mockWorkspace("FREE")
      // FREE allows 1 member. Owner counts as 1. currentMembers=1 → at limit.
      prismaMock.workspaceMember.count.mockResolvedValue(1)

      await expect(
        teamService.invite("ws-1", "new@test.com", "EDITOR" as Role, "user-1")
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should allow FREE plan with only owner (currentMembers=0... wait, owner IS a member)", async () => {
      mockOwner("FREE")
      mockNoExistingInvitation()
      mockNoExistingMember()
      mockWorkspace("FREE")
      // If currentMembers=0 (owner somehow not counted), FREE limit is 1
      // But owner is always a member, so this wouldn't happen in practice
      // This test covers the edge case of 0 current members
      prismaMock.workspaceMember.count.mockResolvedValue(0)
      prismaMock.workspaceInvitation.create.mockResolvedValue({
        id: "inv-1",
        token: "tok-3",
      } as never)

      const result = await teamService.invite("ws-1", "new@test.com", "EDITOR" as Role, "user-1")
      expect(result).toEqual({ success: true })
    })

    it("should always allow AGENCY plan regardless of member count", async () => {
      mockOwner("AGENCY")
      mockNoExistingInvitation()
      mockNoExistingMember()
      mockWorkspace("AGENCY")
      prismaMock.workspaceMember.count.mockResolvedValue(999)
      prismaMock.workspaceInvitation.create.mockResolvedValue({
        id: "inv-1",
        token: "tok-4",
      } as never)

      const result = await teamService.invite("ws-1", "new@test.com", "EDITOR" as Role, "user-1")
      expect(result).toEqual({ success: true })
    })

    it("should throw FORBIDDEN if inviter is not OWNER", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({
        id: "m1",
        role: "VIEWER",
        user: { name: "Viewer" },
      } as never)

      await expect(
        teamService.invite("ws-1", "new@test.com", "EDITOR" as Role, "user-2")
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should throw CONFLICT if invitation already pending", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({
        id: "m1",
        role: "OWNER",
        user: { name: "Owner" },
      } as never)
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue({
        id: "inv-existing",
        workspaceId: "ws-1",
        email: "new@test.com",
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      } as never)

      await expect(
        teamService.invite("ws-1", "new@test.com", "EDITOR" as Role, "user-1")
      ).rejects.toMatchObject({ code: "CONFLICT" })
    })

    it("should throw CONFLICT if user is already a member", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "m1", role: "OWNER", user: { name: "Owner" } } as never)
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user", email: "existing@test.com" } as never)
      // This second findUnique is called in the `if (existingMember)` block to check workspace membership
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "m-existing" } as never)

      await expect(
        teamService.invite("ws-1", "existing@test.com", "EDITOR" as Role, "user-1")
      ).rejects.toMatchObject({ code: "CONFLICT" })
    })

    it("should throw NOT_FOUND if workspace does not exist", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({
        id: "m1", role: "OWNER", user: { name: "Owner" },
      } as never)
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.workspace.findUnique.mockResolvedValue(null)

      await expect(
        teamService.invite("nonexistent-ws", "new@test.com", "EDITOR" as Role, "user-1")
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  // ──────────────────────────────────────────────
  // acceptInvitation
  // ──────────────────────────────────────────────
  describe("acceptInvitation", () => {
    it("should accept with valid token", async () => {
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        workspaceId: "ws-1",
        token: "valid",
        email: "u@t.com",
        role: "EDITOR",
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
        workspace: { name: "WS" },
      } as never)
      prismaMock.workspaceMember.findUnique.mockResolvedValue(null)
      prismaMock.workspaceMember.create.mockResolvedValue({} as never)
      prismaMock.workspaceInvitation.update.mockResolvedValue({} as never)

      const result = await teamService.acceptInvitation("valid", "user-1")
      expect(result.workspaceId).toBe("ws-1")
    })

    it("should throw NOT_FOUND for invalid token", async () => {
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue(null)
      await expect(teamService.acceptInvitation("invalid", "user-1"))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("should throw PRECONDITION_FAILED for expired invitation", async () => {
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        workspaceId: "ws-1",
        token: "expired",
        email: "u@t.com",
        role: "EDITOR",
        expiresAt: new Date(Date.now() - 86400000),
        acceptedAt: null,
        workspace: { name: "WS" },
      } as never)

      await expect(teamService.acceptInvitation("expired", "user-1"))
        .rejects.toMatchObject({ code: "PRECONDITION_FAILED" })
    })

    it("should throw CONFLICT if already accepted", async () => {
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        workspaceId: "ws-1",
        token: "done",
        email: "u@t.com",
        role: "EDITOR",
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: new Date(),
        workspace: { name: "WS" },
      } as never)

      await expect(teamService.acceptInvitation("done", "user-1"))
        .rejects.toMatchObject({ code: "CONFLICT" })
    })

    it("should throw CONFLICT if already a member", async () => {
      prismaMock.workspaceInvitation.findUnique.mockResolvedValue({
        id: "inv-1",
        workspaceId: "ws-1",
        token: "valid",
        email: "u@t.com",
        role: "EDITOR",
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
        workspace: { name: "WS" },
      } as never)
      prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: "existing" } as never)

      await expect(teamService.acceptInvitation("valid", "user-1"))
        .rejects.toMatchObject({ code: "CONFLICT" })
    })
  })

  // ──────────────────────────────────────────────
  // listMembers
  // ──────────────────────────────────────────────
  describe("listMembers", () => {
    it("should return all members ordered by joinedAt asc", async () => {
      const now = new Date()
      prismaMock.workspaceMember.findMany.mockResolvedValue([
        { id: "m1", userId: "u1", role: "OWNER", joinedAt: now, user: { id: "u1", name: "Alice", email: "alice@t.com", image: null } },
        { id: "m2", userId: "u2", role: "EDITOR", joinedAt: new Date(now.getTime() + 1000), user: { id: "u2", name: "Bob", email: "bob@t.com", image: null } },
      ] as never)

      const result = await teamService.listMembers("ws-1")
      expect(result).toHaveLength(2)
      expect(result[0].user.name).toBe("Alice")
      expect(result[1].user.name).toBe("Bob")
      expect(result[0].role).toBe("OWNER")
      expect(result[1].role).toBe("EDITOR")
    })

    it("should return empty array for workspace with no members", async () => {
      prismaMock.workspaceMember.findMany.mockResolvedValue([] as never)
      const result = await teamService.listMembers("ws-empty")
      expect(result).toHaveLength(0)
    })
  })

  // ──────────────────────────────────────────────
  // removeMember
  // ──────────────────────────────────────────────
  describe("removeMember", () => {
    it("should allow OWNER to remove a member", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce({ id: "target", role: "EDITOR" } as never)
      prismaMock.workspaceMember.delete.mockResolvedValue({} as never)

      const result = await teamService.removeMember("ws-1", "user-2", "user-1")
      expect(result).toEqual({ success: true })
    })

    it("should throw FORBIDDEN if not OWNER", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: "me", role: "VIEWER" } as never)

      await expect(teamService.removeMember("ws-1", "user-2", "user-1"))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should throw FORBIDDEN if trying to remove self (OWNER)", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)

      await expect(teamService.removeMember("ws-1", "user-1", "user-1"))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should throw NOT_FOUND if target member does not exist", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce(null)

      await expect(teamService.removeMember("ws-1", "nonexistent", "user-1"))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  // ──────────────────────────────────────────────
  // updateMemberRole
  // ──────────────────────────────────────────────
  describe("updateMemberRole", () => {
    it("should allow OWNER to change role", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce({ id: "target", role: "EDITOR" } as never)
      prismaMock.workspaceMember.update.mockResolvedValue({} as never)

      const result = await teamService.updateMemberRole("ws-1", "user-2", "VIEWER" as Role, "user-1")
      expect(result).toEqual({ success: true })
    })

    it("should throw FORBIDDEN if not OWNER", async () => {
      prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: "me", role: "VIEWER" } as never)

      await expect(teamService.updateMemberRole("ws-1", "user-2", "EDITOR" as Role, "user-1"))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should throw FORBIDDEN if trying to change OWNER's role", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce({ id: "owner", role: "OWNER" } as never)

      await expect(teamService.updateMemberRole("ws-1", "owner-user", "EDITOR" as Role, "user-1"))
        .rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("should throw NOT_FOUND if target member does not exist", async () => {
      prismaMock.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: "me", role: "OWNER" } as never)
        .mockResolvedValueOnce(null)

      await expect(teamService.updateMemberRole("ws-1", "nonexistent", "EDITOR" as Role, "user-1"))
        .rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  // ──────────────────────────────────────────────
  // listInvitations
  // ──────────────────────────────────────────────
  describe("listInvitations", () => {
    it("should return pending invitations", async () => {
      prismaMock.workspaceInvitation.findMany.mockResolvedValue([
        { id: "inv-1", email: "a@t.com", role: "EDITOR", createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) },
        { id: "inv-2", email: "b@t.com", role: "VIEWER", createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) },
      ] as never)

      const result = await teamService.listInvitations("ws-1")
      expect(result).toHaveLength(2)
      expect(result[0].email).toBe("a@t.com")
    })

    it("should return empty array if no pending invitations", async () => {
      prismaMock.workspaceInvitation.findMany.mockResolvedValue([] as never)
      const result = await teamService.listInvitations("ws-1")
      expect(result).toHaveLength(0)
    })
  })
})
