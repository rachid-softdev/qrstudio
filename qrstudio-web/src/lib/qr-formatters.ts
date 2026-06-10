import type { QRType } from "@prisma/client"
import type { QRUpdateInput } from "@/lib/validations"

export interface QRDataInput {
  type: QRType | string
  destinationUrl?: string | null
  wifi?: { ssid?: string; password?: string; encryption?: string } | undefined
  vcard?: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; website?: string } | undefined
  textContent?: string | null
}

/**
 * Maps a QRDataInput-shaped object into a JSONB-compatible metadata object.
 * Only includes keys that are relevant to the QR type.
 */
export function toMetadata(input: { destinationUrl?: string | null; wifi?: Record<string, unknown> | null; vcard?: Record<string, unknown> | null; textContent?: string | null }): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  if (input.destinationUrl !== undefined && input.destinationUrl !== null) {
    metadata.destinationUrl = input.destinationUrl
  }
  if (input.wifi !== undefined) {
    metadata.wifi = input.wifi ?? null
  }
  if (input.vcard !== undefined) {
    metadata.vcard = input.vcard ?? null
  }
  if (input.textContent !== undefined && input.textContent !== null) {
    metadata.textContent = input.textContent
  }
  return metadata
}

export function prepareQRData(input: QRDataInput, shortCode: string): string {
  switch (input.type) {
    case 'URL':
      return input.destinationUrl ?? ''
    case 'WHATSAPP': {
      const phone = input.destinationUrl ?? ''
      return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`
    }
    case 'WIFI':
      return formatWifiString(input.wifi?.ssid ?? '', input.wifi?.password, input.wifi?.encryption)
    case 'VCARD':
      return formatVCardString(input.vcard)
    case 'PDF':
      return input.destinationUrl ?? ''
    case 'TEXT':
      return input.textContent ?? ''
    case 'LANDING_PAGE': {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      return `${appUrl}/l/${shortCode}`
    }
    default:
      return ''
  }
}

/**
 * Converts a Prisma QRCode entity with a JSONB metadata column to QRDataInput.
 */
export function toQRDataInput(
  entity: {
    type: string
    metadata: unknown
  },
): QRDataInput {
  const metadata = (entity.metadata as Record<string, unknown>) ?? {}
  return {
    type: entity.type as QRType,
    destinationUrl: (metadata.destinationUrl as string | undefined) ?? undefined,
    wifi: metadata.wifi as { ssid?: string; password?: string; encryption?: string } | undefined,
    vcard: metadata.vcard as { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; website?: string } | undefined,
    textContent: (metadata.textContent as string | undefined) ?? undefined,
  }
}

export function prepareQRDataForUpdate(existing: { type: string; shortCode?: string; metadata?: unknown }, data: QRUpdateInput): string {
  const type = existing.type as QRType
  const meta = existing.metadata as Record<string, unknown> | null | undefined

  switch (type) {
    case 'URL': {
      const dest = data.destinationUrl ?? (meta?.destinationUrl as string | undefined) ?? ''
      return dest
    }
    case 'WHATSAPP': {
      const phone = data.destinationUrl ?? (meta?.destinationUrl as string | undefined) ?? ''
      return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`
    }
    case 'WIFI': {
      const wifiMeta = meta?.wifi as Record<string, string> | undefined
      const ssid = data.wifi?.ssid ?? wifiMeta?.ssid ?? ''
      const password = data.wifi?.password ?? wifiMeta?.password ?? undefined
      const encryption = (data.wifi?.encryption ?? wifiMeta?.encryption ?? 'nopass') as 'WPA' | 'WEP' | 'nopass'
      return formatWifiString(ssid, password, encryption)
    }
    case 'VCARD': {
      if (data.vcard) return formatVCardString(data.vcard)
      const vcardMeta = meta?.vcard as Record<string, string> | undefined
      return vcardMeta ? formatVCardString(vcardMeta) : ''
    }
    case 'PDF': {
      const dest = data.destinationUrl ?? (meta?.destinationUrl as string | undefined) ?? ''
      return dest
    }
    case 'TEXT': {
      const text = data.textContent ?? (meta?.textContent as string | undefined) ?? ''
      return text
    }
    case 'LANDING_PAGE': {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      return `${appUrl}/l/${existing.shortCode ?? 'unknown'}`
    }
  }
}

function formatWifiString(ssid: string, password?: string, encryption?: string): string {
  const enc = encryption ?? 'nopass'
  const pass = password ? `P:${password};` : ''
  return `WIFI:T:${enc};S:${ssid};${pass};`
}

function formatVCardString(vcard?: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; website?: string }): string {
  if (!vcard) return ''
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0']
  if (vcard.firstName || vcard.lastName) {
    lines.push(`FN:${vcard.firstName ?? ''} ${vcard.lastName ?? ''}`.trim())
    lines.push(`N:${vcard.lastName ?? ''};${vcard.firstName ?? ''};;;`)
  }
  if (vcard.email) lines.push(`EMAIL:${vcard.email}`)
  if (vcard.phone) lines.push(`TEL:${vcard.phone}`)
  if (vcard.company) lines.push(`ORG:${vcard.company}`)
  if (vcard.website) lines.push(`URL:${vcard.website}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}
