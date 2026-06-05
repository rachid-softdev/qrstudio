import { getQueue, QUEUE_NAMES } from "@/server/queue"
import { aggregationService } from "@/server/services/aggregation.service"
import * as Sentry from "@sentry/nextjs"

/**
 * AggregationWorker:
 * Scheduled PgBoss worker that runs every 60 seconds via singletonKey.
 * Processes new raw Scan rows since the last watermark and upserts into ScanDaily.
 */
export async function startAggregationWorker(): Promise<void> {
  const queue = await getQueue()

  // Schedule every 60 seconds, singleton so only one runs at a time
  await queue.schedule("aggregate-scans-tick", "*/60 * * * * *", null, {
    singletonKey: QUEUE_NAMES.AGGREGATE_SCANS,
    singletonSeconds: 60,
  })

  await queue.work(QUEUE_NAMES.AGGREGATE_SCANS, async () => {
    try {
      const processed = await aggregationService.aggregateNextBatch()
      if (processed > 0) {
        console.log(`[AggregationWorker] Aggregated ${processed} scan rows`)
      }
    } catch (error) {
      Sentry.captureException(error)
      console.error("[AggregationWorker] Failed:", error)
      throw error
    }
  })
}
