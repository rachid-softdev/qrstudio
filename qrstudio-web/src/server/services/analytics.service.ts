import { prisma } from "@/server/db"
import { Prisma } from "@prisma/client"
import { getCountry } from "@/lib/geo"
import { parseDevice, parseOs, parseBrowser } from "@/lib/user-agent"
import { createHash } from "crypto"

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

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

function getPeriodDate(period: '7d' | '30d' | '90d' | 'all'): Date | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

export const analyticsService = {
  async recordScan(data: ScanInput): Promise<void> {
    const ipHash = data.ip ? hashIp(data.ip) : null
    let country: string | null = null

    if (data.ip) {
      try {
        country = await getCountry(data.ip)
      } catch {
        country = null
      }
    }

    const deviceType = data.userAgent ? parseDevice(data.userAgent) : null
    const os = data.userAgent ? parseOs(data.userAgent) : null
    const browser = data.userAgent ? parseBrowser(data.userAgent) : null

    await prisma.scan.create({
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

    await prisma.qRCode.update({
      where: { id: data.qrCodeId },
      data: {
        totalScans: { increment: 1 },
        lastScannedAt: new Date(),
      },
    })

    if (ipHash) {
      const recentScan = await prisma.scan.findFirst({
        where: {
          qrCodeId: data.qrCodeId,
          ipHash,
          scannedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { scannedAt: 'desc' },
      })

      if (!recentScan) {
        await prisma.qRCode.update({
          where: { id: data.qrCodeId },
          data: { uniqueScans: { increment: 1 } },
        })
      }
    }
  },

  async getAnalytics(qrCodeId: string, period: '7d' | '30d' | '90d' | 'all', retentionDays?: number) {
    const qrCode = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
      select: { totalScans: true, uniqueScans: true },
    })

    let effectiveSinceDate = getPeriodDate(period)

    // Appliquer la rétention selon le plan
    if (retentionDays && retentionDays !== Infinity) {
      const retentionDate = new Date()
      retentionDate.setDate(retentionDate.getDate() - retentionDays)
      if (!effectiveSinceDate || effectiveSinceDate < retentionDate) {
        effectiveSinceDate = retentionDate
      }
    }

    const [scansByDay, countryRaw, deviceRaw, osRaw] = await Promise.all([
      getScansByDay(qrCodeId, effectiveSinceDate),
      getTopCountries(qrCodeId, effectiveSinceDate),
      getTopDevices(qrCodeId, effectiveSinceDate),
      getTopOs(qrCodeId, effectiveSinceDate),
    ])

    return {
      totalScans: qrCode?.totalScans ?? 0,
      uniqueScans: qrCode?.uniqueScans ?? 0,
      scansByDay,
      byCountry: countryRaw.map((r) => ({ country: r.country, scans: Number(r.count) })),
      byDevice: deviceRaw.map((r) => ({ device: r.device, scans: Number(r.count) })),
      byOs: osRaw.map((r) => ({ os: r.os, scans: Number(r.count) })),
    }
  },

  async getDashboardStats(workspaceId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const scansLast7DaysRaw = await prisma.$queryRaw<
      Array<{ date: string; count: bigint }>
    >`
      SELECT
        DATE(scanned_at) as date,
        COUNT(*)::int as count
      FROM "Scan"
      WHERE "qrCodeId" IN (
        SELECT id FROM "QRCode" WHERE "workspaceId" = ${workspaceId}
      )
        AND scanned_at >= ${sevenDaysAgo}
      GROUP BY DATE(scanned_at)
      ORDER BY date ASC
    `

    const [totalQRCodes, recentQRCodes, scansToday, topQRCodes, totalMembers] = await Promise.all([
      prisma.qRCode.count({ where: { workspaceId } }),
      prisma.qRCode.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, name: true, shortCode: true, type: true, status: true, totalScans: true, lastScannedAt: true, createdAt: true,
        },
      }),
      prisma.scan.count({
        where: {
          qrCode: { workspaceId },
          scannedAt: { gte: today },
        },
      }),
      prisma.qRCode.findMany({
        where: { workspaceId },
        orderBy: { totalScans: 'desc' },
        take: 5,
        select: {
          id: true, name: true, shortCode: true, type: true, totalScans: true, status: true, lastScannedAt: true, createdAt: true,
        },
      }),
      prisma.workspaceMember.count({ where: { workspaceId } }),
    ])

    const scansLast7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo)
      date.setDate(date.getDate() + i + 1)
      const key = date.toISOString().split('T')[0]
      const match = scansLast7DaysRaw.find((r) => r.date === key)
      return { date: key, scans: match ? Number(match.count) : 0 }
    })

    return {
      totalScansToday: scansToday,
      totalQRCodes,
      totalMembers: Math.max(totalMembers, 1),
      scansLast7Days,
      recentQRCodes,
      topQRCodes,
    }
  },

  async exportCSV(qrCodeId: string, period: '7d' | '30d' | '90d' | 'all'): Promise<string> {
    const sinceDate = getPeriodDate(period)

    const whereClause = sinceDate
      ? { qrCodeId, scannedAt: { gte: sinceDate } }
      : { qrCodeId }

    const scans = await prisma.scan.findMany({
      where: whereClause,
      orderBy: { scannedAt: 'desc' },
      take: 10000,
    })

    function esc(value: string | null | undefined): string {
      const str = value ?? ''
      if (/[,"\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const header = 'Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent'
    const rows = scans.map((s) => {
      const date = s.scannedAt.toISOString()
      return `${esc(date)},${esc(s.ipHash)},${esc(s.country)},${esc(s.city)},${esc(s.deviceType)},${esc(s.os)},${esc(s.browser)},${esc(s.referer)}`
    })

    return [header, ...rows].join('\n')
  },
}

async function getScansByDay(
  qrCodeId: string,
  sinceDate: Date | null
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

async function getTopCountries(qrCodeId: string, sinceDate: Date | null) {
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

async function getTopDevices(qrCodeId: string, sinceDate: Date | null) {
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
