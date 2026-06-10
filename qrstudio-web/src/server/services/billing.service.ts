import Stripe from "stripe"
import { TRPCError } from "@trpc/server"
import { prisma } from "@/server/db"
import { withRetry } from "@/lib/retry"
import { withBreaker, stripeBreaker } from "@/lib/circuit-breaker"
import logger from "@/lib/logger"
import * as Sentry from "@sentry/nextjs"
import type { Plan } from "@/types/index"

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY non configuré")
  }
  return new Stripe(secretKey, {
    apiVersion: "2026-05-27.dahlia",
  })
}

const PLAN_PRICE_IDS: Record<string, string> = {
  PRO: process.env.STRIPE_PRICE_PRO ?? "",
  AGENCY: process.env.STRIPE_PRICE_AGENCY ?? "",
}

export const billingService = {
  async createCheckoutSession(userId: string, plan: "PRO" | "AGENCY", successUrl: string, cancelUrl: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    })

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" })
    }

    let stripeCustomerId = user.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await withBreaker<Stripe.Customer>(stripeBreaker, () =>
        withRetry(() =>
          getStripe().customers.create({
            email: user.email,
            name: user.name ?? undefined,
            metadata: { userId: user.id },
          }),
          { maxRetries: 3, baseDelay: 500 },
        ),
      )
      stripeCustomerId = customer.id

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      })
    }

    const priceId = PLAN_PRICE_IDS[plan]
    if (!priceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `ID de prix Stripe non configuré pour le plan ${plan}`,
      })
    }

    const session = await withBreaker<Stripe.Checkout.Session>(stripeBreaker, () =>
      withRetry(() =>
        getStripe().checkout.sessions.create({
          customer: stripeCustomerId,
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          metadata: { userId: user.id, plan },
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
        { maxRetries: 3, baseDelay: 500 },
      ),
    )

    if (!session.url) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de créer la session de paiement",
      })
    }

    return { checkoutUrl: session.url }
  },

  async getSubscription(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, stripeSubscriptionId: true },
    })

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" })
    }

    if (!user.stripeSubscriptionId || user.plan === "FREE") {
      return {
        plan: "FREE" as Plan,
        status: "inactive",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }
    }

    try {
      const subscription = await withBreaker<Stripe.Subscription>(stripeBreaker, () =>
        withRetry(() =>
          getStripe().subscriptions.retrieve(user.stripeSubscriptionId!),
          { maxRetries: 3, baseDelay: 500 },
        ),
      )
      const item = subscription.items.data[0]

      return {
        plan: user.plan as Plan,
        status: subscription.status,
        currentPeriodEnd: item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }
    } catch (error) {
      logger.error(error, "Échec récupération abonnement Stripe")
      Sentry.captureException(new Error("Échec récupération abonnement Stripe"))
      return {
        plan: user.plan as Plan,
        status: "unavailable",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }
    }
  },

  async cancelSubscription(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true, plan: true },
    })

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" })
    }

    if (!user.stripeSubscriptionId || user.plan === "FREE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun abonnement actif",
      })
    }

    try {
      await withBreaker(stripeBreaker, () =>
        withRetry(() =>
          getStripe().subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true,
          }),
          { maxRetries: 3, baseDelay: 500 },
        ),
      )
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible d'annuler l'abonnement",
      })
    }

    return { success: true }
  },

  async handleWebhookEvent(event: Stripe.Event) {
    return prisma.$transaction(async (tx) => {
      // Idempotency check — inside the transaction
      const existing = await tx.webhookEvent.findUnique({
        where: { id: event.id },
      })
      if (existing) {
        return { skipped: true }
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session
            const userId = session.metadata?.userId
            const plan = session.metadata?.plan as Plan | undefined

            if (!userId || !plan) break

            await tx.user.update({
              where: { id: userId },
              data: {
                plan,
                stripeSubscriptionId: session.subscription as string,
              },
            })
            break
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription
            let userId = subscription.metadata?.userId

            if (!userId) {
              const user = await tx.user.findFirst({
                where: { stripeSubscriptionId: subscription.id },
                select: { id: true },
              })
              if (!user) break
              userId = user.id
            }

            const plan = mapStripePlanToPlan(subscription.items.data[0]?.price.id ?? "")
            await tx.user.update({
              where: { id: userId },
              data: { plan },
            })
            break
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription
            const user = await tx.user.findFirst({
              where: { stripeSubscriptionId: subscription.id },
              select: { id: true },
            })

            if (!user) break

            await tx.user.update({
              where: { id: user.id },
              data: {
                plan: "FREE",
                stripeSubscriptionId: null,
              },
            })
            break
          }
        }

        // Mark event as processed within the same transaction
        await tx.webhookEvent.create({
          data: { id: event.id, type: event.type },
        })
      } catch (error) {
        Sentry.captureException(error)
        throw error
      }
    })
  },
}

function mapStripePlanToPlan(priceId: string): Plan {
  if (priceId === PLAN_PRICE_IDS.PRO) return "PRO"
  if (priceId === PLAN_PRICE_IDS.AGENCY) return "AGENCY"
  return "FREE"
}
