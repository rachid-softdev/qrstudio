import { getQueue, QUEUE_NAMES } from "@/server/queue"
import { analyticsService } from "@/server/services/analytics.service"
import type { ScanInput } from "@/server/services/analytics.service"
import * as Sentry from "@sentry/nextjs"

export async function startScanRecorderWorker() {
  const queue = await getQueue()
  await queue.work<ScanInput>(QUEUE_NAMES.RECORD_SCAN, async ([job]) => {
    try {
      await analyticsService.recordScan(job.data)
    } catch (error) {
      Sentry.captureException(error)
      throw error
    }
  })
}
