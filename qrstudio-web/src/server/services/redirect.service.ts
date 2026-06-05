import type { QRType, QRStatus } from "@prisma/client"

export interface QRCodeRecord {
  shortCode: string
  type: QRType
  status: QRStatus
  metadata: unknown
}

export function resolveDestination(qrCode: QRCodeRecord): string {
  const metadata = (qrCode.metadata as Record<string, unknown>) ?? {}
  const destinationUrl = (metadata.destinationUrl as string | undefined) ?? null

  switch (qrCode.type) {
    case 'URL':
      return destinationUrl ?? '/'
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
