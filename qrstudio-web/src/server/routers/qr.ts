import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { workspaceProcedure, router, requireWorkspaceAccess } from "@/server/trpc"
import { prisma } from "@/server/db"
import { qrService } from "@/server/services/qr.service"
import { analyticsService } from "@/server/services/analytics.service"
import { QRCreateSchema, QRUpdateSchema } from "@/lib/validations"
import { generateQRSvg, generateQrPngBuffer, generateQrPdfBuffer } from "@/lib/qr-generator"
import type { QRStatus } from "@prisma/client"

const QRTypeEnum = z.enum(['URL','WHATSAPP','WIFI','VCARD','PDF','TEXT','LANDING_PAGE'])
const QRStatusEnum = z.enum(['ACTIVE','PAUSED'])
const PeriodEnum = z.enum(['7d','30d','90d','all'])

const workspaceQuery = async (ctx: { user: { id: string } }, workspaceId: string) => {
  return requireWorkspaceAccess(ctx.user.id, workspaceId)
}

export const qrRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        type: QRTypeEnum.optional(),
        search: z.string().optional(),
        status: QRStatusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      const where: Record<string, unknown> = { workspaceId: input.workspaceId }
      if (input.type) where.type = input.type
      if (input.status) where.status = input.status
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { shortCode: { contains: input.search, mode: 'insensitive' } },
        ]
      }

      const items = await prisma.qRCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        select: {
          id: true, shortCode: true, name: true, type: true,
          status: true, totalScans: true, lastScannedAt: true, createdAt: true,
        },
      })

      let nextCursor: string | undefined
      if (items.length > input.limit) {
        const next = items.pop()
        nextCursor = next?.id
      }

      return { items, nextCursor }
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      const qrCode = await prisma.qRCode.findFirst({
        where: { id: input.id, workspaceId: input.workspaceId },
        include: { landingPage: true },
      })

      if (!qrCode) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      return qrCode
    }),

  create: workspaceProcedure
    .input(QRCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      const workspace = await prisma.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { ownerId: true, owner: { select: { plan: true } } },
      })

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Espace de travail introuvable' })
      }

      await qrService.checkPlanLimit(input.workspaceId, workspace.owner.plan)
      return qrService.create(input)
    }),

  update: workspaceProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string() }).merge(QRUpdateSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, workspaceId, ...data } = input
      const workspace = await workspaceQuery(ctx, workspaceId)

      const existing = await prisma.qRCode.findFirst({
        where: { id, workspaceId },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      if (workspace.role === 'VIEWER') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Action non autorisée' })
      }

      return qrService.update(id, workspaceId, data as Parameters<typeof qrService.update>[2])
    }),

  updateStatus: workspaceProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string(), status: QRStatusEnum }))
    .mutation(async ({ ctx, input }) => {
      await qrService.updateStatus(input.id, input.workspaceId, input.status as QRStatus, ctx.user!.id)
      return { success: true }
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.qRCode.findFirst({
        where: { id: input.id, workspaceId: input.workspaceId },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      const workspaceOwner = await prisma.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { ownerId: true },
      })

      if (workspaceOwner?.ownerId !== ctx.user!.id) {
        const workspace = await workspaceQuery(ctx, input.workspaceId)
        if (workspace.role !== 'OWNER') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Seul le propriétaire peut supprimer un QR code' })
        }
      }

      await prisma.qRCode.delete({ where: { id: input.id } })
      return { success: true }
    }),

  getAnalytics: workspaceProcedure
    .input(z.object({ qrCodeId: z.string(), workspaceId: z.string(), period: PeriodEnum.default('30d') }))
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)

      // Récupérer le plan pour calculer la rétention
      const user = await prisma.user.findUnique({
        where: { id: ctx.user!.id },
        select: { plan: true },
      })
      const retentionDays = user?.plan === 'FREE' ? 30 : user?.plan === 'PRO' ? 365 : undefined

      // Vérifier que le QR code existe avant d'appeler le service
      const existing = await prisma.qRCode.findFirst({
        where: { id: input.qrCodeId, workspaceId: input.workspaceId },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      return analyticsService.getAnalytics(input.qrCodeId, input.period, retentionDays)
    }),

  getDashboardStats: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      return analyticsService.getDashboardStats(input.workspaceId)
    }),

  exportCsv: workspaceProcedure
    .input(z.object({ qrCodeId: z.string(), workspaceId: z.string(), period: PeriodEnum.default('30d') }))
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      const existing = await prisma.qRCode.findFirst({
        where: { id: input.qrCodeId, workspaceId: input.workspaceId },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      return analyticsService.exportCSV(input.qrCodeId, input.period)
    }),

  exportCsvPage: workspaceProcedure
    .input(z.object({
      qrCodeId: z.string(),
      workspaceId: z.string(),
      period: PeriodEnum.default('30d'),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      const existing = await prisma.qRCode.findFirst({
        where: { id: input.qrCodeId, workspaceId: input.workspaceId },
      })

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      return analyticsService.exportCSVPage(input.qrCodeId, input.period, input.cursor)
    }),

  exportSvg: workspaceProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      const qrCode = await prisma.qRCode.findFirst({
        where: { id: input.id, workspaceId: input.workspaceId },
      })

      if (!qrCode) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      const svg = await generateQRSvg(qrService.prepareQRDataFromEntity(qrCode), {
        fgColor: qrCode.fgColor, bgColor: qrCode.bgColor,
        moduleShape: qrCode.moduleShape as 'square' | 'rounded' | 'dots',
        logoUrl: qrCode.logoUrl ?? undefined,
        frameType: qrCode.frameType ?? undefined,
        frameLabel: qrCode.frameLabel ?? undefined,
      })

      return { svg }
    }),

  exportPng: workspaceProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string(), size: z.number().min(100).max(2000).default(800) }))
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      const qrCode = await prisma.qRCode.findFirst({
        where: { id: input.id, workspaceId: input.workspaceId },
      })

      if (!qrCode) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      const buffer = await generateQrPngBuffer(qrService.prepareQRDataFromEntity(qrCode), {
        fgColor: qrCode.fgColor, bgColor: qrCode.bgColor,
        moduleShape: qrCode.moduleShape as 'square' | 'rounded' | 'dots',
        logoUrl: qrCode.logoUrl ?? undefined,
        frameType: qrCode.frameType ?? undefined,
        frameLabel: qrCode.frameLabel ?? undefined,
      }, input.size)

      return { base64: buffer.toString('base64') }
    }),

  exportPdf: workspaceProcedure
    .input(z.object({ id: z.string(), workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await workspaceQuery(ctx, input.workspaceId)
      const qrCode = await prisma.qRCode.findFirst({
        where: { id: input.id, workspaceId: input.workspaceId },
      })

      if (!qrCode) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
      }

      const buffer = await generateQrPdfBuffer(qrService.prepareQRDataFromEntity(qrCode), {
        fgColor: qrCode.fgColor, bgColor: qrCode.bgColor,
        moduleShape: qrCode.moduleShape as 'square' | 'rounded' | 'dots',
        logoUrl: qrCode.logoUrl ?? undefined,
        frameType: qrCode.frameType ?? undefined,
        frameLabel: qrCode.frameLabel ?? undefined,
      })

      return { base64: buffer.toString('base64') }
    }),
})
