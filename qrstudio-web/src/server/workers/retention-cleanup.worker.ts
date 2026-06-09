import { getQueue, QUEUE_NAMES } from "@/server/queue"
import { prisma } from "@/server/db"
import * as Sentry from "@sentry/nextjs"
import logger from "@/lib/logger"

const BATCH_DELETE_LIMIT = 10_000

/**
 * RetentionCleanupWorker:
 * Runs daily at 03:00 via PgBoss schedule.
 * Purges raw Scan rows beyond the retention period per plan:
 *  - FREE  → 30 days
 *  - PRO   → 365 days
 *  - AGENCY → unlimited (no purge)
 *
 * ScanDaily summary rows are NOT deleted — they are tiny (one row per QR code per day)
 * and retention is enforced at query time via the WHERE clause on date.
 */
export async function startRetentionCleanupWorker(): Promise<void> {
  const queue = await getQueue()

  // Run daily at 03:00 system time
  await queue.schedule("retention-cleanup-tick", "0 0 3 * * *", null, {
    singletonKey: QUEUE_NAMES.RETENTION_CLEANUP,
    singletonSeconds: 3600,
  })

  await queue.work(QUEUE_NAMES.RETENTION_CLEANUP, async () => {
    try {
      const cutoffFree = new Date(Date.now() - 30 * 86_400_000)
      const cutoffPro = new Date(Date.now() - 365 * 86_400_000)

      // Delete FREE scans older than 30 days
      const deletedFree = await prisma.$executeRaw`
        DELETE FROM "Scan" s
        WHERE s."scannedAt" < ${cutoffFree}
        AND EXISTS (
          SELECT 1 FROM "QRCode" q
          JOIN "Workspace" w ON w.id = q."workspaceId"
          JOIN "User" u ON u.id = w."ownerId"
          WHERE q.id = s."qrCodeId" AND u.plan = 'FREE'
        )
        LIMIT ${BATCH_DELETE_LIMIT}
      `

      // Delete PRO scans older than 365 days
      const deletedPro = await prisma.$executeRaw`
        DELETE FROM "Scan" s
        WHERE s."scannedAt" < ${cutoffPro}
        AND EXISTS (
          SELECT 1 FROM "QRCode" q
          JOIN "Workspace" w ON w.id = q."workspaceId"
          JOIN "User" u ON u.id = w."ownerId"
          WHERE q.id = s."qrCodeId" AND u.plan = 'PRO'
        )
        LIMIT ${BATCH_DELETE_LIMIT}
      `

      logger.info(
        `[RetentionCleanup] Deleted FREE=${deletedFree} PRO=${deletedPro} scan rows`,
      )
    } catch (error) {
      Sentry.captureException(error)
      logger.error(error, "[RetentionCleanup] Failed")
      throw error
    }
  })
}
