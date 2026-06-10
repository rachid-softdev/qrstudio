import type Stripe from "stripe"
import type { PrismaTx } from "../billing.service"
import { sendDowngradeNotification } from "../email.service"
import logger from "@/lib/logger"

export async function handleSubscriptionDeleted(event: Stripe.Event, tx: PrismaTx): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  const user = await tx.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, email: true, name: true },
  })

  if (!user) return

  await tx.user.update({
    where: { id: user.id },
    data: {
      plan: "FREE",
      stripeSubscriptionId: null,
    },
  })

  sendDowngradeNotification(user.email, user.name ?? undefined)
    .catch((err) => logger.error(err, "Échec notification rétrogradation (ignoré)"))
}
