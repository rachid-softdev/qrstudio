import { prisma } from "@/server/db"
import { getCountry } from "@/lib/geo"
import { parseDevice, parseOs, parseBrowser } from "@/lib/user-agent"
import { hashIp } from "@/lib/ip"
import logger from "@/lib/logger"

export interface ScanInput {
  qrCodeId: string
  ip?: string
  userAgent?: string
  referer?: string
}

export const scanRecorder = {
  async recordScan(data: ScanInput): Promise<void> {
    const ipHash = data.ip ? await hashIp(data.ip) : null
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
}
