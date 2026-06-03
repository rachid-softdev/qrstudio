import { z } from "zod"
import { protectedProcedure, router } from "@/server/trpc"
import { billingService } from "@/server/services/billing.service"

export const billingRouter = router({
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    return billingService.getSubscription(ctx.user.id)
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        plan: z.enum(["PRO", "AGENCY"]),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return billingService.createCheckoutSession(ctx.user.id, input.plan, input.successUrl, input.cancelUrl)
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    return billingService.cancelSubscription(ctx.user.id)
  }),
})
