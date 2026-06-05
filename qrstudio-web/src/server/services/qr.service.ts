import { TRPCError } from "@trpc/server"
import { prisma } from "@/server/db"
import { PLAN_LIMITS } from "@/lib/constants"
import { generateShortCode } from "@/lib/utils"
import { generateQRSvg } from "@/lib/qr-generator"
import type { Plan, QRStatus, QRType, Prisma } from "@prisma/client"
import type { QRCreateInput, QRUpdateInput } from "@/lib/validations"

type PlanKey = keyof typeof PLAN_LIMITS

/**
 * Minimal input shape for QR data generation.
 * Accepts both raw creation input and data mapped from a Prisma entity.
 */
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
function toMetadata(input: { destinationUrl?: string | null; wifi?: Record<string, unknown> | null; vcard?: Record<string, unknown> | null; textContent?: string | null }): Record<string, unknown> {
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

export const qrService = {
  async checkPlanLimit(workspaceId: string, ownerPlan: Plan): Promise<void> {
    const planKey = ownerPlan as PlanKey
    const limit = PLAN_LIMITS[planKey].maxQRCodes
    if (limit === Infinity) return

    const count = await prisma.qRCode.count({ where: { workspaceId } })
    if (count >= limit) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Limite de ${limit} QR codes atteinte pour votre plan. Passez au plan supérieur.`,
      })
    }
  },

  async generateUniqueShortCode(): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateShortCode()
      const existing = await prisma.qRCode.findUnique({ where: { shortCode: code } })
      if (!existing) return code
    }
    throw new Error('Échec de génération d\'un short code unique après 3 tentatives')
  },

  async create(data: QRCreateInput): Promise<{ id: string; shortCode: string; svgContent: string }> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: data.workspaceId },
      select: { ownerId: true, owner: { select: { plan: true } } },
    })

    if (!workspace) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Espace de travail introuvable' })
    }

    await qrService.checkPlanLimit(data.workspaceId, workspace.owner.plan)

    const shortCode = await qrService.generateUniqueShortCode()

    let landingPageId: string | undefined

    if (data.type === 'LANDING_PAGE' && data.landingPage) {
      const landingPage = await prisma.landingPage.create({
        data: {
          title: data.landingPage.title,
          description: data.landingPage.description ?? null,
          ctaLabel: data.landingPage.ctaLabel ?? null,
          ctaUrl: data.landingPage.ctaUrl ?? null,
          imageUrl: data.landingPage.imageUrl ?? null,
          bgColor: data.landingPage.bgColor ?? '#FFFFFF',
          textColor: data.landingPage.textColor ?? '#111827',
        },
      })
      landingPageId = landingPage.id
    }

    const qrData = prepareQRData(data, shortCode)
    const svgContent = await generateQRSvg(qrData, {
      fgColor: data.fgColor ?? '#000000',
      bgColor: data.bgColor ?? '#FFFFFF',
      moduleShape: data.moduleShape ?? 'square',
      logoUrl: data.logoUrl,
      frameType: data.frameType,
      frameLabel: data.frameLabel,
    })

    const qrCode = await prisma.qRCode.create({
      data: {
        workspaceId: data.workspaceId,
        shortCode,
        name: data.name,
        type: data.type as QRType,
        metadata: toMetadata(data) as Prisma.InputJsonValue,
        landingPageId: landingPageId ?? null,
        fgColor: data.fgColor ?? '#000000',
        bgColor: data.bgColor ?? '#FFFFFF',
        logoUrl: data.logoUrl ?? null,
        moduleShape: data.moduleShape ?? 'square',
        frameType: data.frameType ?? null,
        frameLabel: data.frameLabel ?? null,
      },
    })

    return { id: qrCode.id, shortCode: qrCode.shortCode, svgContent }
  },

  async update(id: string, workspaceId: string, data: QRUpdateInput): Promise<{ id: string; svgContent?: string }> {
    const existing = await prisma.qRCode.findFirst({
      where: { id, workspaceId },
      include: { landingPage: true },
    })

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
    }

    const updateData: Record<string, unknown> = {}
    const metadataFields = ['destinationUrl', 'wifi', 'vcard', 'textContent'] as const
    const contentChanged = metadataFields.some((f) => (data as Record<string, unknown>)[f] !== undefined)

    if (data.name !== undefined) updateData.name = data.name

    if (contentChanged) {
      const currentMetadata = (existing.metadata as Record<string, unknown>) ?? {}
      const newMetadata: Record<string, unknown> = { ...currentMetadata }

      if (data.destinationUrl !== undefined) {
        newMetadata.destinationUrl = data.destinationUrl === null ? null : data.destinationUrl
      }
      if (data.wifi !== undefined) {
        newMetadata.wifi = data.wifi === null ? null : data.wifi
      }
      if (data.vcard !== undefined) {
        newMetadata.vcard = data.vcard === null ? null : data.vcard
      }
      if (data.textContent !== undefined) {
        newMetadata.textContent = data.textContent === null ? null : data.textContent
      }

      updateData.metadata = newMetadata as Prisma.InputJsonValue
    }

    const designChanged = data.fgColor !== undefined || data.bgColor !== undefined ||
      data.moduleShape !== undefined || data.logoUrl !== undefined ||
      data.frameType !== undefined || data.frameLabel !== undefined

    if (data.fgColor !== undefined) updateData.fgColor = data.fgColor
    if (data.bgColor !== undefined) updateData.bgColor = data.bgColor
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl
    if (data.moduleShape !== undefined) updateData.moduleShape = data.moduleShape
    if (data.frameType !== undefined) updateData.frameType = data.frameType
    if (data.frameLabel !== undefined) updateData.frameLabel = data.frameLabel

    if (existing.type === 'LANDING_PAGE' && data.landingPage) {
      if (existing.landingPage) {
        await prisma.landingPage.update({
          where: { id: existing.landingPage.id },
          data: {
            title: data.landingPage.title,
            description: data.landingPage.description ?? null,
            ctaLabel: data.landingPage.ctaLabel ?? null,
            ctaUrl: data.landingPage.ctaUrl ?? null,
            imageUrl: data.landingPage.imageUrl ?? null,
            bgColor: data.landingPage.bgColor ?? '#FFFFFF',
            textColor: data.landingPage.textColor ?? '#111827',
          },
        })
      } else {
        const lp = await prisma.landingPage.create({
          data: {
            title: data.landingPage.title,
            description: data.landingPage.description ?? null,
            ctaLabel: data.landingPage.ctaLabel ?? null,
            ctaUrl: data.landingPage.ctaUrl ?? null,
            imageUrl: data.landingPage.imageUrl ?? null,
            bgColor: data.landingPage.bgColor ?? '#FFFFFF',
            textColor: data.landingPage.textColor ?? '#111827',
          },
        })
        updateData.landingPageId = lp.id
      }
    }

    await prisma.qRCode.update({
      where: { id },
      data: updateData,
    })

    let svgContent: string | undefined
    if (designChanged) {
      const qrData = prepareQRDataForUpdate(existing, data)
      svgContent = await generateQRSvg(qrData, {
        fgColor: data.fgColor ?? existing.fgColor,
        bgColor: data.bgColor ?? existing.bgColor,
        moduleShape: (data.moduleShape ?? existing.moduleShape) as 'square' | 'rounded' | 'dots',
        logoUrl: data.logoUrl ?? existing.logoUrl ?? undefined,
        frameType: data.frameType ?? existing.frameType ?? undefined,
        frameLabel: data.frameLabel ?? existing.frameLabel ?? undefined,
      })
    }

    return { id, svgContent }
  },

  async updateStatus(id: string, workspaceId: string, status: QRStatus, userId: string): Promise<void> {
    const existing = await prisma.qRCode.findFirst({
      where: { id, workspaceId },
    })
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
    }

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!member || member.role === 'VIEWER') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Action non autorisée' })
    }

    // RÈGLE MÉTIER : FREE ne peut pas PAUSER
    if (status === 'PAUSED') {
      const workspaceOwner = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { owner: { select: { plan: true } } },
      })
      if (workspaceOwner?.owner.plan === 'FREE') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Les QR codes du plan Gratuit ne peuvent pas être mis en pause.',
        })
      }
    }

    await prisma.qRCode.update({
      where: { id },
      data: { status },
    })
  },

  prepareQRDataFromEntity(
    entity: {
      type: string
      metadata: unknown
      shortCode: string
    },
  ): string {
    return prepareQRData(toQRDataInput(entity), entity.shortCode)
  },
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
function toQRDataInput(
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

function prepareQRDataForUpdate(existing: { type: string; shortCode?: string; metadata?: unknown }, data: QRUpdateInput): string {
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
