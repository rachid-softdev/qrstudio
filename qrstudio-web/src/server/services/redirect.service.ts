import type { QRType, QRStatus } from "@prisma/client"
import { isSafeRedirectUrl } from "@/lib/url-security"

export interface QRCodeRecord {
  shortCode: string
  type: QRType
  status: QRStatus
  metadata: unknown
  deletedAt: Date | null
}

export function resolveDestination(qrCode: QRCodeRecord): string {
  if (qrCode.deletedAt) {
    return '/qr-deleted'
  }

  const metadata = (qrCode.metadata as Record<string, unknown>) ?? {}
  const destinationUrl = (metadata.destinationUrl as string | undefined) ?? null

  switch (qrCode.type) {
    case 'URL':
      if (destinationUrl && isSafeRedirectUrl(destinationUrl)) {
        return destinationUrl
      }
      return destinationUrl ? '/redirect-blocked' : '/'
    case 'WHATSAPP': {
      const phone = destinationUrl ?? ''
      const cleaned = phone.replace(/[^0-9]/g, '')
      return `https://wa.me/${cleaned}`
    }
    case 'WIFI':
      return `/wifi/${qrCode.shortCode}`
    case 'LANDING_PAGE':
      return `/l/${qrCode.shortCode}`
    case 'VCARD':
    case 'PDF':
    case 'TEXT':
      return `/view/${qrCode.shortCode}`
  }
}
