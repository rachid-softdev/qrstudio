import type Stripe from "stripe"
import type { PrismaTx } from "../billing.service"
import { mapStripePlanToPlan } from "../billing.service"
import { sendDowngradeNotification } from "../email.service"
import logger from "@/lib/logger"

export async function handleSubscriptionUpdated(event: Stripe.Event, tx: PrismaTx): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  let userId = subscription.metadata?.userId

  if (!userId) {
    const user = await tx.user.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      select: { id: true },
    })
    if (!user) return
    userId = user.id
  }

  const priceId = subscription.items.data[0]?.price.id ?? ""
  const plan = mapStripePlanToPlan(priceId)

  // If user is downgrading from a paid plan to FREE, send notification
  const currentUser = await tx.user.findUnique({
    where: { id: userId },
    select: { plan: true, email: true, name: true },
  })

  await tx.user.update({
    where: { id: userId },
    data: { plan },
  })

  // Send downgrade notification if needed
  if (currentUser && currentUser.plan !== "FREE" && plan === "FREE") {
    sendDowngradeNotification(currentUser.email, currentUser.name ?? undefined)
      .catch((err) => logger.error(err, "Échec notification rétrogradation (ignoré)"))
  }
}
