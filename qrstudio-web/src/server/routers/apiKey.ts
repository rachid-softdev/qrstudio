import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, router } from "@/server/trpc"
import { apiKeyService } from "@/server/services/api-key.service"
import { prisma } from "@/server/db"

async function ensurePlanIsProOrAbove(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })
  if (!user || user.plan === "FREE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Les clés API sont disponibles à partir du plan Pro",
    })
  }
}

export const apiKeyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id
    await ensurePlanIsProOrAbove(userId)
    return apiKeyService.list(userId)
  }),

  generate: protectedProcedure
    .input(z.object({ name: z.string().min(1, "Le nom est requis").max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id
      await ensurePlanIsProOrAbove(userId)
      return apiKeyService.generate(userId, input.name)
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.revoke(input.id, ctx.user!.id)
    }),
})
