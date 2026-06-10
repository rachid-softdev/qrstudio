import { prisma } from "@/server/db"
import { Prisma } from "@prisma/client"

export type Period = '7d' | '30d' | '90d' | 'all'

export interface CSVPageResult {
  rows: string[]
  nextCursor?: string
}

function getPeriodDate(period: Period): Date | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function esc(value: string | null | undefined): string {
  const str = value ?? ''
  if (/[,"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const analyticsExportService = {
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
}
