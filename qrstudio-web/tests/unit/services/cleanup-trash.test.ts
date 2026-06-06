import { describe, it, expect, vi, beforeEach } from "vitest"

const prismaMock = vi.hoisted(() => ({
  qRCode: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock("@/server/db", () => ({ prisma: prismaMock }))

const mockQueue = vi.hoisted(() => ({
  schedule: vi.fn(),
  work: vi.fn(),
}))

vi.mock("@/server/queue", () => ({
  getQueue: vi.fn().mockResolvedValue(mockQueue),
  QUEUE_NAMES: { CLEANUP_TRASH: "cleanup-trash" },
}))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { startCleanupTrashWorker } from "@/server/workers/cleanup-trash.worker"

describe("cleanupTrash", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function runWorker(): Promise<void> {
    await startCleanupTrashWorker()
    const workHandler = mockQueue.work.mock.calls[0]?.[1]
    await workHandler()
  }

  it("should delete FREE codes older than 7 days", async () => {
    prismaMock.qRCode.findMany
      .mockResolvedValueOnce([{ id: "qr-1" }, { id: "qr-2" }])
      .mockResolvedValue([])
    prismaMock.qRCode.deleteMany.mockResolvedValue({ count: 2 })

    await runWorker()

    expect(prismaMock.qRCode.findMany).toHaveBeenCalledTimes(3)
    expect(prismaMock.qRCode.deleteMany).toHaveBeenCalledTimes(1)

    const findCall = prismaMock.qRCode.findMany.mock.calls[0][0]
    expect(findCall.where.deletedAt).toEqual({ not: null, lt: expect.any(Date) })
    expect(findCall.where.workspace.owner.plan).toBe("FREE")
  })

  it("should delete PRO codes older than 30 days", async () => {
    prismaMock.qRCode.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "qr-3" }])
      .mockResolvedValue([])
    prismaMock.qRCode.deleteMany.mockResolvedValue({ count: 1 })

    await runWorker()

    expect(prismaMock.qRCode.findMany).toHaveBeenCalledTimes(3)
    const findCall = prismaMock.qRCode.findMany.mock.calls[1][0]
    expect(findCall.where.workspace.owner.plan).toBe("PRO")
  })

  it("should delete AGENCY codes older than 90 days", async () => {
    prismaMock.qRCode.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "qr-4" }])
    prismaMock.qRCode.deleteMany.mockResolvedValue({ count: 1 })

    await runWorker()

    expect(prismaMock.qRCode.findMany).toHaveBeenCalledTimes(3)
    const findCall = prismaMock.qRCode.findMany.mock.calls[2][0]
    expect(findCall.where.workspace.owner.plan).toBe("AGENCY")
  })

  it("should not delete active codes (deletedAt null)", async () => {
    prismaMock.qRCode.findMany.mockResolvedValue([])

    await runWorker()

    // All 3 findMany calls include deletedAt: { not: null, lt: ... }
    for (const call of prismaMock.qRCode.findMany.mock.calls) {
      expect(call[0].where.deletedAt).toEqual({ not: null, lt: expect.any(Date) })
    }
    // No deleteMany called because no results
    expect(prismaMock.qRCode.deleteMany).not.toHaveBeenCalled()
  })
})
