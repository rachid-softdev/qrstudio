import { prisma } from "@/server/db"
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

  async getAnalytics(qrCodeId: string, period: '7d' | '30d' | '90d' | 'all') {
    const qrCode = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
      select: { totalScans: true, uniqueScans: true },
    })

    const sinceDate = getPeriodDate(period)

    const whereClause = sinceDate
      ? { qrCodeId, scannedAt: { gte: sinceDate } }
      : { qrCodeId }

    const [scansByDay, countryRaw, deviceRaw, osRaw] = await Promise.all([
      getScansByDay(qrCodeId, sinceDate),
      getGroupedCounts('country', whereClause),
      getGroupedCounts('deviceType', whereClause),
      getGroupedCounts('os', whereClause),
    ])

    return {
      totalScans: qrCode?.totalScans ?? 0,
      uniqueScans: qrCode?.uniqueScans ?? 0,
      scansByDay,
      byCountry: mapCountryData(countryRaw),
      byDevice: mapDeviceData(deviceRaw),
      byOs: mapOsData(osRaw),
    }
  },

  async getDashboardStats(workspaceId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [totalQRCodes, recentQRCodes, scansToday, topQRCodes, totalMembers, scansLast7DaysRaw] = await Promise.all([
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
      prisma.scan.findMany({
        where: {
          qrCode: { workspaceId },
          scannedAt: { gte: sevenDaysAgo },
        },
        select: { scannedAt: true },
        orderBy: { scannedAt: 'asc' },
      }),
    ])

    const scansLast7DaysMap = new Map<string, number>()
    for (const scan of scansLast7DaysRaw) {
      const key = scan.scannedAt.toISOString().split('T')[0]
      scansLast7DaysMap.set(key, (scansLast7DaysMap.get(key) ?? 0) + 1)
    }

    const scansLast7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo)
      date.setDate(date.getDate() + i + 1)
      const key = date.toISOString().split('T')[0]
      return { date: key, scans: scansLast7DaysMap.get(key) ?? 0 }
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

    const header = 'Date,IP Hash,Pays,Ville,Appareil,OS,Navigateur,Référent'
    const rows = scans.map((s) => {
      const date = s.scannedAt.toISOString()
      return `${date},${s.ipHash ?? ''},${s.country ?? ''},${s.city ?? ''},${s.deviceType ?? ''},${s.os ?? ''},${s.browser ?? ''},${s.referer ?? ''}`
    })

    return [header, ...rows].join('\n')
  },
}

async function getScansByDay(qrCodeId: string, sinceDate: Date | null) {
  const scans = await prisma.scan.findMany({
    where: sinceDate
      ? { qrCodeId, scannedAt: { gte: sinceDate } }
      : { qrCodeId },
    select: { scannedAt: true },
    orderBy: { scannedAt: 'asc' },
  })

  const dayMap = new Map<string, number>()
  for (const scan of scans) {
    const key = scan.scannedAt.toISOString().split('T')[0]
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
  }

  return Array.from(dayMap.entries()).map(([date, scans]) => ({
    date,
    scans,
  }))
}

type GroupedResult = { country?: string; deviceType?: string; os?: string; _count: number }

async function getGroupedCounts(
  field: 'country' | 'deviceType' | 'os',
  whereClause: object
): Promise<{ label: string; scans: number }[]> {
  const results = await (prisma.scan as unknown as {
    groupBy: (args: { by: string[]; where: object; _count: boolean; orderBy: { _count: string }; take: number }) => Promise<GroupedResult[]>
  }).groupBy({
    by: [field],
    where: whereClause,
    _count: true,
    orderBy: { _count: 'desc' },
    take: 10,
  })

  return results.map((r: GroupedResult) => ({
    label: r[field] ?? 'Inconnu',
    scans: r._count,
  }))
}

function mapCountryData(items: { label: string; scans: number }[]): { country: string; scans: number }[] {
  return items.map((i) => ({ country: i.label, scans: i.scans }))
}

function mapDeviceData(items: { label: string; scans: number }[]): { device: string; scans: number }[] {
  return items.map((i) => ({ device: i.label, scans: i.scans }))
}

function mapOsData(items: { label: string; scans: number }[]): { os: string; scans: number }[] {
  return items.map((i) => ({ os: i.label, scans: i.scans }))
}
