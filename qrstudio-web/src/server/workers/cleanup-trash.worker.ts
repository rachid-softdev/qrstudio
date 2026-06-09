import { getQueue, QUEUE_NAMES } from "@/server/queue"
import { prisma } from "@/server/db"
import type { Plan } from "@prisma/client"
import * as Sentry from "@sentry/nextjs"
import logger from "@/lib/logger"

const BATCH_DELETE_LIMIT = 10_000

/**
 * CleanupTrashWorker:
 * Runs daily at 03:30 via PgBoss schedule (staggered from retention cleanup at 03:00).
 * Permanently deletes QR codes that have been soft-deleted beyond the retention period per plan:
 *  - FREE  → 7 days
 *  - PRO   → 30 days
 *  - AGENCY → 90 days
 *
 * LandingPage rows are cascaded automatically (onDelete: Cascade on QRCode).
 */
export async function startCleanupTrashWorker(): Promise<void> {
  const queue = await getQueue()

  // Run daily at 03:30 — staggered from retention cleanup at 03:00
  await queue.schedule("cleanup-trash-tick", "0 30 3 * * *", null, {
    singletonKey: QUEUE_NAMES.CLEANUP_TRASH,
    singletonSeconds: 3600,
  })

  await queue.work(QUEUE_NAMES.CLEANUP_TRASH, async () => {
    try {
      const plans: { plan: string; retentionDays: number }[] = [
        { plan: 'FREE', retentionDays: 7 },
        { plan: 'PRO', retentionDays: 30 },
        { plan: 'AGENCY', retentionDays: 90 },
      ]

      for (const { plan, retentionDays } of plans) {
        const cutoff = new Date(Date.now() - retentionDays * 86_400_000)

        // Use Prisma-level queries to avoid raw SQL with enum casts
        const qrCodes = await prisma.qRCode.findMany({
          where: {
            deletedAt: { not: null, lt: cutoff },
            workspace: { owner: { plan: plan as Plan } },
          },
          take: BATCH_DELETE_LIMIT,
          select: { id: true },
        })

        if (qrCodes.length > 0) {
          const ids = qrCodes.map((q) => q.id)
          const result = await prisma.qRCode.deleteMany({
            where: { id: { in: ids } },
          })
          logger.info(`[CleanupTrash] Deleted ${result.count} ${plan} QR codes from trash`)
        }
      }
    } catch (error) {
      Sentry.captureException(error)
      logger.error(error, "[CleanupTrash] Failed")
      throw error
    }
  })
}
