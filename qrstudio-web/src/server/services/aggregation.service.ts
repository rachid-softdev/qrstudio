import { prisma } from "@/server/db"
import { invalidateAnalyticsCache } from "@/server/cache/analytics-cache"
import * as Sentry from "@sentry/nextjs"

const BATCH_SIZE = 50_000

/**
 * AggregationService handles the incremental aggregation of raw Scan rows
 * into the ScanDaily summary table. Designed to be called from the PgBoss
 * aggregation worker (every 60 seconds).
 *
 * Key design decisions:
 *  - Uses a watermark table (AggregationWatermark) to track progress
 *  - Employs a 60-second buffer (NOW() - 60s) to avoid processing in-flight scans
 *  - Uses a single SQL upsert for efficiency
 *  - Invalidates affected Redis cache keys on completion
 */
export const aggregationService = {
  /**
   * Process all unaggregated Scan rows and upsert into ScanDaily.
   * Returns the number of rows processed.
   */
  async aggregateNextBatch(): Promise<number> {
    const now = new Date()
    const bufferEnd = new Date(now.getTime() - 60_000) // 60s buffer

    // 1. Read the watermark
    const watermark = await prisma.aggregationWatermark.findUnique({
      where: { queueName: "aggregate-scans" },
    })
    const lastProcessedAt = watermark?.lastProcessedAt ?? new Date(0)

    if (lastProcessedAt >= bufferEnd) {
      return 0 // Nothing to aggregate yet
    }

    // 2. Run the aggregation upsert SQL
    const result = await prisma.$executeRawUnsafe(`
      WITH batch AS (
        SELECT
          s."qrCodeId",
          DATE(s."scannedAt")                                         AS date,
          COUNT(*)::int                                               AS total_scans,
          COUNT(DISTINCT s."ipHash")::int                             AS unique_ips,
          jsonb_object_agg(s."country", s.cnt) FILTER (WHERE s."country" IS NOT NULL)  AS by_country,
          jsonb_object_agg(s."deviceType", s.cnt) FILTER (WHERE s."deviceType" IS NOT NULL) AS by_device,
          jsonb_object_agg(s."os", s.cnt) FILTER (WHERE s."os" IS NOT NULL)             AS by_os,
          jsonb_object_agg(s."browser", s.cnt) FILTER (WHERE s."browser" IS NOT NULL)   AS by_browser
        FROM (
          SELECT
            "qrCodeId", "scannedAt", "ipHash", "country", "deviceType", "os", "browser",
            COUNT(*) AS cnt
          FROM "Scan"
          WHERE "scannedAt" > $1 AND "scannedAt" < $2
          GROUP BY "qrCodeId", "scannedAt", "ipHash", "country", "deviceType", "os", "browser"
        ) s
        GROUP BY s."qrCodeId", DATE(s."scannedAt")
      )
      INSERT INTO "ScanDaily" ("qrCodeId", "date", "totalScans", "uniqueIps", "byCountry", "byDevice", "byOs", "byBrowser")
      SELECT
        b."qrCodeId", b.date, b.total_scans, b.unique_ips,
        b.by_country, b.by_device, b.by_os, b.by_browser
      FROM batch b
      ON CONFLICT ("qrCodeId", "date") DO UPDATE SET
        "totalScans" = "ScanDaily"."totalScans" + EXCLUDED."totalScans",
        "uniqueIps"  = "ScanDaily"."uniqueIps"  + EXCLUDED."uniqueIps",
        "byCountry"  = COALESCE("ScanDaily"."byCountry", '{}'::jsonb) || COALESCE(EXCLUDED."byCountry", '{}'::jsonb),
        "byDevice"   = COALESCE("ScanDaily"."byDevice",  '{}'::jsonb) || COALESCE(EXCLUDED."byDevice",  '{}'::jsonb),
        "byOs"       = COALESCE("ScanDaily"."byOs",      '{}'::jsonb) || COALESCE(EXCLUDED."byOs",      '{}'::jsonb),
        "byBrowser"  = COALESCE("ScanDaily"."byBrowser", '{}'::jsonb) || COALESCE(EXCLUDED."byBrowser", '{}'::jsonb)
    `, lastProcessedAt, bufferEnd)

    // 3. Update watermark
    await prisma.aggregationWatermark.upsert({
      where: { queueName: "aggregate-scans" },
      create: {
        queueName: "aggregate-scans",
        lastProcessedAt: bufferEnd,
      },
      update: {
        lastProcessedAt: bufferEnd,
      },
    })

    // 4. Invalidate cache for affected QR codes
    const affectedQrCodes = await this.getAffectedQrCodes(lastProcessedAt, bufferEnd)
    await Promise.all(
      affectedQrCodes.map((id) =>
        invalidateAnalyticsCache(id).catch((err) => {
          Sentry.captureException(err)
        }),
      ),
    )

    // result is the number of rows inserted/updated or null
    return result ?? 0
  },

  /**
   * Backfill ScanDaily for all historical Scan data.
   * Processes in batches to avoid long-running transactions.
   */
  async backfillAll(): Promise<{ processed: number; duration: number }> {
    const start = Date.now()

    // Clear existing summary data before backfill
    await prisma.scanDaily.deleteMany()
    await prisma.aggregationWatermark.deleteMany({
      where: { queueName: "aggregate-scans" },
    })

    let cursor: string | undefined
    let totalProcessed = 0

    do {
      const batch = await prisma.scan.findMany({
        where: cursor ? { id: { gt: cursor } } : {},
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        select: {
          id: true,
          qrCodeId: true,
          scannedAt: true,
          ipHash: true,
          country: true,
          deviceType: true,
          os: true,
          browser: true,
        },
      })

      if (batch.length === 0) break

      // Build a temporary table from the batch and run the same aggregation SQL
      // We use a simpler approach: aggregate in-memory and upsert
      const grouped = this._groupBatchForUpsert(batch)
      await this._upsertBatch(grouped)

      cursor = batch[batch.length - 1].id
      totalProcessed += batch.length
    } while (cursor)

    // Set watermark to now after backfill complete
    await prisma.aggregationWatermark.upsert({
      where: { queueName: "aggregate-scans" },
      create: {
        queueName: "aggregate-scans",
        lastProcessedAt: new Date(),
      },
      update: {
        lastProcessedAt: new Date(),
      },
    })

    return { processed: totalProcessed, duration: Date.now() - start }
  },

  /**
   * Get the set of QR code IDs that had scans in the given time range.
   */
  async getAffectedQrCodes(
    from: Date,
    to: Date,
  ): Promise<string[]> {
    const rows = await prisma.$queryRawUnsafe<{ qrCodeId: string }[]>(
      `SELECT DISTINCT "qrCodeId" FROM "Scan" WHERE "scannedAt" > $1 AND "scannedAt" < $2`,
      from,
      to,
    )
    return rows.map((r) => r.qrCodeId)
  },

  // ─── Internal helpers (prefixed with _ for convention) ──────────────────────

  /**
   * Aggregate a batch of Scan rows into ScanDaily-compatible groups.
   */
  _groupBatchForUpsert(
    batch: {
      qrCodeId: string
      scannedAt: Date
      ipHash: string | null
      country: string | null
      deviceType: string | null
      os: string | null
      browser: string | null
    }[],
  ): Map<string, { date: string; total: number; uniqueIps: Set<string>; byCountry: Map<string, number>; byDevice: Map<string, number>; byOs: Map<string, number>; byBrowser: Map<string, number> }> {
    const grouped = new Map<string, {
      date: string
      total: number
      uniqueIps: Set<string>
      byCountry: Map<string, number>
      byDevice: Map<string, number>
      byOs: Map<string, number>
      byBrowser: Map<string, number>
    }>()

    for (const scan of batch) {
      const dateStr = scan.scannedAt.toISOString().split("T")[0]
      const key = `${scan.qrCodeId}:${dateStr}`

      let entry = grouped.get(key)
      if (!entry) {
        entry = {
          date: dateStr,
          total: 0,
          uniqueIps: new Set(),
          byCountry: new Map(),
          byDevice: new Map(),
          byOs: new Map(),
          byBrowser: new Map(),
        }
        grouped.set(key, entry)
      }

      // Build sub-key for unique (qrCodeId, scannedAt, ipHash, country, etc.)
      // This mirrors the inner GROUP BY in the SQL approach
      entry.total++
      if (scan.ipHash) entry.uniqueIps.add(scan.ipHash)

      if (scan.country) entry.byCountry.set(scan.country, (entry.byCountry.get(scan.country) ?? 0) + 1)
      if (scan.deviceType) entry.byDevice.set(scan.deviceType, (entry.byDevice.get(scan.deviceType) ?? 0) + 1)
      if (scan.os) entry.byOs.set(scan.os, (entry.byOs.get(scan.os) ?? 0) + 1)
      if (scan.browser) entry.byBrowser.set(scan.browser, (entry.byBrowser.get(scan.browser) ?? 0) + 1)
    }

    return grouped
  },

  /**
   * Upsert a batch of grouped data into ScanDaily.
   */
  async _upsertBatch(
    grouped: Map<string, {
      date: string
      total: number
      uniqueIps: Set<string>
      byCountry: Map<string, number>
      byDevice: Map<string, number>
      byOs: Map<string, number>
      byBrowser: Map<string, number>
    }>,
  ): Promise<void> {
    for (const [key, entry] of grouped) {
      const [qrCodeId] = key.split(":")
      const date = new Date(entry.date)

      const byCountry = Object.fromEntries(entry.byCountry)
      const byDevice = Object.fromEntries(entry.byDevice)
      const byOs = Object.fromEntries(entry.byOs)
      const byBrowser = Object.fromEntries(entry.byBrowser)

      await prisma.scanDaily.upsert({
        where: {
          qrCodeId_date: { qrCodeId, date },
        },
        create: {
          qrCodeId,
          date,
          totalScans: entry.total,
          uniqueIps: entry.uniqueIps.size,
          byCountry,
          byDevice,
          byOs,
          byBrowser,
        },
        update: {
          totalScans: { increment: entry.total },
          uniqueIps: { increment: entry.uniqueIps.size },
          byCountry,
          byDevice,
          byOs,
          byBrowser,
        },
      })
    }
  },
}
