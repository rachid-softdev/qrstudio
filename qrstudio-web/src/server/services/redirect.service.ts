import { z } from "zod"
import type { QRType, QRStatus } from "@prisma/client"
import { isSafeRedirectUrl } from "@/lib/url-security"

const metadataSchema = z.object({
  destinationUrl: z.string().optional(),
})

export interface QRCodeRecord {
  shortCode: string
  type: QRType
  status: QRStatus
  metadata: unknown
  deletedAt: Date | null
}

function parseMetadata(raw: unknown): z.infer<typeof metadataSchema> {
  const parsed = metadataSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

export function resolveDestination(qrCode: QRCodeRecord): string {
  if (qrCode.deletedAt) {
    return '/qr-deleted'
  }

  const metadata = parseMetadata(qrCode.metadata)
  const destinationUrl = metadata.destinationUrl ?? null

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
