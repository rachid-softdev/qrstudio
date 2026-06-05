/**
 * Backfill script for ScanDaily summary table.
 *
 * Usage:
 *   npx tsx scripts/backfill-scan-daily.ts
 *
 * This script processes all historical Scan rows and populates ScanDaily.
 * It is safe to run multiple times — upserts are idempotent.
 *
 * Environment variables required:
 *   DATABASE_URL — PostgreSQL connection string
 *
 * Recommended to run during low-traffic hours.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const BATCH_SIZE = 50_000

interface ScanBatch {
  id: string
  qrCodeId: string
  scannedAt: Date
  ipHash: string | null
  country: string | null
  deviceType: string | null
  os: string | null
  browser: string | null
}

/**
 * Group raw Scan rows into ScanDaily-compatible aggregates.
 */
function groupForUpsert(
  batch: ScanBatch[],
): Map<string, {
  qrCodeId: string
  date: Date
  total: number
  uniqueIps: Set<string>
  byCountry: Map<string, number>
  byDevice: Map<string, number>
  byOs: Map<string, number>
  byBrowser: Map<string, number>
}> {
  const grouped = new Map<string, {
    qrCodeId: string
    date: Date
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
        qrCodeId: scan.qrCodeId,
        date: new Date(dateStr),
        total: 0,
        uniqueIps: new Set(),
        byCountry: new Map(),
        byDevice: new Map(),
        byOs: new Map(),
        byBrowser: new Map(),
      }
      grouped.set(key, entry)
    }

    entry.total++
    if (scan.ipHash) entry.uniqueIps.add(scan.ipHash)
    if (scan.country) entry.byCountry.set(scan.country, (entry.byCountry.get(scan.country) ?? 0) + 1)
    if (scan.deviceType) entry.byDevice.set(scan.deviceType, (entry.byDevice.get(scan.deviceType) ?? 0) + 1)
    if (scan.os) entry.byOs.set(scan.os, (entry.byOs.get(scan.os) ?? 0) + 1)
    if (scan.browser) entry.byBrowser.set(scan.browser, (entry.byBrowser.get(scan.browser) ?? 0) + 1)
  }

  return grouped
}

async function main() {
  console.log("=== ScanDaily Backfill ===")

  // Ensure watermark exists for incremental aggregation after backfill
  await prisma.aggregationWatermark.upsert({
    where: { queueName: "aggregate-scans" },
    create: {
      queueName: "aggregate-scans",
      lastProcessedAt: new Date(0),
    },
    update: {},
  })

  // Count total rows to process
  const totalScans = await prisma.scan.count()
  console.log(`Total raw Scan rows: ${totalScans}`)

  if (totalScans === 0) {
    console.log("No scans to backfill. Updating watermark to now.")
    await prisma.aggregationWatermark.update({
      where: { queueName: "aggregate-scans" },
      data: { lastProcessedAt: new Date() },
    })
    console.log("Done.")
    await prisma.$disconnect()
    return
  }

  let cursor: string | undefined
  let processed = 0
  const startTime = Date.now()

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

    // Group and upsert in parallel (one upsert per (qrCodeId, date))
    const grouped = groupForUpsert(batch)
    const upserts = Array.from(grouped.values()).map((entry) =>
      prisma.scanDaily.upsert({
        where: {
          qrCodeId_date: {
            qrCodeId: entry.qrCodeId,
            date: entry.date,
          },
        },
        create: {
          qrCodeId: entry.qrCodeId,
          date: entry.date,
          totalScans: entry.total,
          uniqueIps: entry.uniqueIps.size,
          byCountry: Object.fromEntries(entry.byCountry),
          byDevice: Object.fromEntries(entry.byDevice),
          byOs: Object.fromEntries(entry.byOs),
          byBrowser: Object.fromEntries(entry.byBrowser),
        },
        update: {
          totalScans: { increment: entry.total },
          uniqueIps: { increment: entry.uniqueIps.size },
          byCountry: Object.fromEntries(entry.byCountry),
          byDevice: Object.fromEntries(entry.byDevice),
          byOs: Object.fromEntries(entry.byOs),
          byBrowser: Object.fromEntries(entry.byBrowser),
        },
      }),
    )

    await prisma.$transaction(upserts)

    cursor = batch[batch.length - 1].id
    processed += batch.length
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`Progress: ${processed}/${totalScans} (${elapsed}s, ${(processed / Number(elapsed)).toFixed(0)} rows/s)`)
  } while (cursor)

  // Set watermark to now so incremental aggregation picks up from here
  await prisma.aggregationWatermark.update({
    where: { queueName: "aggregate-scans" },
    data: { lastProcessedAt: new Date() },
  })

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log("=== Backfill complete ===")
  console.log(`Processed: ${processed} rows in ${totalTime}s`)
  console.log(`Rate: ${(processed / Number(totalTime)).toFixed(0)} rows/s`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("Backfill failed:", err)
  process.exit(1)
})
