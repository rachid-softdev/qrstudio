import { PgBoss } from "pg-boss"
import { withRetry } from "@/lib/retry"
import logger from "@/lib/logger"

let boss: PgBoss | null = null

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({ connectionString: process.env.DATABASE_URL! })
    await withRetry(() => boss!.start(), {
      maxRetries: 3,
      baseDelay: 1000,
    })
    // Configure each queue with retry and retention policies
    for (const qName of Object.values(QUEUE_NAMES)) {
      try {
        await boss!.createQueue(qName, {
          retryLimit: 3,
          retryDelay: 5,
          deleteAfterSeconds: 2592000, // 30 days
        })
      } catch {
        // Queue may already exist; ignore creation errors
      }
    }
  }
  return boss
}

export const QUEUE_NAMES = {
  RECORD_SCAN: "record-scan",
  AGGREGATE_SCANS: "aggregate-scans",
  RETENTION_CLEANUP: "retention-cleanup",
  CLEANUP_TRASH: "cleanup-trash",
} as const

/**
 * Monitor the DLQ by counting failed jobs across all queues.
 */
export async function monitorDLQ(): Promise<number> {
  try {
    const queue = await getQueue()
    let totalFailed = 0
    for (const qName of Object.values(QUEUE_NAMES)) {
      const stats = await queue.getQueueStats(qName)
      // totalCount includes all job states (created, retry, active, completed, cancelled, failed)
      // We use findJobs to get failed jobs for monitoring
      const jobs = await queue.findJobs(qName, { queued: false })
      const failed = jobs.filter((j) => j.state === "failed").length
      totalFailed += failed
    }
    if (totalFailed > 0) {
      logger.warn({ failedCount: totalFailed }, "DLQ has failed jobs")
    }
    return totalFailed
  } catch (error) {
    logger.error(error, "Failed to monitor DLQ")
    return -1
  }
}
