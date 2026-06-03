import type { QRType, QRStatus } from "@prisma/client"

export interface QRCodeRecord {
  shortCode: string
  type: QRType
  status: QRStatus
  destinationUrl: string | null
}

export function resolveDestination(qrCode: QRCodeRecord): string {
  switch (qrCode.type) {
    case 'URL':
      return qrCode.destinationUrl ?? '/'
    case 'WHATSAPP': {
      const phone = qrCode.destinationUrl ?? ''
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
