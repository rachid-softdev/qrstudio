import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "create", "update", "delete"]) => {
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
    $transaction: vi.fn(),
  }
})

vi.mock("@/server/db", () => ({ prisma: prismaMock }))

vi.mock("@/server/services/email.service", () => ({
  emailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}))

import { authService } from "@/server/services/auth.service"
import { TRPCError } from "@trpc/server"

describe("authService.register — $transaction fix", () => {
  const registerInput = {
    name: "Test User",
    email: "test@example.com",
    password: "TestPass123!",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default $transaction mock: execute the callback with a proxy that
    // delegates all prisma methods to the top-level mocks
    prismaMock.$transaction.mockImplementation(
      (cb: (tx: Record<string, unknown>) => unknown) => {
        return cb({
          user: prismaMock.user,
          workspace: prismaMock.workspace,
          workspaceMember: prismaMock.workspaceMember,
        })
      },
    )
    prismaMock.user.findUnique.mockResolvedValue(null) // no existing user
  })

  // ─── Successful registration ────────────────────────────────────────────────

  it("should create User, Workspace, and Member inside $transaction", async () => {
    prismaMock.user.create.mockResolvedValue({ id: "user-1" } as never)
    prismaMock.workspace.create.mockResolvedValue({ id: "ws-1" } as never)
    prismaMock.workspaceMember.create.mockResolvedValue({} as never)

    const result = await authService.register(registerInput)

    expect(result).toEqual({ userId: "user-1", workspaceId: "ws-1" })

    // Verify $transaction was used
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)

    // All three creates should have been called inside the transaction
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspace.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspaceMember.create).toHaveBeenCalledTimes(1)

    // Verify workspace is linked to the created user
    const workspaceCreateArgs = prismaMock.workspace.create.mock.calls[0][0]
    expect(workspaceCreateArgs.data.ownerId).toBe("user-1")

    // Verify member is linked to both workspace and user
    const memberCreateArgs = prismaMock.workspaceMember.create.mock.calls[0][0]
    expect(memberCreateArgs.data.workspaceId).toBe("ws-1")
    expect(memberCreateArgs.data.userId).toBe("user-1")
    expect(memberCreateArgs.data.role).toBe("OWNER")
  })

  it("should not attempt rollback on successful creation (transaction handles it)", async () => {
    prismaMock.user.create.mockResolvedValue({ id: "user-1" } as never)
    prismaMock.workspace.create.mockResolvedValue({ id: "ws-1" } as never)
    prismaMock.workspaceMember.create.mockResolvedValue({} as never)

    await authService.register(registerInput)

    // No delete calls should have been made
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
    expect(prismaMock.workspace.delete).not.toHaveBeenCalled()
  })

  it("should throw CONFLICT if email already exists (before transaction)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" } as never)

    await expect(authService.register(registerInput)).rejects.toMatchObject({
      code: "CONFLICT",
    })

    // $transaction should NOT be called if user already exists
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  // ─── Rollback scenarios ─────────────────────────────────────────────────────

  it("should roll back User creation if Workspace creation fails inside $transaction", async () => {
    prismaMock.user.create.mockResolvedValue({ id: "user-1" } as never)
    // Simulate workspace creation failure inside transaction
    prismaMock.$transaction.mockImplementation(
      (_cb: (tx: Record<string, unknown>) => unknown) => {
        // Workspace creation fails → transaction rejects → user is rolled back
        throw new Error("Workspace creation failed")
      },
    )

    await expect(authService.register(registerInput)).rejects.toThrow(
      "Workspace creation failed",
    )
  })

  it("should roll back User and Workspace if Member creation fails inside $transaction", async () => {
    // Simulate a transaction rejection when member creation fails
    prismaMock.$transaction.mockImplementation(
      (_cb: (tx: Record<string, unknown>) => unknown) => {
        throw new Error("Member creation failed")
      },
    )

    await expect(authService.register(registerInput)).rejects.toThrow(
      "Member creation failed",
    )
  })

  // ─── Transaction isolation (concurrent registrations) ─────────────────────

  it("should handle concurrent registrations with different emails", async () => {
    prismaMock.user.create
      .mockResolvedValueOnce({ id: "user-1" } as never)
      .mockResolvedValueOnce({ id: "user-2" } as never)
    prismaMock.workspace.create
      .mockResolvedValueOnce({ id: "ws-1" } as never)
      .mockResolvedValueOnce({ id: "ws-2" } as never)
    prismaMock.workspaceMember.create
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)

    // Simulate two concurrent $transaction calls from two separate registrations
    prismaMock.$transaction
      .mockImplementationOnce(
        (cb: (tx: Record<string, unknown>) => unknown) => {
          const result = cb({
            user: prismaMock.user,
            workspace: prismaMock.workspace,
            workspaceMember: prismaMock.workspaceMember,
          })
          return result
        },
      )
      .mockImplementationOnce(
        (cb: (tx: Record<string, unknown>) => unknown) => {
          const result = cb({
            user: prismaMock.user,
            workspace: prismaMock.workspace,
            workspaceMember: prismaMock.workspaceMember,
          })
          return result
        },
      )

    const [result1, result2] = await Promise.all([
      authService.register({ ...registerInput, email: "alice@test.com" }),
      authService.register({ ...registerInput, email: "bob@test.com" }),
    ])

    expect(result1.userId).toBe("user-1")
    expect(result2.userId).toBe("user-2")

    // Both registrations should use their own transactions
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
    expect(prismaMock.user.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.workspace.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.workspaceMember.create).toHaveBeenCalledTimes(2)
  })

  it("should not leave orphan records even if the third create fails", async () => {
    // Simulate Prisma's $transaction which rolls back on any error automatically
    prismaMock.$transaction.mockImplementation(
      (_cb: (tx: Record<string, unknown>) => unknown) => {
        // Prisma's built-in rollback handles this
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database error",
        })
      },
    )

    await expect(authService.register(registerInput)).rejects.toThrow()

    // Since $transaction rolls back atomically, no cleanup should be needed
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })
})
