import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")

    const { startScanRecorderWorker } = await import("@/server/workers/scan-recorder")
    await startScanRecorderWorker()

    const { startAggregationWorker } = await import("@/server/workers/aggregation.worker")
    await startAggregationWorker()

    const { startRetentionCleanupWorker } = await import("@/server/workers/retention-cleanup.worker")
    await startRetentionCleanupWorker()
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
