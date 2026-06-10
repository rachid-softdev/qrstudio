import { z } from "zod"
import type { QRType } from "@prisma/client"
import type { QRUpdateInput } from "@/lib/validations"

export interface QRDataInput {
  type: QRType | string
  destinationUrl?: string | null
  wifi?: { ssid?: string; password?: string; encryption?: string } | undefined
  vcard?: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; website?: string } | undefined
  textContent?: string | null
}

const metadataSchema = z.object({
  destinationUrl: z.string().optional(),
  wifi: z
    .object({
      ssid: z.string().optional(),
      password: z.string().optional(),
      encryption: z.string().optional(),
    })
    .optional(),
  vcard: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  textContent: z.string().optional(),
})

const wifiEncryptionSchema = z.enum(["WPA", "WEP", "nopass"])

const qrTypeSchema = z.enum([
  "URL", "WHATSAPP", "WIFI", "VCARD", "PDF", "TEXT", "LANDING_PAGE",
])

function parseMetadata(raw: unknown): z.infer<typeof metadataSchema> {
  const parsed = metadataSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
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
  const meta = parseMetadata(entity.metadata)
  const qrType = qrTypeSchema.safeParse(entity.type)
  return {
    type: qrType.success ? qrType.data : entity.type,
    destinationUrl: meta.destinationUrl,
    wifi: meta.wifi,
    vcard: meta.vcard,
    textContent: meta.textContent,
  }
}

export function prepareQRDataForUpdate(existing: { type: string; shortCode?: string; metadata?: unknown }, data: QRUpdateInput): string {
  const qrType = qrTypeSchema.safeParse(existing.type)
  const type: string = qrType.success ? qrType.data : existing.type
  const meta = parseMetadata(existing.metadata)

  switch (type) {
    case 'URL': {
      return data.destinationUrl ?? meta.destinationUrl ?? ''
    }
    case 'WHATSAPP': {
      const phone = data.destinationUrl ?? meta.destinationUrl ?? ''
      return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`
    }
    case 'WIFI': {
      const ssid = data.wifi?.ssid ?? meta.wifi?.ssid ?? ''
      const password = data.wifi?.password ?? meta.wifi?.password
      const encryption = wifiEncryptionSchema.parse(
        data.wifi?.encryption ?? meta.wifi?.encryption ?? 'nopass',
      )
      return formatWifiString(ssid, password, encryption)
    }
    case 'VCARD': {
      if (data.vcard) return formatVCardString(data.vcard)
      return meta.vcard ? formatVCardString(meta.vcard) : ''
    }
    case 'PDF': {
      return data.destinationUrl ?? meta.destinationUrl ?? ''
    }
    case 'TEXT': {
      return data.textContent ?? meta.textContent ?? ''
    }
    case 'LANDING_PAGE': {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      return `${appUrl}/l/${existing.shortCode ?? 'unknown'}`
    }
    default:
      return ''
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
