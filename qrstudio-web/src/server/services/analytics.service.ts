import { prisma } from "@/server/db"
import { Prisma } from "@prisma/client"
import { getCountry } from "@/lib/geo"
import { parseDevice, parseOs, parseBrowser } from "@/lib/user-agent"
import logger from "@/lib/logger"
import { createHash } from "crypto"
import {
  readWithCache,
  invalidateAnalyticsCache,
  analyticsCacheKey,
  dashboardCacheKey,
  ANALYTICS_TTL,
  DASHBOARD_TTL,
} from "@/server/cache/analytics-cache"

export interface ScanInput {
  qrCodeId: string
  ip?: string
  userAgent?: string
  referer?: string
}

export interface AnalyticsFilters {
  qrCodeId: string
  period: '7d' | '30d' | '90d' | 'all'
}

export interface CSVPageResult {
  rows: string[]
  nextCursor?: string
}

export type Period = '7d' | '30d' | '90d' | 'all'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

function getPeriodDate(period: Period): Date | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function mergeJsonbInto(
  acc: Record<string, number>,
  jsonb: Prisma.JsonValue | null,
): void {
  if (!jsonb || typeof jsonb !== 'object' || Array.isArray(jsonb)) return
  for (const [key, val] of Object.entries(jsonb)) {
    if (typeof val === 'number') {
      acc[key] = (acc[key] ?? 0) + val
    }
  }
}

function sortByCountry(acc: Record<string, number>): { country: string; scans: number }[] {
  return Object.entries(acc)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([country, scans]) => ({ country, scans }))
}

function sortByDevice(acc: Record<string, number>): { device: string; scans: number }[] {
  return Object.entries(acc)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([device, scans]) => ({ device, scans }))
}

function sortByOs(acc: Record<string, number>): { os: string; scans: number }[] {
  return Object.entries(acc)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([os, scans]) => ({ os, scans }))
}

function esc(value: string | null | undefined): string {
  const str = value ?? ''
  if (/[,"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const analyticsService = {
  // ── Write path (unchanged) ──────────────────────────────────────────────────

  async recordScan(data: ScanInput): Promise<void> {
    const ipHash = data.ip ? hashIp(data.ip) : null
    let country: string | null = null

    if (data.ip) {
      try {
        country = await getCountry(data.ip)
      } catch (error) {
        logger.error(error, "Erreur géolocalisation IP")
        country = null
      }
    }

    const deviceType = data.userAgent ? parseDevice(data.userAgent) : null
    const os = data.userAgent ? parseOs(data.userAgent) : null
    const browser = data.userAgent ? parseBrowser(data.userAgent) : null

    await prisma.$transaction(async (tx) => {
      await tx.scan.create({
        data: {
          qrCodeId: data.qrCodeId,
          ipHash,
          country,
          deviceType,
          os,
          browser,
          referer: data.referer ?? null,
        },
      })

      await tx.qRCode.update({
        where: { id: data.qrCodeId },
        data: {
          totalScans: { increment: 1 },
          lastScannedAt: new Date(),
        },
      })

      if (ipHash) {
        const recentScan = await tx.scan.findFirst({
          where: {
            qrCodeId: data.qrCodeId,
            ipHash,
            scannedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { scannedAt: 'desc' },
        })

        if (!recentScan) {
          await tx.qRCode.update({
            where: { id: data.qrCodeId },
            data: { uniqueScans: { increment: 1 } },
          })
        }
      }
    })
  },

  // ── Read path: analytics via ScanDaily + cache ──────────────────────────────

  async getAnalytics(
    qrCodeId: string,
    period: Period,
    retentionDays?: number,
  ) {
    const cacheKey = analyticsCacheKey(qrCodeId, period)
    return readWithCache(cacheKey, ANALYTICS_TTL, () =>
      this.computeAnalyticsFromSummaries(qrCodeId, period, retentionDays),
    )
  },

  /**
   * Compute analytics from ScanDaily summary table.
   * Falls back to raw Scan table for today's partial data (not yet aggregated).
   */
  async computeAnalyticsFromSummaries(
    qrCodeId: string,
    period: Period,
    retentionDays?: number,
  ) {
    const qrCode = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
      select: { totalScans: true, uniqueScans: true },
    })

    let effectiveSinceDate = getPeriodDate(period)
    if (retentionDays && retentionDays !== Infinity) {
      const retentionDate = new Date()
      retentionDate.setDate(retentionDate.getDate() - retentionDays)
      if (!effectiveSinceDate || effectiveSinceDate < retentionDate) {
        effectiveSinceDate = retentionDate
      }
    }

    const todayStart = getTodayStart()

    // 1. Fetch ScanDaily rows (bounded by retention days, max 365)
    const dailyRows = await prisma.scanDaily.findMany({
      where: {
        qrCodeId,
        date: effectiveSinceDate ? { gte: effectiveSinceDate } : undefined,
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        totalScans: true,
        byCountry: true,
        byDevice: true,
        byOs: true,
      },
    })

    const countryAcc: Record<string, number> = {}
    const deviceAcc: Record<string, number> = {}
    const osAcc: Record<string, number> = {}

    const scansByDay: { date: string; scans: number }[] = []

    for (const row of dailyRows) {
      const dateStr = row.date.toISOString().split('T')[0]
      scansByDay.push({ date: dateStr, scans: row.totalScans })
      mergeJsonbInto(countryAcc, row.byCountry)
      mergeJsonbInto(deviceAcc, row.byDevice)
      mergeJsonbInto(osAcc, row.byOs)
    }

    // 2. Check if today's data exists in the summary already
    const hasTodayInSummary =
      dailyRows.length > 0 &&
      dailyRows[dailyRows.length - 1].date.toISOString().split('T')[0] ===
        todayStart.toISOString().split('T')[0]

    // 3. If today is not yet aggregated, fetch partial data from raw Scan
    if (!hasTodayInSummary) {
      const todaySince = effectiveSinceDate
        ? new Date(Math.max(effectiveSinceDate.getTime(), todayStart.getTime()))
        : todayStart

      const [todayScansByDay, todayCountries, todayDevices, todayOs] =
        await Promise.all([
          getScansByDay(qrCodeId, todaySince),
          getTopCountries(qrCodeId, todaySince),
          getTopDevices(qrCodeId, todaySince),
          getTopOs(qrCodeId, todaySince),
        ])

      // Merge today's partial data
      for (const entry of todayScansByDay) {
        const existing = scansByDay.find((s) => s.date === entry.date)
        if (existing) {
          existing.scans += entry.scans
        } else {
          scansByDay.push(entry)
        }
      }

      for (const { country, count } of todayCountries) {
        countryAcc[country] = (countryAcc[country] ?? 0) + Number(count)
      }
      for (const { device, count } of todayDevices) {
        deviceAcc[device] = (deviceAcc[device] ?? 0) + Number(count)
      }
      for (const { os, count } of todayOs) {
        osAcc[os] = (osAcc[os] ?? 0) + Number(count)
      }
    }

    // Sort scansByDay by date ascending
    scansByDay.sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalScans: qrCode?.totalScans ?? 0,
      uniqueScans: qrCode?.uniqueScans ?? 0,
      scansByDay,
      byCountry: sortByCountry(countryAcc),
      byDevice: sortByDevice(deviceAcc),
      byOs: sortByOs(osAcc),
    }
  },

  // ── Dashboard stats via ScanDaily + cache ────────────────────────────────────

  async getDashboardStats(workspaceId: string) {
    const cacheKey = dashboardCacheKey(workspaceId)
    return readWithCache(cacheKey, DASHBOARD_TTL, () =>
      this.computeDashboardFromSummaries(workspaceId),
    )
  },

  async computeDashboardFromSummaries(workspaceId: string) {
    const todayStart = getTodayStart()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    // Get all QR code IDs in workspace
    const qrCodeIds = await prisma.qRCode.findMany({
      where: { workspaceId },
      select: { id: true },
    })
    const ids = qrCodeIds.map((r) => r.id)

    let scansLast7Days: { date: string; scans: number }[] = []

    if (ids.length > 0) {
      // Use ScanDaily for aggregated data
      const dailyTotals = await prisma.scanDaily.groupBy({
        by: ['date'],
        where: {
          qrCodeId: { in: ids },
          date: { gte: sevenDaysAgo },
        },
        _sum: { totalScans: true },
        orderBy: { date: 'asc' },
      })

      // Also get today's partial from raw Scan (if today not yet in ScanDaily)
      const hasTodayInSummary = dailyTotals.some(
        (r) => r.date.toISOString().split('T')[0] === todayStart.toISOString().split('T')[0],
      )

      let todayRawCount = 0
      if (!hasTodayInSummary) {
        const todayRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::int as count
          FROM "Scan"
          WHERE "qrCodeId" = ANY(${ids}::text[])
            AND scanned_at >= ${todayStart}
        `
        todayRawCount = Number(todayRows[0]?.count ?? 0)
      }

      scansLast7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(sevenDaysAgo)
        date.setDate(date.getDate() + i + 1)
        const key = date.toISOString().split('T')[0]

        // Check ScanDaily first
        const summaryMatch = dailyTotals.find(
          (r) => r.date.toISOString().split('T')[0] === key,
        )
        const summaryScans = Number(summaryMatch?._sum.totalScans ?? 0)

        // If today and not in summary, add raw count
        const extraToday =
          key === todayStart.toISOString().split('T')[0] &&
          !hasTodayInSummary
            ? todayRawCount
            : 0

        return {
          date: key,
          scans: summaryScans + extraToday,
        }
      })
    } else {
      scansLast7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(sevenDaysAgo)
        date.setDate(date.getDate() + i + 1)
        return { date: date.toISOString().split('T')[0], scans: 0 }
      })
    }

    const [totalQRCodes, recentQRCodes, scansToday, topQRCodes, totalMembers] =
      await Promise.all([
        prisma.qRCode.count({ where: { workspaceId } }),
        prisma.qRCode.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            shortCode: true,
            type: true,
            status: true,
            totalScans: true,
            lastScannedAt: true,
            createdAt: true,
          },
        }),
        prisma.scan.count({
          where: {
            qrCode: { workspaceId },
            scannedAt: { gte: todayStart },
          },
        }),
        prisma.qRCode.findMany({
          where: { workspaceId },
          orderBy: { totalScans: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            shortCode: true,
            type: true,
            totalScans: true,
            status: true,
            lastScannedAt: true,
            createdAt: true,
          },
        }),
        prisma.workspaceMember.count({ where: { workspaceId } }),
      ])

    return {
      totalScansToday: scansToday,
      totalQRCodes,
      totalMembers: Math.max(totalMembers, 1),
      scansLast7Days,
      recentQRCodes,
      topQRCodes,
    }
  },

  // ── CSV export (paginé via raw Scan, détail complet par scan) ────────────────

  async exportCSV(
    qrCodeId: string,
    period: Period,
  ): Promise<string> {
    return this.legacyExportCSV(qrCodeId, period)
  },

  /**
   * Paginated CSV export. Returns one page of 1000 rows with a cursor for the next page.
   */
  async exportCSVPage(
    qrCodeId: string,
    period: Period,
    cursor?: string,
  ): Promise<CSVPageResult> {
    const sinceDate = getPeriodDate(period)

    const where: Prisma.ScanFindManyArgs['where'] = { qrCodeId }
    if (sinceDate) {
      where.scannedAt = { gte: sinceDate }
    }

    const scans = await prisma.scan.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const header = 'Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent'
    const rows = scans.map((s) => {
      const date = s.scannedAt.toISOString()
      return `${esc(date)},${esc(s.ipHash)},${esc(s.country)},${esc(s.city)},${esc(s.deviceType)},${esc(s.os)},${esc(s.browser)},${esc(s.referer)}`
    })

    return {
      rows: cursor ? rows : [header, ...rows],
      nextCursor:
        scans.length === 1000 ? scans[scans.length - 1].id : undefined,
    }
  },

  /**
   * Legacy full CSV export (kept for backward compatibility).
   */
  async legacyExportCSV(
    qrCodeId: string,
    period: Period,
  ): Promise<string> {
    const sinceDate = getPeriodDate(period)
    const where: Prisma.ScanFindManyArgs['where'] = { qrCodeId }
    if (sinceDate) {
      where.scannedAt = { gte: sinceDate }
    }

    const scans = await prisma.scan.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
      take: 10000,
    })

    const header = 'Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent'
    const rows = scans.map((s) => {
      const date = s.scannedAt.toISOString()
      return `${esc(date)},${esc(s.ipHash)},${esc(s.country)},${esc(s.city)},${esc(s.deviceType)},${esc(s.os)},${esc(s.browser)},${esc(s.referer)}`
    })

    return [header, ...rows].join('\n')
  },

  // ── Cache invalidation ──────────────────────────────────────────────────────

  async invalidateQrCache(qrCodeId: string): Promise<void> {
    await invalidateAnalyticsCache(qrCodeId)
  },
}

// ── Private helpers (raw table queries, used for today's partial fallback) ────

async function getScansByDay(
  qrCodeId: string,
  sinceDate: Date | null,
): Promise<{ date: string; scans: number }[]> {
  const whereClause = sinceDate
    ? Prisma.sql`WHERE "qrCodeId" = ${qrCodeId} AND scanned_at >= ${sinceDate}`
    : Prisma.sql`WHERE "qrCodeId" = ${qrCodeId}`

  const results = await prisma.$queryRaw<
    Array<{ date: string; count: bigint }>
  >`
    SELECT
      DATE(scanned_at) as date,
      COUNT(*)::int as count
    FROM "Scan"
    ${whereClause}
    GROUP BY DATE(scanned_at)
    ORDER BY date ASC
  `

  return results.map((r) => ({
    date: r.date,
    scans: Number(r.count),
  }))
}

async function getTopCountries(
  qrCodeId: string,
  sinceDate: Date | null,
) {
  const whereClause = sinceDate
    ? Prisma.sql`WHERE "qrCodeId" = ${qrCodeId} AND scanned_at >= ${sinceDate} AND country IS NOT NULL`
    : Prisma.sql`WHERE "qrCodeId" = ${qrCodeId} AND country IS NOT NULL`

  return prisma.$queryRaw<Array<{ country: string; count: bigint }>>`
    SELECT country, COUNT(*)::int as count
    FROM "Scan"
    ${whereClause}
    GROUP BY country
    ORDER BY count DESC
    LIMIT 10
  `
}

async function getTopDevices(
  qrCodeId: string,
  sinceDate: Date | null,
) {
  const whereClause = sinceDate
    ? Prisma.sql`WHERE "qrCodeId" = ${qrCodeId} AND scanned_at >= ${sinceDate} AND "deviceType" IS NOT NULL`
    : Prisma.sql`WHERE "qrCodeId" = ${qrCodeId} AND "deviceType" IS NOT NULL`

  return prisma.$queryRaw<Array<{ device: string; count: bigint }>>`
    SELECT "deviceType" as device, COUNT(*)::int as count
    FROM "Scan"
    ${whereClause}
    GROUP BY "deviceType"
    ORDER BY count DESC
    LIMIT 10
  `
}

async function getTopOs(qrCodeId: string, sinceDate: Date | null) {
  const whereClause = sinceDate
    ? Prisma.sql`WHERE "qrCodeId" = ${qrCodeId} AND scanned_at >= ${sinceDate} AND os IS NOT NULL`
    : Prisma.sql`WHERE "qrCodeId" = ${qrCodeId} AND os IS NOT NULL`

  return prisma.$queryRaw<Array<{ os: string; count: bigint }>>`
    SELECT os, COUNT(*)::int as count
    FROM "Scan"
    ${whereClause}
    GROUP BY os
    ORDER BY count DESC
    LIMIT 10
  `
}
